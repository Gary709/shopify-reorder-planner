import type { PlanResult, PlannerSettings } from '@tinyfab/core';

export async function fetchPlan(
  settings: PlannerSettings,
  signal: AbortSignal,
): Promise<PlanResult> {
  const response = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
    signal,
  });
  const body = (await response.json()) as PlanResult | { error?: string };
  if (!response.ok || !('skus' in body)) {
    const message =
      'error' in body && body.error ? body.error : `Planner responded ${response.status}`;
    throw new Error(message);
  }
  return body;
}
