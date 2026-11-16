import { writeFileSync } from 'node:fs';
import {
  addDays,
  enumerateDates,
  planStore,
  DEFAULT_SETTINGS,
  weekdayIndex,
  type StoreSnapshot,
  type VariantInput,
} from '@tinyfab/core';
import { sampleStorePath } from './paths.js';

/**
 * Deterministic synthetic catalogue. Base rates, trends, weekday weights, and
 * target cover are generator inputs — not measurements of a real shop.
 * Stock is set from the realised simulated mean so the demo contains a mix of
 * stock-out risk, ordinary reorders, covered SKUs, and a no-demand SKU.
 */

const AS_OF = '2026-11-16';
const HISTORY_DAYS = 180;
const SEED = 70916;
const TIME_ZONE = 'Australia/Sydney';

const RAW_WEEKDAY = [1.25, 0.75, 0.85, 0.95, 1, 1.2, 1.45];
const WEEKDAY_MEAN = RAW_WEEKDAY.reduce((sum, value) => sum + value, 0) / RAW_WEEKDAY.length;
const WEEKDAY = RAW_WEEKDAY.map((value) => value / WEEKDAY_MEAN);

interface Spec {
  sku: string;
  productTitle: string;
  variantTitle: string;
  productType: string;
  unitCost: number;
  unitPrice: number;
  baseDailyRate: number;
  /** Fractional change from the start of the window to the end, centred on the base rate. */
  trendFraction: number;
  /** Target days of cover used only to choose a starting stock figure. Null means fixed stock and no demand. */
  targetCoverDays: number | null;
  fixedAvailable?: number;
  committed: number;
  incoming: number;
  moq: number;
  cartonSize: number;
}

const SPECS: Spec[] = [
  spec('TF-PLA-BLK-1KG', 'PLA 1kg', 'Black', 'PLA', 9.5, 24, 2.2, 0.45, 10, 2, 0, 20, 10),
  spec('TF-PLA-WHT-1KG', 'PLA 1kg', 'White', 'PLA', 9.5, 24, 1.4, 0, 72, 0, 0, 20, 10),
  spec('TF-PLA-GRY-1KG', 'PLA 1kg', 'Grey', 'PLA', 9.5, 24, 1.8, 0.1, 14, 1, 0, 20, 10),
  spec('TF-PLA-RED-1KG', 'PLA 1kg', 'Red', 'PLA', 9.8, 25, 0.9, 0, 85, 0, 0, 20, 10),
  spec('TF-PLA-BLU-1KG', 'PLA 1kg', 'Blue', 'PLA', 9.8, 25, 0.55, 0, 240, 0, 0, 20, 10),
  spec('TF-PLA-GRN-1KG', 'PLA 1kg', 'Green', 'PLA', 9.8, 25, 1.15, 0, 8, 1, 0, 20, 10),
  spec('TF-PETG-BLK-1KG', 'PETG 1kg', 'Black', 'PETG', 11, 29, 1.05, 0.35, 16, 0, 0, 20, 10),
  spec('TF-PETG-WHT-1KG', 'PETG 1kg', 'White', 'PETG', 11, 29, 0.7, 0, 78, 0, 20, 20, 10),
  spec('TF-PETG-CLR-1KG', 'PETG 1kg', 'Clear', 'PETG', 12, 32, 0.5, 0, 20, 0, 0, 10, 10),
  spec('TF-PETG-BLU-1KG', 'PETG 1kg', 'Blue', 'PETG', 11.5, 30, 0.35, 0, 220, 0, 0, 20, 10),
  spec('TF-TPU-BLK-1KG', 'TPU 1kg', 'Black', 'TPU', 16, 42, 0.28, 0, 24, 0, 0, 10, 5),
  spec('TF-TPU-RED-1KG', 'TPU 1kg', 'Red', 'TPU', 16.5, 44, 0.12, -0.2, 260, 0, 0, 10, 5),
  spec('TF-PLA-SILK-GLD-1KG', 'PLA Silk 1kg', 'Gold', 'PLA', 13, 34, 0.42, 0, 68, 0, 0, 10, 10),
  spec(
    'TF-PLA-MAT-NAT-1KG',
    'PLA Matte 1kg',
    'Natural',
    'PLA',
    10,
    26,
    0.85,
    -0.55,
    280,
    0,
    0,
    20,
    10,
  ),
  spec('TF-ABS-BLK-1KG', 'ABS 1kg', 'Black', 'ABS', 10.5, 27, 0, 0, null, 0, 0, 20, 10, 36),
];

