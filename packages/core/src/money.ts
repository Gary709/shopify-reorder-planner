/** Currency amounts are carried in cents so carton maths does not drift. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error('amount must be finite');
  }
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}
