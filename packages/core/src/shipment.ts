import { fromCents, toCents } from './money.js';
import type { PurchaseOrder, ShipmentGroup, ShipmentLine, SkuPlan, WithheldLine } from './types.js';

// Soonest stock-out first. Unknown unit cost does not use up the budget.
export function buildShipment(skus: readonly SkuPlan[], budgetCap: number | null): PurchaseOrder {
  const candidates = skus
    .filter((sku) => sku.inventoryTracked && sku.suggestedQty > 0)
    .slice()
    .sort(compareUrgency);

  const budgetCents = budgetCap === null ? null : toCents(budgetCap);
  let remainingCents = budgetCents;
  const lines: ShipmentLine[] = [];
  const withheld: WithheldLine[] = [];

  for (const sku of candidates) {
    const decision = takeQuantity(sku, remainingCents);
    if (decision.quantity <= 0) {
      withheld.push({
        sku: sku.sku,
        productTitle: sku.productTitle,
        variantTitle: sku.variantTitle,
        suggestedQty: sku.suggestedQty,
        unitCost: sku.unitCost,
        reason: decision.reason,
      });
      continue;
    }
    const lineCostCents = sku.unitCost === null ? null : toCents(sku.unitCost) * decision.quantity;
    if (lineCostCents !== null && remainingCents !== null) remainingCents -= lineCostCents;
    lines.push({
      sku: sku.sku,
      productTitle: sku.productTitle,
      variantTitle: sku.variantTitle,
      productType: sku.productType || 'Uncategorised',
      quantity: decision.quantity,
      cartons: decision.quantity / sku.cartonSize,
      unitCost: sku.unitCost,
      lineCost: lineCostCents === null ? null : fromCents(lineCostCents),
      moq: sku.moq,
      cartonSize: sku.cartonSize,
      partial: decision.quantity < sku.suggestedQty,
      reason:
        decision.quantity < sku.suggestedQty
          ? `Budget only covers ${decision.quantity} of ${sku.suggestedQty}.`
          : orderReason(sku),
    });
  }

  const knownCostCents = lines.reduce(
    (sum, line) => sum + (line.lineCost === null ? 0 : toCents(line.lineCost)),
    0,
  );

  return {
    lines,
    withheld,
    groups: groupLines(lines),
    totalUnits: lines.reduce((sum, line) => sum + line.quantity, 0),
    knownCost: fromCents(knownCostCents),
    hasUnknownCost: lines.some((line) => line.unitCost === null),
    budgetCap,
    budgetRemaining: remainingCents === null ? null : fromCents(remainingCents),
  };
}

function compareUrgency(a: SkuPlan, b: SkuPlan): number {
  const date = compareNullable(a.stockoutDate, b.stockoutDate);
  if (date !== 0) return date;
  const cover = compareNullable(a.daysOfCover, b.daysOfCover);
  if (cover !== 0) return cover;
  return a.sku.localeCompare(b.sku);
}

function compareNullable(a: string | number | null, b: string | number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function orderReason(sku: SkuPlan): string {
  if (sku.stockoutBeforeArrival) {
    return 'Runs out before the boat lands. This qty is for after it arrives, not the weeks it is at sea.';
  }
  return 'Under the level I want on hand when the next boat is due.';
}

function takeQuantity(
  sku: SkuPlan,
  remainingCents: number | null,
): { quantity: number; reason: string } {
  if (sku.unitCost === null || remainingCents === null) {
    return { quantity: sku.suggestedQty, reason: '' };
  }
  const unitCents = toCents(sku.unitCost);
  if (unitCents <= 0) return { quantity: sku.suggestedQty, reason: '' };
  const fullCents = unitCents * sku.suggestedQty;
  if (fullCents <= remainingCents) return { quantity: sku.suggestedQty, reason: '' };

  const affordableUnits = Math.floor(remainingCents / unitCents);
  const cartons = Math.floor(affordableUnits / sku.cartonSize);
  const quantity = cartons * sku.cartonSize;
  if (quantity >= sku.moq && quantity > 0) return { quantity, reason: '' };
  return {
    quantity: 0,
    reason: `Budget doesn't cover a full box (${formatMinimum(sku)}).`,
  };
}

function formatMinimum(sku: SkuPlan): string {
  const minimum = Math.max(sku.moq, sku.cartonSize);
  const rounded = Math.ceil(minimum / sku.cartonSize) * sku.cartonSize;
  return `minimum ${sku.moq}, box of ${sku.cartonSize}, so at least ${rounded}`;
}

function groupLines(lines: readonly ShipmentLine[]): ShipmentGroup[] {
  const groups = new Map<string, ShipmentGroup>();
  for (const line of lines) {
    const current = groups.get(line.productType) ?? {
      productType: line.productType,
      units: 0,
      knownCost: 0,
      lines: 0,
    };
    current.units += line.quantity;
    current.lines += 1;
    if (line.lineCost !== null)
      current.knownCost = fromCents(toCents(current.knownCost) + toCents(line.lineCost));
    groups.set(line.productType, current);
  }
  return [...groups.values()].sort((a, b) => a.productType.localeCompare(b.productType));
}
