import { describe, expect, it } from 'vitest';
import { daysOfCover, projectStock, roundOrderQuantity, safetyStock } from '../src/reorder.js';
import { normalQuantile } from '../src/stats.js';

describe('reorder maths', () => {
  it('computes service-level safety stock', () => {
    const z = normalQuantile(0.95);
    expect(safetyStock(z, 2, 45)).toBeCloseTo(z * 2 * Math.sqrt(45), 10);
    expect(safetyStock(z, 0, 45)).toBe(0);
    expect(safetyStock(z, 2, 0)).toBe(0);
  });

  it('leaves days of cover empty when velocity is zero', () => {
    expect(daysOfCover(12, 2)).toBe(6);
    expect(daysOfCover(12, 0)).toBeNull();
    expect(daysOfCover(-3, 1)).toBe(-3);
  });

  it('rounds up to MOQ and carton size, and does not order a zero gap', () => {
    expect(roundOrderQuantity(0, 20, 10)).toBe(0);
    expect(roundOrderQuantity(-4, 20, 10)).toBe(0);
    expect(roundOrderQuantity(15, 20, 10)).toBe(20);
    expect(roundOrderQuantity(21, 20, 10)).toBe(30);
    expect(roundOrderQuantity(20, 20, 10)).toBe(20);
    expect(roundOrderQuantity(25, 25, 10)).toBe(30);
    expect(roundOrderQuantity(0.2, 0, 5)).toBe(5);
  });

  it('projects a stock-out and clamps the path at zero', () => {
    const projection = projectStock({
      asOf: '2026-11-16',
      available: 5,
      incoming: 0,
      orderQty: 0,
      leadTimeDays: 10,
      forecast: [2, 2, 2, 2, 2],
    });
    expect(projection.stockoutDate).toBe('2026-11-18');
    expect(projection.stockoutBeforeArrival).toBe(true);
    expect(projection.points.map((point) => point.withoutOrder)).toEqual([3, 1, 0, 0, 0]);
  });

  it('lets incoming that arrives on the lead-time morning cover that day', () => {
    const saved = projectStock({
      asOf: '2026-11-16',
      available: 5,
      incoming: 10,
      orderQty: 0,
      leadTimeDays: 2,
      forecast: [2, 2, 2, 2],
    });
    expect(saved.stockoutDate).toBeNull();
    expect(saved.points[2]?.withoutOrder).toBeCloseTo(9, 8);

    const late = projectStock({
      asOf: '2026-11-16',
      available: 5,
      incoming: 10,
      orderQty: 4,
      leadTimeDays: 3,
      forecast: [2, 2, 2, 2],
    });
    expect(late.stockoutDate).toBe('2026-11-18');
    expect(late.stockoutBeforeArrival).toBe(true);
    expect(late.points[3]?.withoutOrder).toBeCloseTo(8, 8);
    expect(late.points[3]?.withOrder).toBeCloseTo(12, 8);
  });

  it('treats an oversold variant as already stocked out', () => {
    const projection = projectStock({
      asOf: '2026-11-16',
      available: -2,
      incoming: 0,
      orderQty: 0,
      leadTimeDays: 45,
      forecast: [0, 0, 0],
    });
    expect(projection.stockoutDate).toBe('2026-11-16');
    expect(projection.stockoutBeforeArrival).toBe(true);
  });
});
