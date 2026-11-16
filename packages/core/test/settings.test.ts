import { describe, expect, it } from 'vitest';
import { PlannerError } from '../src/errors.js';
import { DEFAULT_SETTINGS, parseSettings } from '../src/settings.js';

describe('parseSettings', () => {
  it('fills defaults', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ leadTimeDays: '45', serviceLevel: '0.95' }).leadTimeDays).toBe(45);
  });

  it('rejects a lead time of zero and a service level at 50%', () => {
    expect(() => parseSettings({ leadTimeDays: 0 })).toThrow(PlannerError);
    expect(() => parseSettings({ serviceLevel: 0.5 })).toThrow(/serviceLevel/);
    expect(() => parseSettings({ lookbackDays: 10, movingAverageWindow: 28 })).toThrow(/lookback/);
  });

  it('treats an empty budget as no cap', () => {
    expect(parseSettings({ budgetCap: '' }).budgetCap).toBeNull();
    expect(parseSettings({ budgetCap: null }).budgetCap).toBeNull();
    expect(parseSettings({ budgetCap: 4000 }).budgetCap).toBe(4000);
  });
});
