export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** Sample standard deviation (divisor n − 1). Returns 0 when n < 2. */
export function sampleStdev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const center = mean(values);
  let sumSquares = 0;
  for (const value of values) {
    const delta = value - center;
    sumSquares += delta * delta;
  }
  return Math.sqrt(sumSquares / (values.length - 1));
}

export function trailingMean(values: readonly number[], window: number): number {
  if (values.length === 0 || window <= 0) return 0;
  const slice = values.slice(-window);
  return mean(slice);
}

// y against x = 0, 1, …, n−1.
export function ordinaryLeastSquares(values: readonly number[]): {
  intercept: number;
  slope: number;
} {
  const n = values.length;
  if (n === 0) return { intercept: 0, slope: 0 };
  if (n === 1) return { intercept: values[0] ?? 0, slope: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i += 1) {
    const y = values[i] ?? 0;
    sumX += i;
    sumY += y;
    sumXX += i * i;
    sumXY += i * y;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { intercept: sumY / n, slope: 0 };
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { intercept, slope };
}

/**
 * Inverse CDF of the standard normal distribution.
 * Peter J. Acklam's rational approximation (public domain).
 * Relative error is about 1e-9 across (0, 1).
 */
const ACKLAM_A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
  -3.066479806614716e1, 2.506628277459239,
] as const;

const ACKLAM_B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
  -1.328068155288572e1,
] as const;

const ACKLAM_C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
  4.374664141464968, 2.938163982698783,
] as const;

const ACKLAM_D = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
] as const;

function horner(coefficients: readonly number[], x: number): number {
  let acc = 0;
  for (const coefficient of coefficients) {
    acc = acc * x + coefficient;
  }
  return acc;
}

export function normalQuantile(probability: number): number {
  if (!(probability > 0 && probability < 1)) {
    throw new Error('probability must be between 0 and 1');
  }
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (probability < plow) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return horner(ACKLAM_C, q) / (horner(ACKLAM_D, q) * q + 1);
  }
  if (probability > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - probability));
    return -horner(ACKLAM_C, q) / (horner(ACKLAM_D, q) * q + 1);
  }
  const q = probability - 0.5;
  const r = q * q;
  return (horner(ACKLAM_A, r) * q) / (horner(ACKLAM_B, r) * r + 1);
}
