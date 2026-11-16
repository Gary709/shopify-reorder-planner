const DAY_MS = 86_400_000;

export function assertIsoDate(isoDate: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Invalid calendar date ${isoDate}`);
  }
  const parsed = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== isoDate) {
    throw new Error(`Invalid calendar date ${isoDate}`);
  }
}

export function addDays(isoDate: string, days: number): string {
  assertIsoDate(isoDate);
  if (!Number.isInteger(days)) throw new Error('days must be an integer');
  const parsed = Date.parse(`${isoDate}T00:00:00Z`);
  return new Date(parsed + days * DAY_MS).toISOString().slice(0, 10);
}

export function diffDays(fromIso: string, toIso: string): number {
  assertIsoDate(fromIso);
  assertIsoDate(toIso);
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / DAY_MS);
}

/** Dates in [startInclusive, endExclusive). */
export function enumerateDates(startInclusive: string, endExclusive: string): string[] {
  assertIsoDate(startInclusive);
  assertIsoDate(endExclusive);
  const dates: string[] = [];
  let cursor = startInclusive;
  while (cursor < endExclusive) {
    dates.push(cursor);
    if (dates.length > 2000) throw new Error('date range is longer than 2000 days');
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/** 0 = Sunday … 6 = Saturday, UTC calendar date. */
export function weekdayIndex(isoDate: string): number {
  assertIsoDate(isoDate);
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

/** Calendar date of an instant in an IANA timezone, as YYYY-MM-DD. */
export function calendarDate(isoTimestamp: string, timeZone: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp ${isoTimestamp}`);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
  } catch {
    throw new Error(`Invalid timezone ${timeZone}`);
  }
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new Error(`Could not format ${isoTimestamp} in ${timeZone}`);
  return `${year}-${month}-${day}`;
}
