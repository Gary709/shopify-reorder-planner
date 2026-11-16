import type { SkuStatus } from '@tinyfab/core';

export const STATUS_LABEL: Record<SkuStatus, string> = {
  'stockout-risk': 'Stock-out risk',
  reorder: 'Reorder',
  covered: 'Covered',
  'no-demand': 'No demand',
  untracked: 'Not tracked',
};

const SWATCHES: Record<string, string> = {
  black: '#221e1a',
  white: '#f7f4ee',
  grey: '#8d8880',
  gray: '#8d8880',
  red: '#a33b32',
  blue: '#24598a',
  green: '#2f6b4a',
  clear: '#d5e3ea',
  gold: '#c6a15b',
  natural: '#e4d0b0',
};

export function colourSwatch(variantTitle: string): string | null {
  return SWATCHES[variantTitle.trim().toLowerCase()] ?? null;
}

export function money(amount: number | null, currency: string): string {
  if (amount === null || !Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

export function dayLabel(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function number(value: number | null, digits: number): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function units(value: number): string {
  return new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 }).format(value);
}
