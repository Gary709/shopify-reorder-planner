import { addDays, calendarDate, diffDays, enumerateDates } from './dates.js';
import { PlannerError } from './errors.js';
import { fitDemandModel, forecastFromModel, sumFirst } from './forecast.js';
import { daysOfCover, projectStock, roundOrderQuantity, safetyStock } from './reorder.js';
import { assertSettings, STOCKOUT_SEARCH_DAYS } from './settings.js';
import { buildShipment } from './shipment.js';
import { normalQuantile } from './stats.js';
import type {
  OrderInput,
  PlanResult,
  PlannerSettings,
  SkuPlan,
  SkuStatus,
  StoreSnapshot,
  VariantInput,
} from './types.js';

const ASSUMPTIONS = [
  "Each day's miss is treated as independent. The weekday pattern and the trend are taken as given.",
  'The boat takes a fixed number of days. Early or late arrivals are not in the safety stock.',
  'Stock already on the water is added on the lead-time day. Shopify does not send an arrival date.',
  'Ordering today does not cover sales missed before the boat lands.',
  'A gap of zero stays zero. Otherwise the qty rounds up to the minimum, then to a full box.',
  'One order. If there is a budget, colours that run out sooner get the money first.',
];

export function planStore(snapshot: StoreSnapshot, settings: PlannerSettings): PlanResult {
  assertSettings(settings);
  validateSnapshot(snapshot);

  const requestedStart = addDays(snapshot.asOf, -settings.lookbackDays);
  const historyStart =
    requestedStart > snapshot.historyStart ? requestedStart : snapshot.historyStart;
  const warnings: string[] = [];
  if (historyStart > requestedStart) {
    const available = diffDays(snapshot.historyStart, snapshot.asOf);
    warnings.push(
      `Orders only go back to ${snapshot.historyStart} (${available} days), short of the ${settings.lookbackDays}-day lookback. I did not fill the gap with zero sales.`,
    );
  }

  const dates = enumerateDates(historyStart, snapshot.asOf);
  const normalized = normalizeVariants(snapshot.variants);
  const demand = buildDemand(normalized.variants, snapshot.orders, dates, snapshot.timeZone);
  const z = normalQuantile(settings.serviceLevel);
  const searchDays = Math.max(settings.horizonDays, STOCKOUT_SEARCH_DAYS);

  const skus = normalized.variants.map((variant) =>
    planSku({
      variant,
      dates,
      quantities: demand.bySku.get(variant.sku) ?? dates.map(() => 0),
      settings,
      asOf: snapshot.asOf,
      z,
      searchDays,
    }),
  );
  skus.sort(comparePlans);

  return {
    source: snapshot.source,
    synthetic: snapshot.synthetic,
    disclaimer: snapshot.disclaimer,
    shopName: snapshot.shopName,
    currency: snapshot.currency,
    timeZone: snapshot.timeZone,
    asOf: snapshot.asOf,
    arrivalDate: addDays(snapshot.asOf, settings.leadTimeDays),
    historyStart,
    historyDays: dates.length,
    stockoutSearchDays: searchDays,
    settings,
    serviceLevelZ: z,
    assumptions: ASSUMPTIONS,
    warnings,
    skippedWithoutSku: normalized.skippedWithoutSku,
    mergedDuplicateSkus: normalized.mergedDuplicateSkus,
    ignoredOrderUnits: demand.ignoredOrderUnits,
    skus,
    purchaseOrder: buildShipment(skus, settings.budgetCap),
  };
}

function validateSnapshot(snapshot: StoreSnapshot): void {
  if (!snapshot.asOf || !snapshot.historyStart) {
    throw new PlannerError('snapshot is missing asOf or historyStart', 500);
  }
  if (snapshot.historyStart > snapshot.asOf) {
    throw new PlannerError('historyStart is after asOf', 500);
  }
  try {
    calendarDate(`${snapshot.asOf}T00:00:00.000Z`, snapshot.timeZone);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid timezone';
    throw new PlannerError(message, 500);
  }
}

