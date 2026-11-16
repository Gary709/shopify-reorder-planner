import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type PlanResult, type PlannerSettings } from '@tinyfab/core';
import { fetchPlan } from './api';
import { Controls } from './components/Controls';
import { PurchaseOrder } from './components/PurchaseOrder';
import { SkuDetail } from './components/SkuDetail';
import { SkuTable } from './components/SkuTable';
import { dayLabel, money, units } from './format';

export function App() {
  const [settings, setSettings] = useState<PlannerSettings>(DEFAULT_SETTINGS);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetchPlan(settings, controller.signal)
        .then((next) => {
          setPlan(next);
          setError(null);
          setSelected((current) =>
            current && next.skus.some((sku) => sku.sku === current)
              ? current
              : (next.skus[0]?.sku ?? null),
          );
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'The planner did not respond.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [settings]);

  const selectedSku = plan?.skus.find((sku) => sku.sku === selected) ?? null;
  const atRisk = plan?.skus.filter((sku) => sku.status === 'stockout-risk').length ?? 0;

  return (
    <>
      <header className="mast">
        <div className="mast-inner">
          <div className="brand">
            <Spool />
            <div>
              <p className="eyebrow light">Sea-freight reorder planner</p>
              <h1>{plan?.shopName ?? 'Reorder planner'}</h1>
            </div>
          </div>
          <p className="mast-copy">
            {plan ? (
              <>
                <span>
                  {plan.historyDays} days from {dayLabel(plan.historyStart)}
                </span>
                <span>Planning date {dayLabel(plan.asOf)}</span>
                <span>Arrives {dayLabel(plan.arrivalDate)}</span>
              </>
            ) : (
              'Reading stock and order history.'
            )}
          </p>
        </div>
      </header>
      {plan ? (
        <div className={plan.synthetic ? 'banner synthetic' : 'banner live'} role="status">
          {plan.disclaimer}
        </div>
      ) : null}
      <main>
        <Controls
          settings={settings}
          currency={plan?.currency ?? 'AUD'}
          onChange={(next) => {
            setSettings((current) => (sameSettings(current, next) ? current : next));
          }}
        />
        {error ? <p className="banner error">{error}</p> : null}
        {loading && !plan ? <p className="loading">Building the plan…</p> : null}
        {plan ? (
          <>
            <section className="metrics" aria-label="Plan summary">
              <Metric label="Variants" value={units(plan.skus.length)} />
              <Metric label="At risk before arrival" value={units(atRisk)} />
              <Metric label="Units on this boat" value={units(plan.purchaseOrder.totalUnits)} />
              <Metric
                label={plan.purchaseOrder.hasUnknownCost ? 'Known shipment cost' : 'Shipment cost'}
                value={money(plan.purchaseOrder.knownCost, plan.currency)}
              />
            </section>
            {loading ? <p className="loading inline">Updating the plan…</p> : null}
            {plan.warnings.map((warning) => (
              <p key={warning} className="banner warn">
                {warning}
              </p>
            ))}
            {(plan.skippedWithoutSku > 0 ||
              plan.mergedDuplicateSkus > 0 ||
              plan.ignoredOrderUnits > 0) && (
              <p className="section-note catalogue-notes">
                {plan.skippedWithoutSku > 0
                  ? `${plan.skippedWithoutSku} variants had no SKU and were skipped. `
                  : ''}
                {plan.mergedDuplicateSkus > 0
                  ? `${plan.mergedDuplicateSkus} duplicate SKUs were merged. `
                  : ''}
                {plan.ignoredOrderUnits > 0
                  ? `${units(plan.ignoredOrderUnits)} ordered units had no matching SKU and were left out of velocity.`
                  : ''}
              </p>
            )}
            <div className="workspace">
              <SkuTable
                skus={plan.skus}
                currency={plan.currency}
                selected={selected}
                onSelect={setSelected}
              />
              {selectedSku ? (
                <SkuDetail plan={plan} sku={selectedSku} />
              ) : (
                <section className="card detail-card">
                  <p>No variants to plan.</p>
                </section>
              )}
            </div>
            <PurchaseOrder plan={plan} />
            <details className="assumptions">
              <summary>Assumptions in this plan</summary>
              <ul>
                {plan.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
              <p>
                Reorder point = lead-time demand + safety stock. Safety stock = z × daily residual σ
                × √days. The order-up-to level uses the lead time plus the review period. z for this
                plan is {plan.serviceLevelZ.toFixed(3)} at a{' '}
                {(plan.settings.serviceLevel * 100).toFixed(1)}% service level.
              </p>
            </details>
          </>
        ) : null}
      </main>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <h2>{label}</h2>
      <p>{value}</p>
    </article>
  );
}

function sameSettings(a: PlannerSettings, b: PlannerSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function Spool() {
  return (
    <svg className="spool" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="18" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M18 3.5v6.5M18 26v6.5M3.5 18h6.5M26 18h6.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
