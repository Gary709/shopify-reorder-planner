import { describe, expect, it } from 'vitest';
import { mapOrders, mapProducts, mapShop } from '../src/shopify/map.js';

const product = {
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
                  { name: 'available', quantity: 4 },
                  { name: 'on_hand', quantity: 6 },
                  { name: 'committed', quantity: 1 },
                  { name: 'incoming', quantity: 0 },
                ],
              },
              {
                quantities: [
                  { name: 'available', quantity: 3 },
                  { name: 'on_hand', quantity: 3 },
                  { name: 'committed', quantity: 0 },
                  { name: 'incoming', quantity: 10 },
                ],
              },
            ],
          },
        },
      },
      {
        id: 'gid://shopify/ProductVariant/2',
        sku: '',
        title: 'Untracked',
        price: '10.00',
        inventoryItem: {
          tracked: false,
          unitCost: null,
          inventoryLevels: { pageInfo: { hasNextPage: false }, nodes: [] },
        },
      },
    ],
  },
};

describe('Shopify mapping', () => {
  it('reads shop identity', () => {
    expect(
      mapShop({
        data: { shop: { name: 'TinyFab', currencyCode: 'AUD', ianaTimezone: 'Australia/Sydney' } },
      }),
    ).toEqual({ name: 'TinyFab', currency: 'AUD', timeZone: 'Australia/Sydney' });
  });

  it('sums inventory across locations and keeps a blank SKU for the planner to skip', () => {
    const mapped = mapProducts([product]);
    const black = mapped.variants[0];
    expect(black).toMatchObject({
      sku: 'TF-PLA-BLK-1KG',
      unitCost: 9.5,
      unitPrice: 24,
      available: 7,
      onHand: 9,
      committed: 1,
      incoming: 10,
      inventoryTracked: true,
      moq: null,
      cartonSize: null,
    });
    expect(mapped.variants[1]).toMatchObject({ sku: '', inventoryTracked: false });
    expect(mapped.truncated).toEqual([]);
  });

  it('counts paid current quantities and drops cancelled, refunded, and removed lines', () => {
    const orders = mapOrders([
      {
        id: 'gid://shopify/Order/1',
        createdAt: '2026-11-01T01:00:00Z',
        cancelledAt: null,
        displayFinancialStatus: 'PAID',
        lineItems: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            { sku: 'TF-PLA-BLK-1KG', quantity: 4, currentQuantity: 3 },
            { sku: 'TF-PLA-WHT-1KG', quantity: 2, currentQuantity: 0 },
          ],
        },
      },
      {
        id: 'gid://shopify/Order/2',
        createdAt: '2026-11-02T01:00:00Z',
        cancelledAt: '2026-11-02T02:00:00Z',
        displayFinancialStatus: 'PAID',
        lineItems: {
          pageInfo: { hasNextPage: false },
          nodes: [{ sku: 'TF-PLA-BLK-1KG', quantity: 9, currentQuantity: 9 }],
        },
      },
      {
        id: 'gid://shopify/Order/3',
        createdAt: '2026-11-03T01:00:00Z',
        cancelledAt: null,
        displayFinancialStatus: 'REFUNDED',
        lineItems: {
          pageInfo: { hasNextPage: false },
          nodes: [{ sku: 'TF-PLA-BLK-1KG', quantity: 5, currentQuantity: 5 }],
        },
      },
    ]);
    expect(orders).toEqual([
      {
        id: 'gid://shopify/Order/1',
        createdAt: '2026-11-01T01:00:00Z',
        lineItems: [{ sku: 'TF-PLA-BLK-1KG', quantity: 3 }],
      },
    ]);
  });
});
