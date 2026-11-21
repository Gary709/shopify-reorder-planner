import { addDays, weekdayIndex } from './dates.js';
import { mean, ordinaryLeastSquares, sampleStdev, trailingMean } from './stats.js';
import type { SeasonalIndex } from './types.js';

const MIN_SEASON = 1e-6;

export interface DemandModel {
  observations: number;
  window: number;
  trailingMovingAverage: number;
  deseasonalizedMovingAverage: number;
  trendPerDay: number;
  intercept: number;
  seasonalIndex: SeasonalIndex;
  residualStdev: number;
}

const FLAT_SEASON: SeasonalIndex = [1, 1, 1, 1, 1, 1, 1];

// Level is the recent deseasonalised average. Slope is fit on the whole lookback
// so one quiet month is not drawn out across the 45-day boat. A near-zero weekday
// factor is replaced by the overall mean so it does not blow up the series.
export function fitDemandModel(
  dates: readonly string[],
  quantities: readonly number[],
  window: number,
): DemandModel {
  if (dates.length !== quantities.length) {
    throw new Error('demand dates and quantities must be the same length');
  }
  const observations = quantities.length;
  if (observations === 0) {
    return {
      observations: 0,
      window: 0,
      trailingMovingAverage: 0,
      deseasonalizedMovingAverage: 0,
      trendPerDay: 0,
      intercept: 0,
      seasonalIndex: FLAT_SEASON,
      residualStdev: 0,
    };
  }

  const seasonalIndex = fitSeasonalIndex(dates, quantities);
  const overall = mean(quantities);
  const deseasonalized = quantities.map((quantity, index) => {
    const date = dates[index];
    const factor = date === undefined ? 1 : factorFor(seasonalIndex, weekdayIndex(date));
    if (factor < MIN_SEASON) return overall;
    return quantity / factor;
  });

  const used = Math.min(Math.max(window, 1), observations);
  const levelSlice = deseasonalized.slice(-used);
  const level = mean(levelSlice);
  const trend = ordinaryLeastSquares(deseasonalized).slope;
  const centre = observations - (used + 1) / 2;
  const residuals: number[] = [];
  for (let index = observations - used; index < observations; index += 1) {
    const date = dates[index];
    const actual = quantities[index] ?? 0;
    const factor = date === undefined ? 1 : factorFor(seasonalIndex, weekdayIndex(date));
    const rawFit = Math.max(0, level + trend * (index - centre)) * factor;
    residuals.push(actual - rawFit);
  }

  return {
    observations,
    window: used,
    trailingMovingAverage: trailingMean(quantities, used),
    deseasonalizedMovingAverage: level,
    trendPerDay: trend,
    intercept: level,
    seasonalIndex,
    residualStdev: sampleStdev(residuals),
  };
}

// Index 0 is the planning date. History is assumed to end the day before.
export function forecastFromModel(model: DemandModel, asOf: string, days: number): number[] {
  if (model.window <= 0) return Array.from({ length: days }, () => 0);
  const forecasts: number[] = [];
  const fromCentre = (model.window + 1) / 2;
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(asOf, offset);
    const level = Math.max(
      0,
      model.deseasonalizedMovingAverage + model.trendPerDay * (fromCentre + offset),
    );
    forecasts.push(level * factorFor(model.seasonalIndex, weekdayIndex(date)));
  }
  return forecasts;
}

export function projectLevel(args: {
  intercept: number;
  slope: number;
  window: number;
  asOf: string;
  days: number;
  seasonalIndex: SeasonalIndex;
}): number[] {
  const forecasts: number[] = [];
  for (let offset = 0; offset < args.days; offset += 1) {
    const date = addDays(args.asOf, offset);
    const x = args.window + offset;
    const level = Math.max(0, args.intercept + args.slope * x);
    forecasts.push(level * factorFor(args.seasonalIndex, weekdayIndex(date)));
  }
  return forecasts;
}

export function sumFirst(values: readonly number[], count: number): number {
  const limit = Math.min(count, values.length);
  let sum = 0;
  for (let index = 0; index < limit; index += 1) sum += values[index] ?? 0;
  return sum;
}

function fitSeasonalIndex(dates: readonly string[], quantities: readonly number[]): SeasonalIndex {
  const overall = mean(quantities);
  if (overall <= 1e-12) return FLAT_SEASON;
  const sums = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let index = 0; index < quantities.length; index += 1) {
    const date = dates[index];
    if (date === undefined) continue;
    const weekday = weekdayIndex(date);
    sums[weekday] = (sums[weekday] ?? 0) + (quantities[index] ?? 0);
    counts[weekday] = (counts[weekday] ?? 0) + 1;
  }
  const raw: number[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const count = counts[weekday] ?? 0;
    const sum = sums[weekday] ?? 0;
    raw.push(count === 0 ? 1 : sum / count / overall);
  }
  const rawMean = mean(raw);
  if (rawMean <= 1e-12) return FLAT_SEASON;
  return [
    (raw[0] ?? 1) / rawMean,
    (raw[1] ?? 1) / rawMean,
    (raw[2] ?? 1) / rawMean,
    (raw[3] ?? 1) / rawMean,
    (raw[4] ?? 1) / rawMean,
    (raw[5] ?? 1) / rawMean,
    (raw[6] ?? 1) / rawMean,
  ];
}

function factorFor(index: SeasonalIndex, weekday: number): number {
  return index[weekday] ?? 1;
}
