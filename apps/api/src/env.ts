import { readFileSync, existsSync } from 'node:fs';
import { envPath } from './paths.js';

/** Load .env without overriding variables that are already set. Never logs values. */
export function loadEnvFile(file = envPath): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export interface ShopifySource {
  mode: 'shopify';
  domain: string;
  token: string;
  version: string;
  lookbackDays: number;
}

export interface SampleSource {
  mode: 'sample';
}

const PLACEHOLDER_DOMAINS = new Set(['your-store.myshopify.com', 'example.myshopify.com']);

/**
 * Both a real domain and a token are required. The placeholder domain in
 * .env.example stays on the synthetic sample even if a token was pasted.
 */
export function resolveDataSource(
  env: NodeJS.ProcessEnv = process.env,
): ShopifySource | SampleSource {
  const domain = (env.SHOPIFY_STORE_DOMAIN ?? '').trim();
  const token = (env.SHOPIFY_ADMIN_TOKEN ?? '').trim();
  if (!domain || !token || PLACEHOLDER_DOMAINS.has(domain)) return { mode: 'sample' };
  const version = (env.SHOPIFY_API_VERSION ?? '').trim() || '2026-10';
  const lookbackRaw = (env.SHOPIFY_ORDER_LOOKBACK_DAYS ?? '').trim() || '180';
  const lookbackDays = Number(lookbackRaw);
  if (!/^\d{4}-\d{2}$|^unstable$/.test(version)) {
    throw new Error('SHOPIFY_API_VERSION must look like 2026-10');
  }
  if (!Number.isInteger(lookbackDays) || lookbackDays < 7 || lookbackDays > 730) {
    throw new Error('SHOPIFY_ORDER_LOOKBACK_DAYS must be an integer from 7 to 730');
  }
  return { mode: 'shopify', domain, token, version, lookbackDays };
}

export function shopifyGraphqlUrl(domain: string, version: string): string {
  const host = domain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(host)) {
    throw new Error('SHOPIFY_STORE_DOMAIN is not a valid hostname');
  }
  return `https://${host}/admin/api/${version}/graphql.json`;
}
