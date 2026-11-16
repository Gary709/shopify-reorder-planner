import { addDays, diffDays } from './dates.js';
import { PlannerError } from './errors.js';
import type { ProjectionPoint } from './types.js';

export function safetyStock(z: number, residualStdev: number, days: number): number {
  if (days <= 0 || residualStdev <= 0 || z <= 0) return 0;
  return z * residualStdev * Math.sqrt(days);
}

export function daysOfCover(available: number, dailyVelocity: number): number | null {
  if (!(dailyVelocity > 1e-9)) return null;
  return available / dailyVelocity;
}

// Zero stays zero. A positive gap rounds up to the MOQ, then to a full box.
export function roundOrderQuantity(raw: number, moq: number, cartonSize: number): number {
  if (!Number.isFinite(raw)) throw new PlannerError('raw order quantity must be finite');
  if (raw <= 1e-6) return 0;
  if (!Number.isInteger(cartonSize) || cartonSize < 1) {
    throw new PlannerError('cartonSize must be a positive integer');
  }
  if (!Number.isInteger(moq) || moq < 0) {
    throw new PlannerError('moq must be a non-negative integer');
  }
  const needed = Math.max(raw, moq);
  return Math.ceil(needed / cartonSize) * cartonSize;
}

export interface StockProjection {
  points: ProjectionPoint[];
  stockoutDate: string | null;
  stockoutBeforeArrival: boolean;
}

// Incoming and the new order land at the start of the lead-time day. No backorders.
export function projectStock(args: {
  asOf: string;
  available: number;
  incoming: number;
  orderQty: number;
  leadTimeDays: number;
  forecast: readonly number[];
}): StockProjection {
  let without = Math.max(0, args.available);
  let withOrder = Math.max(0, args.available);
  let stockoutDate: string | null = args.available < -1e-9 ? args.asOf : null;
  const points: ProjectionPoint[] = [];

  for (let offset = 0; offset < args.forecast.length; offset += 1) {
    const date = addDays(args.asOf, offset);
    const demand = Math.max(0, args.forecast[offset] ?? 0);
    if (offset === args.leadTimeDays) {
      without += Math.max(0, args.incoming);
      withOrder += Math.max(0, args.incoming) + Math.max(0, args.orderQty);
    }
    if (stockoutDate === null && demand > without + 1e-9) stockoutDate = date;
    without = Math.max(0, without - demand);
    withOrder = Math.max(0, withOrder - demand);
    points.push({ date, demand, withoutOrder: without, withOrder });
  }

  const stockoutBeforeArrival =
    stockoutDate !== null && diffDays(args.asOf, stockoutDate) < args.leadTimeDays;

  return { points, stockoutDate, stockoutBeforeArrival };
}
