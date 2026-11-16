import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { planStore, DEFAULT_SETTINGS } from '@tinyfab/core';
import { loadSampleSnapshot } from '../src/sample.js';
import { createApp } from '../src/server.js';

describe('synthetic sample', () => {
  it('is labelled synthetic and produces every planning status under the defaults', () => {
    const snapshot = loadSampleSnapshot();
    expect(snapshot.synthetic).toBe(true);
    expect(snapshot.disclaimer).toMatch(/made-up/i);
    expect(snapshot.disclaimer).toMatch(/not TinyFab sales/i);
    expect(snapshot.shopName).toBe('TinyFab 3D');
    expect(snapshot.currency).toBe('AUD');
    const byType = new Map<string, number>();
    for (const variant of snapshot.variants) {
      byType.set(variant.productType, (byType.get(variant.productType) ?? 0) + 1);
    }
    expect(byType.get('PLA Basic')).toBe(14);
    expect(byType.get('PLA Matte')).toBe(7);
    expect(byType.get('PETG')).toBe(12);
    expect(byType.get('Pack')).toBe(1);
    const black = snapshot.variants.find((variant) => variant.sku === 'TF-PLA BASIC-1KG-BLACK');
    expect(black?.unitPrice).toBe(16.49);
    expect(black?.unitCost).toBeNull();
    expect(
      snapshot.variants.find((variant) => variant.sku === 'TF-PACK-ESSENTIAL')?.unitPrice,
    ).toBe(39.9);
    const plan = planStore(snapshot, DEFAULT_SETTINGS);
    expect(plan.source).toBe('sample');
    expect(plan.purchaseOrder.hasUnknownCost).toBe(true);
    const statuses = new Set(plan.skus.map((sku) => sku.status));
    expect(statuses.has('stockout-risk')).toBe(true);
    expect(statuses.has('reorder')).toBe(true);
    expect(statuses.has('covered')).toBe(true);
    expect(statuses.has('no-demand')).toBe(true);
    for (const sku of plan.skus) {
      expect(Number.isFinite(sku.reorderPoint)).toBe(true);
      expect(Number.isFinite(sku.forwardDailyVelocity)).toBe(true);
      if (sku.suggestedQty > 0) {
        expect(sku.suggestedQty).toBeGreaterThanOrEqual(sku.moq);
        expect(sku.suggestedQty % sku.cartonSize).toBe(0);
      }
      const seasonalMean = sku.seasonalIndex.reduce((sum, value) => sum + value, 0) / 7;
      expect(seasonalMean).toBeCloseTo(1, 6);
    }
    for (const line of plan.purchaseOrder.lines) {
      const sku = plan.skus.find((item) => item.sku === line.sku);
      expect(line.quantity).toBe(sku?.suggestedQty);
    }
    expect(plan.purchaseOrder.totalUnits).toBe(
      plan.purchaseOrder.lines.reduce((sum, line) => sum + line.quantity, 0),
    );
  });
});

describe('HTTP API', () => {
  let server: Server;
  let port = 0;

  beforeAll(async () => {
    delete process.env.SHOPIFY_STORE_DOMAIN;
    delete process.env.SHOPIFY_ADMIN_TOKEN;
    server = createApp().listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => {
      server.on('listening', () => resolve());
    });
    const address = server.address();
    port = typeof address === 'object' && address ? address.port : 0;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('serves the sample plan and rejects a zero lead time', async () => {
    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(await health.json()).toEqual({ ok: true });

    const response = await fetch(`http://127.0.0.1:${port}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadTimeDays: 45 }),
    });
    expect(response.status).toBe(200);
    const plan = (await response.json()) as { synthetic: boolean; skus: unknown[] };
    expect(plan.synthetic).toBe(true);
    expect(plan.skus.length).toBeGreaterThan(0);

    const rejected = await fetch(`http://127.0.0.1:${port}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadTimeDays: 0 }),
    });
    expect(rejected.status).toBe(400);
    const error = (await rejected.json()) as { error: string };
    expect(error.error).toMatch(/leadTimeDays/);
  });
});
