import { describe, expect, it } from 'vitest';
import { buildShipment } from '../src/shipment.js';
import type { SkuPlan } from '../src/types.js';

function sku(overrides: Partial<SkuPlan> & Pick<SkuPlan, 'sku' | 'suggestedQty'>): SkuPlan {
  return {
    productTitle: overrides.sku,
    variantTitle: 'Black',
    productType: 'PLA',
    unitCost: 10,
    unitPrice: 24,
    onHand: 0,
    available: 0,
    committed: 0,
    incoming: 0,
    inventoryTracked: true,
    moq: 10,
    cartonSize: 10,
    unitsSold: 0,
    historyDays: 28,
    trailingMovingAverage: 1,
    trendPerDay: 0,
    seasonalIndex: [1, 1, 1, 1, 1, 1, 1],
    residualStdev: 0,
    forwardDailyVelocity: 1,
    daysOfCover: 10,
    leadTimeDemand: 10,
    safetyStock: 0,
    reorderPoint: 10,
    protectionDemand: 20,
    protectionSafetyStock: 0,
    orderUpTo: 20,
    inventoryPosition: 0,
    rawOrderQty: overrides.suggestedQty,
    roundedUp: false,
    stockoutDate: '2026-12-01',
    stockoutBeforeArrival: false,
    status: 'reorder',
    projection: [],
    ...overrides,
  };
}

describe('shipment', () => {
  it('fills the soonest stock-out first and withholds what the budget cannot start', () => {
    const urgent = sku({
      sku: 'URGENT',
      suggestedQty: 20,
      unitCost: 10,
      stockoutDate: '2026-11-20',
      productType: 'PLA',
    });
    const later = sku({
      sku: 'LATER',
      suggestedQty: 20,
      unitCost: 10,
      stockoutDate: '2026-12-20',
      productType: 'PETG',
    });
    const shipment = buildShipment([later, urgent], 250);
    expect(shipment.lines.map((line) => line.sku)).toEqual(['URGENT']);
    expect(shipment.lines[0]?.quantity).toBe(20);
    expect(shipment.lines[0]?.lineCost).toBe(200);
    expect(shipment.withheld.map((line) => line.sku)).toEqual(['LATER']);
    expect(shipment.budgetRemaining).toBe(50);
    expect(shipment.groups).toEqual([{ productType: 'PLA', units: 20, knownCost: 200, lines: 1 }]);
  });

  it('takes a partial number of cartons when the full suggestion does not fit', () => {
    const shipment = buildShipment(
      [sku({ sku: 'PARTIAL', suggestedQty: 40, unitCost: 5, moq: 10, cartonSize: 10 })],
      100,
    );
    expect(shipment.lines[0]?.quantity).toBe(20);
    expect(shipment.lines[0]?.partial).toBe(true);
    expect(shipment.lines[0]?.cartons).toBe(2);
    expect(shipment.knownCost).toBe(100);
    expect(shipment.withheld).toHaveLength(0);
  });

  it('does not round a partial fill below the MOQ', () => {
    const shipment = buildShipment(
      [sku({ sku: 'MIN', suggestedQty: 40, unitCost: 10, moq: 20, cartonSize: 10 })],
      100,
    );
    expect(shipment.lines).toHaveLength(0);
    expect(shipment.withheld[0]?.reason).toMatch(/full box/i);
  });

  it('does not let an unknown unit cost consume the budget', () => {
    const unknown = sku({
      sku: 'NO-COST',
      suggestedQty: 15,
      unitCost: null,
      cartonSize: 5,
      moq: 5,
      stockoutDate: '2026-11-18',
    });
    const priced = sku({
      sku: 'PRICED',
      suggestedQty: 20,
      unitCost: 9.8,
      moq: 10,
      cartonSize: 10,
      stockoutDate: '2026-11-25',
    });
    const shipment = buildShipment([priced, unknown], 196);
    expect(shipment.lines.map((line) => [line.sku, line.quantity, line.lineCost])).toEqual([
      ['NO-COST', 15, null],
      ['PRICED', 20, 196],
    ]);
    expect(shipment.hasUnknownCost).toBe(true);
    expect(shipment.budgetRemaining).toBe(0);
  });

  it('orders every suggestion when there is no cap', () => {
    const shipment = buildShipment(
      [
        sku({ sku: 'A', suggestedQty: 10, productType: 'PLA' }),
        sku({ sku: 'B', suggestedQty: 20, productType: 'PLA' }),
      ],
      null,
    );
    expect(shipment.totalUnits).toBe(30);
    expect(shipment.budgetRemaining).toBeNull();
    expect(shipment.withheld).toHaveLength(0);
    expect(shipment.groups[0]).toMatchObject({ productType: 'PLA', units: 30, lines: 2 });
  });
});