function normalizeVariants(variants: readonly VariantInput[]): {
  variants: VariantInput[];
  skippedWithoutSku: number;
  mergedDuplicateSkus: number;
} {
  const bySku = new Map<string, VariantInput>();
  let skippedWithoutSku = 0;
  let mergedDuplicateSkus = 0;
  for (const variant of variants) {
    const sku = variant.sku.trim();
    if (!sku) {
      skippedWithoutSku += 1;
      continue;
    }
    assertVariantNumbers(sku, variant);
    const existing = bySku.get(sku);
    if (!existing) {
      bySku.set(sku, { ...variant, sku });
      continue;
    }
    mergedDuplicateSkus += 1;
    existing.onHand += variant.onHand;
    existing.available += variant.available;
    existing.committed += variant.committed;
    existing.incoming += variant.incoming;
    existing.inventoryTracked = existing.inventoryTracked || variant.inventoryTracked;
    if (existing.unitCost === null) existing.unitCost = variant.unitCost;
    if (existing.unitPrice === null) existing.unitPrice = variant.unitPrice;
    existing.moq = strictest(existing.moq, variant.moq);
    existing.cartonSize = strictest(existing.cartonSize, variant.cartonSize);
  }
  return {
    variants: [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku)),
    skippedWithoutSku,
    mergedDuplicateSkus,
  };
}

function strictest(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

function assertVariantNumbers(sku: string, variant: VariantInput): void {
  finite(`${sku} onHand`, variant.onHand, false);
  finite(`${sku} available`, variant.available, true);
  finite(`${sku} committed`, variant.committed, false);
  finite(`${sku} incoming`, variant.incoming, false);
  if (variant.unitCost !== null) finite(`${sku} unitCost`, variant.unitCost, false);
  if (variant.unitPrice !== null) finite(`${sku} unitPrice`, variant.unitPrice, false);
}

function finite(name: string, value: number, allowNegative: boolean): void {
  if (!Number.isFinite(value) || (!allowNegative && value < 0)) {
    throw new PlannerError(
      allowNegative ? `${name} must be a finite number` : `${name} must be a finite number >= 0`,
      500,
    );
  }
}

function buildDemand(
  variants: readonly VariantInput[],
  orders: readonly OrderInput[],
  dates: readonly string[],
  timeZone: string,
): { bySku: Map<string, number[]>; ignoredOrderUnits: number } {
  const index = new Map(dates.map((date, position) => [date, position]));
  const known = new Set(variants.map((variant) => variant.sku));
  const bySku = new Map<string, number[]>(
    variants.map((variant) => [variant.sku, dates.map(() => 0)]),
  );
  let ignoredOrderUnits = 0;

  for (const order of orders) {
    const soldOn = calendarDate(order.createdAt, timeZone);
    const position = index.get(soldOn);
    for (const line of order.lineItems) {
      const quantity = line.quantity;
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new PlannerError(`Order ${order.id} has a negative quantity for ${line.sku}`, 500);
      }
      const bucket = position === undefined ? undefined : bySku.get(line.sku);
      if (!bucket || position === undefined) {
        // Known SKUs outside the window are simply out of lookback. Units for a
        // SKU that is not in the catalogue are reported, whatever the date.
        if (!known.has(line.sku)) ignoredOrderUnits += quantity;
        continue;
      }
      bucket[position] = (bucket[position] ?? 0) + quantity;
    }
  }

  return { bySku, ignoredOrderUnits };
}

