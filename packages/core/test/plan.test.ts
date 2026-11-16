import { describe, expect, it } from 'vitest';
import { addDays, enumerateDates } from '../src/dates.js';
import { planStore } from '../src/plan.js';
import { DEFAULT_SETTINGS } from '../src/settings.js';
import { normalQuantile } from '../src/stats.js';
import type { OrderInput, PlannerSettings, StoreSnapshot, VariantInput } from '../src/types.js';

const AS_OF = '2026-11-16';

function settings(overrides: Partial<PlannerSettings> = {}): PlannerSettings {
  return {
    ...DEFAULT_SETTINGS,
    lookbackDays: 28,
    movingAverageWindow: 28,
    horizonDays: 30,
    ...overrides,
  };
}

function variant(overrides: Partial<VariantInput> & Pick<VariantInput, 'sku'>): VariantInput {
  return {
    productTitle: 'PLA 1kg',
    variantTitle: 'Black',
    productType: 'PLA',
    unitCost: 10,
    unitPrice: 24,
    onHand: 5,
    available: 5,
    committed: 0,
    incoming: 0,
    inventoryTracked: true,
    moq: null,
    cartonSize: null,
    ...overrides,
  };
}

function dailyOrders(sku: string, days: number, quantity: number): OrderInput[] {
  return enumerateDates(addDays(AS_OF, -days), AS_OF).map((date, index) => ({
    id: `${sku}-${index}`,
    createdAt: `${date}T01:00:00.000Z`,
    lineItems: [{ sku, quantity }],
  }));
}

function snapshot(overrides: Partial<StoreSnapshot> = {}): StoreSnapshot {
  return {
    variants: [variant({ sku: 'SKU-1' })],
    orders: dailyOrders('SKU-1', 28, 2),
    asOf: AS_OF,
    historyStart: addDays(AS_OF, -28),
    timeZone: 'UTC',
    source: 'sample',
    synthetic: true,
    disclaimer: 'SYNTHETIC',
    shopName: 'Test',
    currency: 'AUD',
    ...overrides,
  };
}

