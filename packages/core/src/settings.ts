import { PlannerError } from './errors.js';
import type { PlannerSettings } from './types.js';

export const DEFAULT_SETTINGS: PlannerSettings = {
  leadTimeDays: 45,
  reviewPeriodDays: 45,
  serviceLevel: 0.95,
  movingAverageWindow: 28,
  lookbackDays: 120,
  horizonDays: 120,
  budgetCap: null,
  defaultMoq: 1,
  defaultCartonSize: 1,
  moqOverride: null,
  cartonSizeOverride: null,
};

export const STOCKOUT_SEARCH_DAYS = 366;

export function assertSettings(settings: PlannerSettings): void {
  integerInRange('leadTimeDays', settings.leadTimeDays, 1, 365);
  integerInRange('reviewPeriodDays', settings.reviewPeriodDays, 0, 365);
  integerInRange('movingAverageWindow', settings.movingAverageWindow, 7, 365);
  integerInRange('lookbackDays', settings.lookbackDays, 7, 730);
  integerInRange('horizonDays', settings.horizonDays, 14, 366);
  integerInRange('defaultMoq', settings.defaultMoq, 0, 100_000);
  integerInRange('defaultCartonSize', settings.defaultCartonSize, 1, 100_000);
  if (settings.lookbackDays < settings.movingAverageWindow) {
    throw new PlannerError('lookbackDays must be at least the moving-average window');
  }
  if (!(settings.serviceLevel > 0.5 && settings.serviceLevel <= 0.999)) {
    throw new PlannerError('serviceLevel must be greater than 0.5 and at most 0.999');
  }
  if (
    settings.budgetCap !== null &&
    !(Number.isFinite(settings.budgetCap) && settings.budgetCap >= 0)
  ) {
    throw new PlannerError('budgetCap must be null or a non-negative number');
  }
  optionalInteger('moqOverride', settings.moqOverride, 0, 100_000);
  optionalInteger('cartonSizeOverride', settings.cartonSizeOverride, 1, 100_000);
}

export function parseSettings(input: unknown): PlannerSettings {
  const record = asRecord(input);
  const settings: PlannerSettings = {
    leadTimeDays: readInteger(record, 'leadTimeDays', DEFAULT_SETTINGS.leadTimeDays),
    reviewPeriodDays: readInteger(record, 'reviewPeriodDays', DEFAULT_SETTINGS.reviewPeriodDays),
    serviceLevel: readNumber(record, 'serviceLevel', DEFAULT_SETTINGS.serviceLevel),
    movingAverageWindow: readInteger(
      record,
      'movingAverageWindow',
      DEFAULT_SETTINGS.movingAverageWindow,
    ),
    lookbackDays: readInteger(record, 'lookbackDays', DEFAULT_SETTINGS.lookbackDays),
    horizonDays: readInteger(record, 'horizonDays', DEFAULT_SETTINGS.horizonDays),
    budgetCap: readBudget(record),
    defaultMoq: readInteger(record, 'defaultMoq', DEFAULT_SETTINGS.defaultMoq),
    defaultCartonSize: readInteger(record, 'defaultCartonSize', DEFAULT_SETTINGS.defaultCartonSize),
    moqOverride: readOptionalInteger(record, 'moqOverride'),
    cartonSizeOverride: readOptionalInteger(record, 'cartonSizeOverride'),
  };
  assertSettings(settings);
  return settings;
}

function asRecord(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new PlannerError('settings must be an object');
  }
  return input as Record<string, unknown>;
}

function present(record: Record<string, unknown>, key: string): boolean {
  return key in record && record[key] !== undefined;
}

function readInteger(record: Record<string, unknown>, key: string, fallback: number): number {
  if (!present(record, key) || record[key] === null) return fallback;
  const value = readFinite(record[key], key);
  if (!Number.isInteger(value)) throw new PlannerError(`${key} must be an integer`);
  return value;
}

function readNumber(record: Record<string, unknown>, key: string, fallback: number): number {
  if (!present(record, key) || record[key] === null) return fallback;
  return readFinite(record[key], key);
}

function readOptionalInteger(record: Record<string, unknown>, key: string): number | null {
  if (!present(record, key) || record[key] === null || record[key] === '') return null;
  const value = readFinite(record[key], key);
  if (!Number.isInteger(value)) throw new PlannerError(`${key} must be an integer`);
  return value;
}

function readBudget(record: Record<string, unknown>): number | null {
  if (!present(record, 'budgetCap') || record.budgetCap === null || record.budgetCap === '') {
    return null;
  }
  const value = readFinite(record.budgetCap, 'budgetCap');
  if (value < 0) throw new PlannerError('budgetCap must be a non-negative number or null');
  return value;
}

function readFinite(value: unknown, key: string): number {
  const number =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(number)) throw new PlannerError(`${key} must be a number`);
  return number;
}

function integerInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new PlannerError(`${name} must be an integer from ${min} to ${max}`);
  }
}

function optionalInteger(name: string, value: number | null, min: number, max: number): void {
  if (value === null) return;
  integerInRange(name, value, min, max);
}