function spec(
  sku: string,
  productTitle: string,
  variantTitle: string,
  productType: string,
  unitCost: number,
  unitPrice: number,
  baseDailyRate: number,
  trendFraction: number,
  targetCoverDays: number | null,
  committed: number,
  incoming: number,
  moq: number,
  cartonSize: number,
  fixedAvailable?: number,
): Spec {
  return {
    sku,
    productTitle,
    variantTitle,
    productType,
    unitCost,
    unitPrice,
    baseDailyRate,
    trendFraction,
    targetCoverDays,
    committed,
    incoming,
    moq,
    cartonSize,
    ...(fixedAvailable === undefined ? {} : { fixedAvailable }),
  };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(rng: () => number, lambda: number): number {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let count = 0;
  let product = 1;
  do {
    count += 1;
    product *= rng();
  } while (product > limit && count < 1000);
  return count - 1;
}

const historyStart = addDays(AS_OF, -HISTORY_DAYS);
const dates = enumerateDates(historyStart, AS_OF);
const rng = mulberry32(SEED);
const sold = new Map<string, number>(SPECS.map((item) => [item.sku, 0]));

interface SampleOrder {
  id: string;
  createdAt: string;
  lineItems: { sku: string; quantity: number }[];
}

const orders: SampleOrder[] = [];
let sequence = 1;

dates.forEach((date, dayIndex) => {
  const midpoint = (dates.length - 1) / 2;
  const weight = WEEKDAY[weekdayIndex(date)] ?? 1;
  let withinDay = 0;
  for (const item of SPECS) {
    const trend = 1 + item.trendFraction * ((dayIndex - midpoint) / dates.length);
    const lambda = Math.max(0, item.baseDailyRate * trend * weight);
    const quantity = poisson(rng, lambda);
    if (quantity <= 0) continue;
    sold.set(item.sku, (sold.get(item.sku) ?? 0) + quantity);
    let remaining = quantity;
    while (remaining > 0) {
      const size = remaining >= 3 && rng() > 0.7 ? 2 : 1;
      const take = Math.min(size, remaining);
      const minute = Math.min(40, Math.floor(withinDay / 60));
      const second = withinDay % 60;
      orders.push({
        id: `syn-${String(sequence).padStart(5, '0')}`,
        createdAt: `${date}T01:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`,
        lineItems: [{ sku: item.sku, quantity: take }],
      });
      sequence += 1;
      withinDay += 1;
      remaining -= take;
    }
  }
});

const variants: VariantInput[] = SPECS.map((item) => {
  const units = sold.get(item.sku) ?? 0;
  const realized = units / dates.length;
  const available =
    item.fixedAvailable ??
    (item.targetCoverDays === null || realized <= 0
      ? 0
      : Math.max(0, Math.round(realized * item.targetCoverDays)));
  const committed = Math.min(item.committed, available);
  return {
    sku: item.sku,
    productTitle: item.productTitle,
    variantTitle: item.variantTitle,
    productType: item.productType,
    unitCost: item.unitCost,
    unitPrice: item.unitPrice,
    onHand: available + committed,
    available,
    committed,
    incoming: item.incoming,
    inventoryTracked: true,
    moq: item.moq,
    cartonSize: item.cartonSize,
  };
});

const disclaimer =
  'SYNTHETIC SAMPLE. Products, stock, costs, prices, and orders are simulated for an illustrative TinyFab 3D catalogue. They are not the shop’s real records. Prices and unit costs are round inputs chosen for the demo, not market quotes.';

const snapshot: StoreSnapshot = {
  variants,
  orders,
  asOf: AS_OF,
  historyStart,
  timeZone: TIME_ZONE,
  source: 'sample',
  synthetic: true,
  disclaimer,
  shopName: 'TinyFab 3D (sample)',
  currency: 'AUD',
};

const plan = planStore(snapshot, DEFAULT_SETTINGS);
const counts = new Map<string, number>();
for (const sku of plan.skus) counts.set(sku.status, (counts.get(sku.status) ?? 0) + 1);

const document = {
  synthetic: true,
  label: 'SYNTHETIC SAMPLE — not TinyFab 3D’s real catalogue, stock, costs, or sales.',
  disclaimer,
  shopName: snapshot.shopName,
  currency: snapshot.currency,
  timeZone: snapshot.timeZone,
  asOf: snapshot.asOf,
  historyStart: snapshot.historyStart,
  generator: {
    seed: SEED,
    note: 'Demand is simulated. baseDailyRate, trendFraction, weekday weights, and targetCoverDays are inputs to the generator, not measurements.',
    weekdayWeightsSunToSat: WEEKDAY,
    skus: SPECS.map((item) => ({
      sku: item.sku,
      baseDailyRate: item.baseDailyRate,
      trendFraction: item.trendFraction,
      targetCoverDays: item.targetCoverDays,
    })),
  },
  variants,
  orders,
};

writeFileSync(sampleStorePath, `${JSON.stringify(document, null, 2)}\n`);

console.log(`Wrote ${orders.length} synthetic orders to ${sampleStorePath}`);
console.log('Status mix:', Object.fromEntries(counts));
for (const sku of plan.skus) {
  console.log(
    [
      sku.status.padEnd(14),
      sku.sku.padEnd(22),
      `cover ${sku.daysOfCover === null ? '—' : sku.daysOfCover.toFixed(1)}`.padEnd(14),
      `raw ${sku.rawOrderQty.toFixed(1)}`.padEnd(12),
      `qty ${sku.suggestedQty}`,
      sku.stockoutDate ?? '',
    ].join(' '),
  );
}
console.log(
  `Shipment ${plan.purchaseOrder.totalUnits} units, known cost ${plan.purchaseOrder.knownCost.toFixed(2)} ${plan.currency}`,
);

const required = ['stockout-risk', 'reorder', 'covered', 'no-demand'];
const missing = required.filter((status) => (counts.get(status) ?? 0) === 0);
if (missing.length > 0) {
  console.error(`Sample plan is missing status: ${missing.join(', ')}`);
  process.exit(1);
}
