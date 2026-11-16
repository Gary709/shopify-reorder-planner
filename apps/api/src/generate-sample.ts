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

// Colours, SKUs and shelf prices are copied from tinyfab3d.com.au.
// Rates, stock and orders are invented so the sample still runs without a token.

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
  unitPrice: number;
  baseDailyRate: number;
  trendFraction: number;
  targetCoverDays: number | null;
  fixedAvailable?: number;
  committed: number;
  incoming: number;
  moq: number;
  cartonSize: number;
}

const PLA = 'TinyFab PLA Basic 1.75mm 1kg';
const MATTE = 'TinyFab PLA Matte Filament 1.75mm 1kg';
const PETG = 'TinyFab PETG Basic Filament 1.75mm 1kg';

const SPECS: Spec[] = [
  // PLA Basic, $16.49. SKUs are the ones on the shop, spaces included.
  colour('TF-PLA BASIC-1KG-BLACK', PLA, 'Black', 'PLA Basic', 16.49, 2.2, 0.3, 8, 2, 0),
  colour('TF-PLA BASIC-1KG-WHITE', PLA, 'White', 'PLA Basic', 16.49, 1.5, 0, 12, 1, 0),
  colour('TF-PLA BASIC-1KG-GREY', PLA, 'Grey', 'PLA Basic', 16.49, 1.1, 0, 14, 0, 0),
  colour('TF-PLA BASIC-1KG-ROYAL-BLUE', PLA, 'Royal Blue', 'PLA Basic', 16.49, 0.7, 0, 60, 0, 0),
  colour('TF-PLA-BASIC-1KG-RED', PLA, 'Red', 'PLA Basic', 16.49, 0.45, 0, 70, 0, 0),
  colour('TF-PLA BASIC-1KG-SKY-BLUE', PLA, 'Sky Blue', 'PLA Basic', 16.49, 0.25, 0, 220, 0, 0),
  colour('TF-PLA BASIC-1KG-GREEN', PLA, 'Green', 'PLA Basic', 16.49, 0.3, 0, 200, 0, 0),
  colour('TF-PLA BASIC-1KG-YELLOW', PLA, 'Yellow', 'PLA Basic', 16.49, 0.18, 0, 240, 0, 0),
  colour('TF-PLA BASIC-1KG-ORANGE', PLA, 'Orange', 'PLA Basic', 16.49, 0.16, 0, 260, 0, 0),
  colour('TF-PLA BASIC-1KG-PURPLE', PLA, 'Purple', 'PLA Basic', 16.49, 0.14, 0, 280, 0, 0),
  colour('TF-PLA BASIC-1KG-MINT', PLA, 'Mint', 'PLA Basic', 16.49, 0.12, 0, 300, 0, 0),
  colour('TF-PLA BASIC-1KG-BROWN', PLA, 'Brown', 'PLA Basic', 16.49, 0.1, 0, 320, 0, 0),
  colour('TF-PLA-BASIC-1KG-PINK', PLA, 'Pink', 'PLA Basic', 16.49, 0.2, 0, 180, 0, 0),
  colour('TF-PLA-BASIC-1KG-SKIN', PLA, 'Skin', 'PLA Basic', 16.49, 0.22, 0, 160, 0, 0),
  // PLA Matte, $17.99.
  colour('TF-PLA-MATTE-1KG-BLACK', MATTE, 'Black', 'PLA Matte', 17.99, 0.5, 0.1, 26, 0, 0),
  colour('TF-PLA-MATTE-1KG-GREY', MATTE, 'Grey', 'PLA Matte', 17.99, 0.22, 0, 85, 0, 0),
  colour('TF-PLA-MATTE-1KG-WHITE', MATTE, 'White', 'PLA Matte', 17.99, 0.2, 0, 200, 0, 0),
  colour('TF-PLA-MATTE-1KG-GREEN', MATTE, 'Green', 'PLA Matte', 17.99, 0.25, 0, 160, 0, 0),
  colour('TF-PLA-MATTE-1KG-RED', MATTE, 'Red', 'PLA Matte', 17.99, 0.1, 0, 260, 0, 0),
  colour('TF-PLA-MATTE-1KG-YELLOW', MATTE, 'Yellow', 'PLA Matte', 17.99, 0.08, 0, 300, 0, 0),
  colour('TF-PLA-MATTE-1KG-BROWN', MATTE, 'Brown', 'PLA Matte', 17.99, 0, 0, null, 0, 0, 18),
  // PETG Basic, $15.99.
  colour('TF-PETG-1KG-BLACK', PETG, 'Black', 'PETG', 15.99, 0.95, 0.25, 16, 0, 0),
  colour('TF-PETG-1KG-WHITE', PETG, 'White', 'PETG', 15.99, 0.55, 0, 40, 0, 10),
  colour('TF-PETG-1KG-BLUE', PETG, 'Blue', 'PETG', 15.99, 0.28, 0, 80, 0, 0),
  colour('TF-PETG-1KG-RED', PETG, 'Red', 'PETG', 15.99, 0.16, 0, 220, 0, 0),
  colour('TF-PETG-1KG-GREEN', PETG, 'Green', 'PETG', 15.99, 0.14, 0, 240, 0, 0),
  colour('TF-PETG-1KG-ORANGE', PETG, 'Orange', 'PETG', 15.99, 0.12, 0, 260, 0, 0),
  colour('TF-PETG-1KG-YELLOW', PETG, 'Yellow', 'PETG', 15.99, 0.1, 0, 280, 0, 0),
  colour('TF-PETG-1KG-SILVER', PETG, 'Silver', 'PETG', 15.99, 0.18, 0, 200, 0, 0),
  colour('TF-PETG-1KG-PURPLE', PETG, 'Purple', 'PETG', 15.99, 0.08, 0, 300, 0, 0),
  colour('TF-PETG-1KG-PINK', PETG, 'Pink', 'PETG', 15.99, 0.08, 0, 320, 0, 0),
  colour('TF-PETG-1KG-LAVENDER', PETG, 'Lavender', 'PETG', 15.99, 0.07, 0, 340, 0, 0),
  colour('TF-PETG-1KG-BROWN', PETG, 'Brown', 'PETG', 15.99, 0.22, 0, 160, 0, 0),
  // Live pack variants have no SKU. One line so the pack still shows up.
  colour(
    'TF-PACK-ESSENTIAL',
    'Essential Starter Pack',
    '3-spool mix',
    'Pack',
    39.9,
    0.12,
    0,
    200,
    0,
    0,
    undefined,
    1,
    1,
  ),
];

