import { describe, expect, it } from 'vitest';
import { addDays, enumerateDates, weekdayIndex } from '../src/dates.js';
import { fitDemandModel, forecastFromModel, projectLevel } from '../src/forecast.js';
import { mean } from '../src/stats.js';
import type { SeasonalIndex } from '../src/types.js';

const FLAT: SeasonalIndex = [1, 1, 1, 1, 1, 1, 1];

function startOnSunday(iso: string): string {
  let date = iso;
  while (weekdayIndex(date) !== 0) date = addDays(date, 1);
  return date;
}

describe('forecast', () => {
  it('forecasts a flat series at its moving average with no trend', () => {
    const asOf = '2026-11-16';
    const dates = enumerateDates(addDays(asOf, -28), asOf);
    const quantities = dates.map(() => 2);
    const model = fitDemandModel(dates, quantities, 28);
    expect(model.trailingMovingAverage).toBeCloseTo(2, 8);
    expect(model.trendPerDay).toBeCloseTo(0, 8);
    expect(model.residualStdev).toBeCloseTo(0, 8);
    expect(mean(model.seasonalIndex)).toBeCloseTo(1, 8);
    const forecast = forecastFromModel(model, asOf, 10);
    expect(forecast).toHaveLength(10);
    for (const value of forecast) expect(value).toBeCloseTo(2, 8);
  });

  it('uses only the trailing window for the reported moving average', () => {
    const asOf = '2026-11-16';
    const dates = enumerateDates(addDays(asOf, -30), asOf);
    const quantities = [...Array(20).fill(0), ...Array(10).fill(4)];
    const model = fitDemandModel(dates, quantities, 10);
    expect(model.trailingMovingAverage).toBe(4);
    expect(model.window).toBe(10);
  });

  it('puts a repeating weekday pattern back onto the forecast', () => {
    const historyStart = startOnSunday('2026-01-04');
    const dates = enumerateDates(historyStart, addDays(historyStart, 49));
    const quantities = dates.map((date) => (weekdayIndex(date) === 0 ? 0 : 10));
    const asOf = addDays(historyStart, 49);
    const model = fitDemandModel(dates, quantities, 49);
    expect(mean(model.seasonalIndex)).toBeCloseTo(1, 8);
    expect(model.seasonalIndex[0]).toBeCloseTo(0, 8);
    expect(model.trendPerDay).toBeCloseTo(0, 6);
    expect(model.residualStdev).toBeCloseTo(0, 6);
    const forecast = forecastFromModel(model, asOf, 7);
    expect(weekdayIndex(asOf)).toBe(0);
    expect(forecast[0]).toBeCloseTo(0, 6);
    expect(forecast[1]).toBeCloseTo(10, 6);
  });

  it('extends an explicit level and slope past the window', () => {
    const forecast = projectLevel({
      intercept: 0,
      slope: 1,
      window: 10,
      asOf: '2026-11-16',
      days: 3,
      seasonalIndex: FLAT,
    });
    expect(forecast.map((value) => Math.round(value * 1e9) / 1e9)).toEqual([10, 11, 12]);
  });

  it('does not let a short quiet patch zero out a steady seller', () => {
    const asOf = '2026-11-16';
    const dates = enumerateDates(addDays(asOf, -90), asOf);
    const quantities = dates.map((_, index) => (index < 80 ? 2 : 0));
    const model = fitDemandModel(dates, quantities, 28);
    const forecast = forecastFromModel(model, asOf, 45);
    expect(model.trailingMovingAverage).toBeCloseTo(36 / 28, 8);
    expect(forecast[0] ?? 0).toBeGreaterThan(0.5);
    expect(forecast[30] ?? 0).toBeGreaterThan(0.4);
  });

  it('estimates a positive slope on an increasing series', () => {
    const asOf = '2026-11-16';
    const dates = enumerateDates(addDays(asOf, -21), asOf);
    const quantities = dates.map((_, index) => index);
    const model = fitDemandModel(dates, quantities, 21);
    expect(model.trendPerDay).toBeGreaterThan(0);
    const forecast = forecastFromModel(model, asOf, 1);
    expect(forecast[0] ?? 0).toBeGreaterThan(mean(quantities));
  });

  it('returns zeros when there is no history', () => {
    const model = fitDemandModel([], [], 28);
    expect(forecastFromModel(model, '2026-11-16', 4)).toEqual([0, 0, 0, 0]);
    expect(model.residualStdev).toBe(0);
  });
});
