import { describe, expect, it } from 'vitest';
import { toCents } from '../src/money.js';
import {
  mean,
  normalQuantile,
  ordinaryLeastSquares,
  sampleStdev,
  trailingMean,
} from '../src/stats.js';

describe('stats', () => {
  it('averages values', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBe(0);
  });

  it('uses the sample standard deviation', () => {
    expect(sampleStdev([2, 2, 2])).toBe(0);
    expect(sampleStdev([1])).toBe(0);
    // Population of [1, 3] would be 1; sample divisor n-1 gives sqrt(2).
    expect(sampleStdev([1, 3])).toBeCloseTo(Math.sqrt(2), 10);
  });

  it('takes the trailing mean of the window only', () => {
    const values = [...Array(15).fill(0), ...Array(5).fill(4)];
    expect(trailingMean(values, 5)).toBe(4);
  });

  it('recovers a straight line', () => {
    const values = Array.from({ length: 8 }, (_, index) => 2 + 3 * index);
    const fit = ordinaryLeastSquares(values);
    expect(fit.intercept).toBeCloseTo(2, 10);
    expect(fit.slope).toBeCloseTo(3, 10);
  });

  it('matches published standard-normal quantiles', () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 8);
    expect(normalQuantile(0.9)).toBeCloseTo(1.2815515655, 8);
    expect(normalQuantile(0.95)).toBeCloseTo(1.644853627, 8);
    expect(normalQuantile(0.975)).toBeCloseTo(1.9599639845, 8);
    expect(normalQuantile(0.99)).toBeCloseTo(2.326347874, 8);
    expect(normalQuantile(0.01)).toBeCloseTo(-2.326347874, 8);
  });

  it('rejects probabilities outside (0, 1)', () => {
    expect(() => normalQuantile(0)).toThrow(/between 0 and 1/);
    expect(() => normalQuantile(1)).toThrow(/between 0 and 1/);
  });

  it('rounds money to cents', () => {
    expect(toCents(9.8)).toBe(980);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
});