function planSku(args: {
  variant: VariantInput;
  dates: readonly string[];
  quantities: readonly number[];
  settings: PlannerSettings;
  asOf: string;
  z: number;
  searchDays: number;
}): SkuPlan {
  const { variant, settings, asOf, z, searchDays } = args;
  const moq = settings.moqOverride ?? variant.moq ?? settings.defaultMoq;
  const cartonSize =
    settings.cartonSizeOverride ?? variant.cartonSize ?? settings.defaultCartonSize;
  if (!Number.isInteger(moq) || moq < 0) {
    throw new PlannerError(`${variant.sku} MOQ must be a non-negative integer`);
  }
  if (!Number.isInteger(cartonSize) || cartonSize < 1) {
    throw new PlannerError(`${variant.sku} carton size must be a positive integer`);
  }

  const model = fitDemandModel(args.dates, args.quantities, settings.movingAverageWindow);
  const forecast = forecastFromModel(model, asOf, searchDays);
  const leadTimeDemand = sumFirst(forecast, settings.leadTimeDays);
  const protectionDays = settings.leadTimeDays + settings.reviewPeriodDays;
  const protectionDemand = sumFirst(forecast, protectionDays);
  const leadSafety = safetyStock(z, model.residualStdev, settings.leadTimeDays);
  const protectionSafety = safetyStock(z, model.residualStdev, protectionDays);
  const reorderPoint = leadTimeDemand + leadSafety;
  const orderUpTo = protectionDemand + protectionSafety;
  const inventoryPosition = variant.available + variant.incoming;
  const forwardDailyVelocity =
    settings.leadTimeDays > 0 ? leadTimeDemand / settings.leadTimeDays : 0;
  const unitsSold = args.quantities.reduce((sum, quantity) => sum + quantity, 0);

  let rawOrderQty = Math.max(0, orderUpTo - inventoryPosition);
  let suggestedQty = roundOrderQuantity(rawOrderQty, moq, cartonSize);
  if (!variant.inventoryTracked) {
    rawOrderQty = 0;
    suggestedQty = 0;
  }

  const projection = projectStock({
    asOf,
    available: variant.available,
    incoming: variant.incoming,
    orderQty: suggestedQty,
    leadTimeDays: settings.leadTimeDays,
    forecast,
  });

  const status = statusFor({
    tracked: variant.inventoryTracked,
    stockoutBeforeArrival: projection.stockoutBeforeArrival,
    suggestedQty,
    forwardDailyVelocity,
  });

  return {
    sku: variant.sku,
    productTitle: variant.productTitle,
    variantTitle: variant.variantTitle,
    productType: variant.productType,
    unitCost: variant.unitCost,
    unitPrice: variant.unitPrice,
    onHand: variant.onHand,
    available: variant.available,
    committed: variant.committed,
    incoming: variant.incoming,
    inventoryTracked: variant.inventoryTracked,
    moq,
    cartonSize,
    unitsSold,
    historyDays: args.dates.length,
    trailingMovingAverage: model.trailingMovingAverage,
    trendPerDay: model.trendPerDay,
    seasonalIndex: [...model.seasonalIndex],
    residualStdev: model.residualStdev,
    forwardDailyVelocity,
    daysOfCover: daysOfCover(variant.available, forwardDailyVelocity),
    leadTimeDemand,
    safetyStock: leadSafety,
    reorderPoint,
    protectionDemand,
    protectionSafetyStock: protectionSafety,
    orderUpTo,
    inventoryPosition,
    rawOrderQty,
    suggestedQty,
    roundedUp: suggestedQty > rawOrderQty + 1e-6,
    stockoutDate: projection.stockoutDate,
    stockoutBeforeArrival: projection.stockoutBeforeArrival,
    status,
    projection: projection.points.slice(0, settings.horizonDays),
  };
}

function statusFor(args: {
  tracked: boolean;
  stockoutBeforeArrival: boolean;
  suggestedQty: number;
  forwardDailyVelocity: number;
}): SkuStatus {
  if (!args.tracked) return 'untracked';
  if (args.stockoutBeforeArrival) return 'stockout-risk';
  if (args.suggestedQty > 0) return 'reorder';
  if (!(args.forwardDailyVelocity > 1e-9)) return 'no-demand';
  return 'covered';
}

function comparePlans(a: SkuPlan, b: SkuPlan): number {
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank !== 0) return rank;
  const cover = compareNullable(a.daysOfCover, b.daysOfCover);
  if (cover !== 0) return cover;
  return a.sku.localeCompare(b.sku);
}

const STATUS_RANK: Record<SkuStatus, number> = {
  'stockout-risk': 0,
  reorder: 1,
  covered: 2,
  'no-demand': 3,
  untracked: 4,
};

function compareNullable(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
