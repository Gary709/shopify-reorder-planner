import { describe, expect, it } from 'vitest';
import { resolveDataSource, shopifyGraphqlUrl } from '../src/env.js';

describe('Shopify source selection', () => {
  it('stays on the sample when credentials are missing or still the example placeholder', () => {
    expect(resolveDataSource({}).mode).toBe('sample');
    expect(resolveDataSource({ SHOPIFY_STORE_DOMAIN: 'tiny.myshopify.com' }).mode).toBe('sample');
    expect(resolveDataSource({ SHOPIFY_ADMIN_TOKEN: 'shpat_example' }).mode).toBe('sample');
    expect(
      resolveDataSource({
        SHOPIFY_STORE_DOMAIN: 'your-store.myshopify.com',
        SHOPIFY_ADMIN_TOKEN: 'shpat_example',
      }).mode,
    ).toBe('sample');
  });

  it('uses Shopify only when both a real domain and a token are set', () => {
    const source = resolveDataSource({
      SHOPIFY_STORE_DOMAIN: 'https://tinyfab.myshopify.com/admin',
      SHOPIFY_ADMIN_TOKEN: 'shpat_real',
      SHOPIFY_API_VERSION: '2026-10',
      SHOPIFY_ORDER_LOOKBACK_DAYS: '90',
    });
    expect(source).toMatchObject({
      mode: 'shopify',
      domain: 'https://tinyfab.myshopify.com/admin',
      token: 'shpat_real',
      version: '2026-10',
      lookbackDays: 90,
    });
  });

  it('builds an Admin GraphQL URL and rejects a bad host', () => {
    expect(shopifyGraphqlUrl('https://tinyfab.myshopify.com/', '2026-10')).toBe(
      'https://tinyfab.myshopify.com/admin/api/2026-10/graphql.json',
    );
    expect(() => shopifyGraphqlUrl('not a host', '2026-10')).toThrow(/hostname/);
    expect(() =>
      resolveDataSource({
        SHOPIFY_STORE_DOMAIN: 'tinyfab.myshopify.com',
        SHOPIFY_ADMIN_TOKEN: 'shpat_real',
        SHOPIFY_API_VERSION: 'latest',
      }),
    ).toThrow(/API_VERSION/);
  });
});
