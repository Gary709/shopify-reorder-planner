import { readFileSync, existsSync } from 'node:fs';
import { PlannerError } from '@tinyfab/core';
import { policiesPath } from './paths.js';

export interface SkuPolicy {
  moq: number;
  cartonSize: number;
}

export function parsePolicies(value: unknown): Record<string, SkuPolicy> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PlannerError('sku-policies.json must be an object keyed by SKU', 500);
  }
  const policies: Record<string, SkuPolicy> = {};
  for (const [sku, raw] of Object.entries(value)) {
    if (typeof raw !== 'object' || raw === null) {
      throw new PlannerError(`Policy for ${sku} must be an object`, 500);
    }
    const record = raw as Record<string, unknown>;
    const moq = record.moq;
    const cartonSize = record.cartonSize;
    if (!Number.isInteger(moq) || (moq as number) < 0) {
      throw new PlannerError(`Policy for ${sku} has an invalid MOQ`, 500);
    }
    if (!Number.isInteger(cartonSize) || (cartonSize as number) < 1) {
      throw new PlannerError(`Policy for ${sku} has an invalid carton size`, 500);
    }
    policies[sku] = { moq: moq as number, cartonSize: cartonSize as number };
  }
  return policies;
}

export function loadPolicies(file = policiesPath): Record<string, SkuPolicy> {
  if (!existsSync(file)) return {};
  return parsePolicies(JSON.parse(readFileSync(file, 'utf8')) as unknown);
}

export function applyPolicies<
  T extends { sku: string; moq: number | null; cartonSize: number | null },
>(variants: T[], policies: Record<string, SkuPolicy>): T[] {
  return variants.map((variant) => {
    const policy = policies[variant.sku];
    if (!policy) return variant;
    return { ...variant, moq: policy.moq, cartonSize: policy.cartonSize };
  });
}