describe('planStore', () => {
  it('computes reorder point, order-up-to quantity, and the stock-out date', () => {
    const plan = planStore(snapshot(), settings({ leadTimeDays: 10, reviewPeriodDays: 10 }));
    const sku = plan.skus.find((item) => item.sku === 'SKU-1');
    expect(sku).toBeDefined();
    if (!sku) return;
    expect(plan.serviceLevelZ).toBeCloseTo(normalQuantile(0.95), 8);
    expect(sku.forwardDailyVelocity).toBeCloseTo(2, 8);
    expect(sku.leadTimeDemand).toBeCloseTo(20, 8);
    expect(sku.safetyStock).toBeCloseTo(0, 8);
    expect(sku.reorderPoint).toBeCloseTo(20, 8);
    expect(sku.protectionDemand).toBeCloseTo(40, 8);
    expect(sku.orderUpTo).toBeCloseTo(40, 8);
    expect(sku.inventoryPosition).toBe(5);
    expect(sku.rawOrderQty).toBeCloseTo(35, 8);
    expect(sku.suggestedQty).toBe(35);
    expect(sku.daysOfCover).toBeCloseTo(2.5, 8);
    expect(sku.stockoutDate).toBe('2026-11-18');
    expect(sku.stockoutBeforeArrival).toBe(true);
    expect(sku.status).toBe('stockout-risk');
    expect(plan.arrivalDate).toBe('2026-11-26');
    expect(
      plan.purchaseOrder.lines.map((line) => [line.sku, line.quantity, line.lineCost]),
    ).toEqual([['SKU-1', 35, 350]]);
  });

  it('orders only back to the reorder point when the review period is zero', () => {
    const plan = planStore(snapshot(), settings({ leadTimeDays: 10, reviewPeriodDays: 0 }));
    const sku = plan.skus[0];
    expect(sku?.orderUpTo).toBeCloseTo(20, 8);
    expect(sku?.suggestedQty).toBe(15);
  });

  it('leaves a well-stocked SKU off the shipment', () => {
    const plan = planStore(
      snapshot({
        variants: [
          variant({ sku: 'SKU-1' }),
          variant({ sku: 'HEALTHY', available: 1000, onHand: 1000 }),
        ],
        orders: [...dailyOrders('SKU-1', 28, 2), ...dailyOrders('HEALTHY', 28, 2)],
      }),
      settings({ leadTimeDays: 10, reviewPeriodDays: 10 }),
    );
    const healthy = plan.skus.find((item) => item.sku === 'HEALTHY');
    expect(healthy?.suggestedQty).toBe(0);
    expect(healthy?.status).toBe('covered');
    expect(plan.purchaseOrder.lines.some((line) => line.sku === 'HEALTHY')).toBe(false);
  });

  it('merges duplicate SKUs, skips blanks, and counts units with no catalogue SKU', () => {
    const plan = planStore(
      snapshot({
        variants: [
          variant({ sku: 'SKU-1', available: 2, onHand: 2 }),
          variant({ sku: 'SKU-1', available: 3, onHand: 3, unitCost: null }),
          variant({ sku: '  ' }),
        ],
        orders: [
          ...dailyOrders('SKU-1', 28, 2),
          {
            id: 'custom',
            createdAt: '2026-11-01T01:00:00.000Z',
            lineItems: [{ sku: 'NO-SUCH', quantity: 4 }],
          },
        ],
      }),
      settings({ leadTimeDays: 10, reviewPeriodDays: 10 }),
    );
    expect(plan.mergedDuplicateSkus).toBe(1);
    expect(plan.skippedWithoutSku).toBe(1);
    expect(plan.ignoredOrderUnits).toBe(4);
    expect(plan.skus).toHaveLength(1);
    expect(plan.skus[0]?.available).toBe(5);
    expect(plan.skus[0]?.suggestedQty).toBe(35);
  });

  it('does not treat days before the feed starts as zero sales', () => {
    const plan = planStore(
      snapshot({
        historyStart: addDays(AS_OF, -10),
        orders: [
          ...dailyOrders('SKU-1', 10, 2),
          {
            id: 'old',
            createdAt: `${addDays(AS_OF, -40)}T01:00:00.000Z`,
            lineItems: [{ sku: 'SKU-1', quantity: 100 }],
          },
        ],
      }),
      settings(),
    );
    expect(plan.historyDays).toBe(10);
    expect(plan.warnings[0]).toMatch(/shortened/i);
    expect(plan.skus[0]?.forwardDailyVelocity).toBeCloseTo(2, 6);
    expect(plan.ignoredOrderUnits).toBe(0);
  });

  it('does not order an untracked variant', () => {
    const plan = planStore(
      snapshot({ variants: [variant({ sku: 'SKU-1', inventoryTracked: false })] }),
      settings({ leadTimeDays: 10, reviewPeriodDays: 10 }),
    );
    expect(plan.skus[0]?.status).toBe('untracked');
    expect(plan.skus[0]?.suggestedQty).toBe(0);
    expect(plan.purchaseOrder.lines).toHaveLength(0);
  });

  it('applies a packaging override and a budget cap', () => {
    const plan = planStore(
      snapshot(),
      settings({
        leadTimeDays: 10,
        reviewPeriodDays: 10,
        moqOverride: 20,
        cartonSizeOverride: 10,
        budgetCap: 250,
      }),
    );
    const sku = plan.skus[0];
    expect(sku?.rawOrderQty).toBeCloseTo(35, 8);
    expect(sku?.suggestedQty).toBe(40);
    expect(sku?.roundedUp).toBe(true);
    expect(plan.purchaseOrder.lines[0]?.quantity).toBe(20);
    expect(plan.purchaseOrder.lines[0]?.partial).toBe(true);
    expect(plan.purchaseOrder.knownCost).toBe(200);
  });

  it('calls a zero-sales SKU no-demand instead of inventing an order', () => {
    const plan = planStore(
      snapshot({
        variants: [variant({ sku: 'DEAD', available: 36, onHand: 36 })],
        orders: [],
      }),
      settings({ leadTimeDays: 10, reviewPeriodDays: 10 }),
    );
    expect(plan.skus[0]?.status).toBe('no-demand');
    expect(plan.skus[0]?.suggestedQty).toBe(0);
    expect(plan.skus[0]?.daysOfCover).toBeNull();
    expect(plan.skus[0]?.stockoutDate).toBeNull();
  });
});
