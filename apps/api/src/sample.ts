import { readFileSync } from 'node:fs';
import {
  PlannerError,
  type OrderInput,
  type StoreSnapshot,
  type VariantInput,
} from '@tinyfab/core';
import { applyPolicies, loadPolicies, type SkuPolicy } from './policies.js';
import { sampleStorePath } from './paths.js';

interface SampleFile {
  synthetic?: boolean;
  disclaimer?: string;
  shopName?: string;
  currency?: string;
  timeZone?: string;
  asOf?: string;
  historyStart?: string;
  variants?: VariantInput[];
  orders?: OrderInput[];
}

export function snapshotFromSample(
  raw: SampleFile,
  policies: Record<string, SkuPolicy> = {},
): StoreSnapshot {
  if (raw.synthetic !== true || !raw.disclaimer || !/SYNTHETIC/i.test(raw.disclaimer)) {
    throw new PlannerError(
      'Bundled sample catalogue is not labelled synthetic. Refusing to load it.',
      500,
    );
  }
  if (!raw.asOf || !raw.historyStart || !raw.timeZone || !raw.currency || !raw.shopName) {
    throw new PlannerError('Sample catalogue is missing planning dates or shop fields.', 500);
  }
  if (!Array.isArray(raw.variants) || !Array.isArray(raw.orders)) {
    throw new PlannerError('Sample catalogue is missing variants or orders.', 500);
  }
  return {
    variants: applyPolicies(raw.variants, policies),
    orders: raw.orders,
    asOf: raw.asOf,
    historyStart: raw.historyStart,
    timeZone: raw.timeZone,
    source: 'sample',
    synthetic: true,
    disclaimer: raw.disclaimer,
    shopName: raw.shopName,
    currency: raw.currency,
  };
}

export function loadSampleSnapshot(): StoreSnapshot {
  const raw = JSON.parse(readFileSync(sampleStorePath, 'utf8')) as SampleFile;
  return snapshotFromSample(raw, loadPolicies());
}
