import { describe, expect, it } from 'vitest';
import { fetchShopifySnapshot } from '../src/shopify/client.js';
import { SHOPIFY_QUERIES } from '../src/shopify/queries.js';

interface Call {
  url: string;
  token: string | null;
  query: string;
  variables: Record<string, unknown>;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Shopify client', () => {
  it('only declares read queries', () => {
    expect(SHOPIFY_QUERIES.length).toBeGreaterThanOrEqual(4);
    for (const query of SHOPIFY_QUERIES) {
      expect(query.toLowerCase()).not.toContain('mutation');
      expect(query).toMatch(/\bquery\b/);
    }
  });

  it('paginates products and order lines and does not put the token in the URL', async () => {
    const calls: Call[] = [];
    let productPage = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        query: string;
        variables: Record<string, unknown>;
      };
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        token: headers.get('X-Shopify-Access-Token'),
        query: body.query,
        variables: body.variables,
      });
      if (body.query.includes('PlannerShop')) {
        return json({
          data: {
            shop: {
              name: 'TinyFab 3D',
              currencyCode: 'AUD',
              ianaTimezone: 'Australia/Sydney',
              myshopifyDomain: 'tinyfab.myshopify.com',
            },
          },
        });
      }
      if (body.query.includes('PlannerProducts')) {
        productPage += 1;
        const hasNextPage = productPage === 1;
        return json({
          data: {
            products: {
              pageInfo: { hasNextPage, endCursor: hasNextPage ? 'cursor-2' : null },
              nodes:
                productPage === 1
                  ? [
                      {
                        id: 'gid://shopify/Product/1',
                        title: 'PLA 1kg',
                        productType: 'PLA',
                        variants: {
                          pageInfo: { hasNextPage: false },
                          nodes: [
                            {
                              id: 'gid://shopify/ProductVariant/1',
                              sku: 'TF-PLA-BLK-1KG',
                              title: 'Black',
                              price: '24.00',
                              inventoryItem: {
                                tracked: true,
                                unitCost: { amount: '9.50' },
                                inventoryLevels: {
                                  pageInfo: { hasNextPage: false },
                                  nodes: [
                                    {
                                      quantities: [
                                        { name: 'available', quantity: 8 },
                                        { name: 'on_hand', quantity: 8 },
                                        { name: 'committed', quantity: 0 },
                                        { name: 'incoming', quantity: 0 },
                                      ],
                                    },
                                  ],
                                },
                              },
                            },
                          ],
                        },
                      },
                    ]
                  : [],
            },
          },
        });
      }
      if (body.query.includes('PlannerOrders')) {
        return json({
          data: {
            orders: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  id: 'gid://shopify/Order/9',
                  createdAt: '2026-11-15T01:00:00Z',
                  cancelledAt: null,
                  displayFinancialStatus: 'PAID',
                  lineItems: {
                    pageInfo: { hasNextPage: true, endCursor: 'line-2' },
                    nodes: [{ sku: 'TF-PLA-BLK-1KG', quantity: 1, currentQuantity: 1 }],
                  },
                },
              ],
            },
          },
        });
      }
      if (body.query.includes('PlannerOrderLines')) {
        return json({
          data: {
            order: {
              lineItems: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{ sku: 'TF-PLA-BLK-1KG', quantity: 2, currentQuantity: 2 }],
              },
            },
          },
        });
      }
      throw new Error(`unexpected query ${body.query.slice(0, 40)}`);
    };

    const snapshot = await fetchShopifySnapshot(
      {
        mode: 'shopify',
        domain: 'tinyfab.myshopify.com',
        token: 'shpat_secret',
        version: '2026-10',
        lookbackDays: 180,
      },
      { 'TF-PLA-BLK-1KG': { moq: 20, cartonSize: 10 } },
      { fetchImpl, now: new Date('2026-11-15T20:00:00Z') },
    );

    expect(snapshot.asOf).toBe('2026-11-16');
    expect(snapshot.historyStart).toBe('2026-05-20');
    expect(snapshot.synthetic).toBe(false);
    expect(snapshot.currency).toBe('AUD');
    expect(snapshot.variants[0]).toMatchObject({ sku: 'TF-PLA-BLK-1KG', moq: 20, cartonSize: 10 });
    expect(snapshot.orders[0]?.lineItems.map((line) => line.quantity)).toEqual([1, 2]);
    expect(calls.map((call) => call.url)).toEqual([
      'https://tinyfab.myshopify.com/admin/api/2026-10/graphql.json',
      'https://tinyfab.myshopify.com/admin/api/2026-10/graphql.json',
      'https://tinyfab.myshopify.com/admin/api/2026-10/graphql.json',
      'https://tinyfab.myshopify.com/admin/api/2026-10/graphql.json',
      'https://tinyfab.myshopify.com/admin/api/2026-10/graphql.json',
    ]);
    expect(calls.every((call) => call.token === 'shpat_secret')).toBe(true);
    expect(calls.every((call) => !call.url.includes('shpat_secret'))).toBe(true);
    expect(calls[2]?.variables.cursor).toBe('cursor-2');
    const orderCall = calls.find((call) => call.query.includes('PlannerOrders'));
    expect(String(orderCall?.variables.query)).toContain("created_at:>='2026-05-18T00:00:00Z'");
    expect(String(orderCall?.variables.query)).toContain('-status:cancelled');
  });

  it('surfaces a GraphQL error without calling it a sample', async () => {
    const fetchImpl: typeof fetch = async () => json({ errors: [{ message: 'invalid API key' }] });
    await expect(
      fetchShopifySnapshot(
        {
          mode: 'shopify',
          domain: 'tinyfab.myshopify.com',
          token: 'shpat_secret',
          version: '2026-10',
          lookbackDays: 30,
        },
        {},
        { fetchImpl, now: new Date('2026-11-16T00:00:00Z') },
      ),
    ).rejects.toThrow(/invalid API key/);
  });
});
