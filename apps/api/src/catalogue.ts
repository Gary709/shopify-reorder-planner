import { PlannerError, type StoreSnapshot } from '@tinyfab/core';
import { resolveDataSource } from './env.js';
import { loadPolicies } from './policies.js';
import { loadSampleSnapshot } from './sample.js';
import { fetchShopifySnapshot } from './shopify/client.js';

let cached: Promise<StoreSnapshot> | null = null;

export function loadSnapshot(refresh = false): Promise<StoreSnapshot> {
  if (refresh) cached = null;
  if (!cached) {
    cached = loadUncached().catch((error: unknown) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}

async function loadUncached(): Promise<StoreSnapshot> {
  let source: ReturnType<typeof resolveDataSource>;
  try {
    source = resolveDataSource();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Shopify configuration';
    throw new PlannerError(message, 500);
  }
  if (source.mode === 'sample') return loadSampleSnapshot();
  try {
    return await fetchShopifySnapshot(source, loadPolicies());
  } catch (error) {
    if (error instanceof PlannerError) throw error;
    const message = error instanceof Error ? error.message : 'Shopify request failed';
    throw new PlannerError(message, 502);
  }
}
