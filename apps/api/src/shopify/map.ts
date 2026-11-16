import { PlannerError, type OrderInput, type VariantInput } from '@tinyfab/core';

/** Paid or still-committed money. Pending, voided, refunded, and expired orders are left out. */
export const COUNTED_FINANCIAL_STATUSES = new Set([
  'PAID',
  'PARTIALLY_PAID',
  'PARTIALLY_REFUNDED',
  'AUTHORIZED',
]);

const QUANTITY_NAMES = ['available', 'on_hand', 'committed', 'incoming'] as const;

export interface MappedCatalogue {
  shopName: string;
  currency: string;
  timeZone: string;
  variants: VariantInput[];
  orders: OrderInput[];
  truncatedVariantProducts: string[];
}

export function mapShop(payload: unknown): { name: string; currency: string; timeZone: string } {
  const body = asRecord(payload, 'response');
  const data = asRecord(body.data, 'data');
  const shop = asRecord(data.shop, 'shop');
  const name = stringField(shop, 'name');
  const currency = stringField(shop, 'currencyCode');
  const timeZone = stringField(shop, 'ianaTimezone');
  if (!name || !currency || !timeZone) {
    throw new PlannerError('Shopify shop response is missing name, currency, or timezone', 502);
  }
  return { name, currency, timeZone };
}

export function mapProducts(nodes: unknown[]): { variants: VariantInput[]; truncated: string[] } {
  const variants: VariantInput[] = [];
  const truncated: string[] = [];
  for (const node of nodes) {
    const product = asRecord(node, 'product');
    const title = stringField(product, 'title') || 'Untitled product';
    const productType = stringField(product, 'productType') || 'Uncategorised';
    const connection = asRecord(product.variants, `${title}.variants`);
    if (asRecord(connection.pageInfo, 'variants.pageInfo').hasNextPage === true) {
      truncated.push(title);
    }
    const variantNodes = asArray(connection.nodes, `${title}.variants.nodes`);
    for (const variantNode of variantNodes) {
      variants.push(mapVariant(variantNode, title, productType));
    }
  }
  return { variants, truncated };
}

export function mapOrders(nodes: unknown[]): OrderInput[] {
  const orders: OrderInput[] = [];
  for (const node of nodes) {
    const order = asRecord(node, 'order');
    if (order.cancelledAt) continue;
    const status = stringField(order, 'displayFinancialStatus');
    if (!status || !COUNTED_FINANCIAL_STATUSES.has(status)) continue;
    const id = stringField(order, 'id');
    const createdAt = stringField(order, 'createdAt');
    if (!id || !createdAt) continue;
    const lineConnection = asRecord(order.lineItems, `${id}.lineItems`);
    orders.push({
      id,
      createdAt,
      lineItems: mapLineItems(asArray(lineConnection.nodes, `${id}.lineItems.nodes`)),
    });
  }
  return orders;
}

export function mapLineItems(nodes: unknown[]): OrderInput['lineItems'] {
  const lines: OrderInput['lineItems'] = [];
  for (const node of nodes) {
    const line = asRecord(node, 'lineItem');
    const quantity = countedQuantity(line);
    if (quantity <= 0) continue;
    lines.push({ sku: stringField(line, 'sku'), quantity });
  }
  return lines;
}

function mapVariant(node: unknown, productTitle: string, productType: string): VariantInput {
  const variant = asRecord(node, 'variant');
  const inventory = variant.inventoryItem ? asRecord(variant.inventoryItem, 'inventoryItem') : null;
  const totals = { available: 0, on_hand: 0, committed: 0, incoming: 0 };
  let tracked = false;
  let unitCost: number | null = null;
  if (inventory) {
    tracked = inventory.tracked === true;
    unitCost = moneyAmount(inventory.unitCost);
    const levels = inventory.inventoryLevels
      ? asRecord(inventory.inventoryLevels, 'inventoryLevels')
      : null;
    if (levels?.pageInfo && asRecord(levels.pageInfo, 'pageInfo').hasNextPage === true) {
      throw new PlannerError(
        `Inventory locations for ${stringField(variant, 'sku') || productTitle} exceed 50. This build sums the first page only and refuses to guess the rest.`,
        502,
      );
    }
    const levelNodes = levels ? asArray(levels.nodes, 'inventoryLevels.nodes') : [];
    for (const levelNode of levelNodes) {
      const level = asRecord(levelNode, 'inventoryLevel');
      for (const quantityNode of asArray(level.quantities, 'quantities')) {
        const quantity = asRecord(quantityNode, 'quantity');
        const name = stringField(quantity, 'name');
        if (
          name === 'available' ||
          name === 'on_hand' ||
          name === 'committed' ||
          name === 'incoming'
        ) {
          totals[name] += numberField(quantity, 'quantity');
        }
      }
    }
  }
  return {
    sku: stringField(variant, 'sku'),
    productTitle,
    variantTitle: stringField(variant, 'title') || 'Default',
    productType,
    unitCost,
    unitPrice: moneyAmount(variant.price),
    onHand: totals.on_hand,
    available: totals.available,
    committed: totals.committed,
    incoming: totals.incoming,
    inventoryTracked: tracked,
    moq: null,
    cartonSize: null,
  };
}

function countedQuantity(line: Record<string, unknown>): number {
  const current = line.currentQuantity;
  const quantity = typeof current === 'number' ? current : numberField(line, 'quantity');
  if (!Number.isFinite(quantity) || quantity < 0) return 0;
  return quantity;
}

function moneyAmount(value: unknown): number | null {
  if (typeof value === 'string' || typeof value === 'number') {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }
  if (typeof value === 'object' && value !== null && 'amount' in value) {
    const amount = Number((value as { amount: unknown }).amount);
    return Number.isFinite(amount) ? amount : null;
  }
  return null;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PlannerError(`Unexpected Shopify response at ${label}`, 502);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new PlannerError(`Unexpected Shopify response at ${label}`, 502);
  return value;
}

function stringField(recordValue: Record<string, unknown>, key: string): string {
  const value = recordValue[key];
  return typeof value === 'string' ? value.trim() : '';
}

function numberField(recordValue: Record<string, unknown>, key: string): number {
  const value = recordValue[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export const TRACKED_QUANTITIES = QUANTITY_NAMES;
