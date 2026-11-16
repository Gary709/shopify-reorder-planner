import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { planStore, DEFAULT_SETTINGS } from '@tinyfab/core';
import { loadSampleSnapshot } from '../src/sample.js';
import { createApp } from '../src/server.js';

describe('synthetic sample', () => {
  it('is labelled synthetic and produces every planning status under the defaults', () => {
    const snapshot = loadSampleSnapshot();
    expect(snapshot.synthetic).toBe(true);
    expect(snapshot.disclaimer).toMatch(/SYNTHETIC/);
    expect(snapshot.shopName).toMatch(/sample/i);
    expect(snapshot.currency).toBe('AUD');
    const plan = planStore(snapshot, DEFAULT_SETTINGS);
    expect(plan.source).toBe('sample');
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

    const capped = planStore(snapshot, {
      ...DEFAULT_SETTINGS,
      budgetCap: Math.max(1, Math.round(plan.purchaseOrder.knownCost * 0.35)),
    });
    const reduced =
      capped.purchaseOrder.withheld.length > 0 ||
      capped.purchaseOrder.lines.some((line) => line.partial);
    expect(reduced).toBe(true);
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