function colour(
  sku: string,
  productTitle: string,
  variantTitle: string,
  productType: string,
  unitPrice: number,
  baseDailyRate: number,
  trendFraction: number,
  targetCoverDays: number | null,
  committed: number,
  incoming: number,
  fixedAvailable?: number,
  moq = 10,
  cartonSize = 10,
): Spec {
  return {
    sku,
    productTitle,
    variantTitle,
    productType,
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
    unitCost: null,
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
  'Made-up sample, not TinyFab sales. Colour names, SKUs and shelf prices are from tinyfab3d.com.au. Stock on hand and every order here are invented. The starter pack line TF-PACK-ESSENTIAL is one SKU I added; the live pack variants have none.';

const snapshot: StoreSnapshot = {
  variants,
  orders,
  asOf: AS_OF,
  historyStart,
  timeZone: TIME_ZONE,
  source: 'sample',
  synthetic: true,
  disclaimer,
  shopName: 'TinyFab 3D',
  currency: 'AUD',
};

const plan = planStore(snapshot, DEFAULT_SETTINGS);
const counts = new Map<string, number>();
for (const sku of plan.skus) counts.set(sku.status, (counts.get(sku.status) ?? 0) + 1);

const document = {
  synthetic: true,
  label: 'Made-up sample. Not TinyFab sales.',
  disclaimer,
  shopName: snapshot.shopName,
  currency: snapshot.currency,
  timeZone: snapshot.timeZone,
  asOf: snapshot.asOf,
  historyStart: snapshot.historyStart,
  generator: {
    seed: SEED,
    note: 'baseDailyRate, trendFraction, weekday weights and targetCoverDays are knobs for the fake orders. Not shop figures.',
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
