import { describe, expect, it } from 'vitest';
import { addDays, calendarDate, diffDays, enumerateDates, weekdayIndex } from '../src/dates.js';

describe('dates', () => {
  it('adds calendar days in UTC', () => {
    expect(addDays('2026-11-16', 45)).toBe('2026-12-31');
    expect(addDays('2026-11-16', -180)).toBe('2026-05-20');
    expect(diffDays('2026-05-20', '2026-11-16')).toBe(180);
  });

  it('enumerates a half-open range', () => {
    expect(enumerateDates('2026-11-14', '2026-11-16')).toEqual(['2026-11-14', '2026-11-15']);
  });

  it('knows the weekday of the sample planning date', () => {
    expect(weekdayIndex('2026-11-16')).toBe(1);
  });

  it('buckets instants in the shop timezone', () => {
    expect(calendarDate('2026-11-15T01:00:00.000Z', 'Australia/Sydney')).toBe('2026-11-15');
    expect(calendarDate('2026-11-15T14:00:00.000Z', 'Australia/Sydney')).toBe('2026-11-16');
    expect(calendarDate('2026-01-15T14:30:00.000Z', 'Australia/Sydney')).toBe('2026-01-16');
    expect(calendarDate('2026-11-15T01:00:00.000Z', 'UTC')).toBe('2026-11-15');
  });
});
