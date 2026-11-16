import type { SkuStatus } from '@tinyfab/core';

export const STATUS_LABEL: Record<SkuStatus, string> = {
  'stockout-risk': 'Runs out',
  reorder: 'Order',
  covered: 'OK',
  'no-demand': 'No sales',
  untracked: 'Not tracked',
};

const SWATCHES: Record<string, string> = {
  black: '#221e1a',
  white: '#f7f4ee',
  grey: '#8d8880',
  gray: '#8d8880',
  red: '#a33b32',
  blue: '#24598a',
  'royal blue': '#1d4e89',
  'sky blue': '#7eb6d9',
  green: '#2f6b4a',
  mint: '#b7ddd0',
  orange: '#e07a2f',
  purple: '#6b4c9a',
  pink: '#e7a0b4',
  skin: '#e6c4a8',
  yellow: '#e3c04d',
  brown: '#6b4423',
  lavender: '#c9b6dc',
  silver: '#c5c8cc',
};

const LIGHT = new Set([
  'white',
  'skin',
  'yellow',
  'mint',
  'silver',
  'lavender',
  'pink',
  'sky blue',
]);

export function swatchNeedsBorder(variantTitle: string): boolean {
  return LIGHT.has(variantTitle.trim().toLowerCase());
}

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
