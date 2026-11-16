import type { PlanResult, SkuPlan } from '@tinyfab/core';
import { dayLabel, money, number, units } from '../format';
import { ProjectionChart } from './ProjectionChart';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function SkuDetail({ plan, sku }: { plan: PlanResult; sku: SkuPlan }) {
  const maxSeason = Math.max(0.01, ...sku.seasonalIndex);
  return (
    <section className="card detail-card" aria-label={`Detail for ${sku.sku}`}>
      <header className="detail-head">
        <p className="eyebrow">{sku.productType}</p>
        <h2>
          {sku.productTitle}
          <span> · {sku.variantTitle}</span>
        </h2>
        <p className="sku-code">{sku.sku}</p>
      </header>
      {sku.stockoutBeforeArrival ? (
        <p className="callout">
          Projected to reach zero on {dayLabel(sku.stockoutDate)}, before a shipment placed today
          would arrive on {dayLabel(plan.arrivalDate)}. Quantity on this boat restocks the period
          after arrival. It does not replace sales lost while the freight is at sea.
        </p>
      ) : null}
      {!sku.inventoryTracked ? (
        <p className="callout calm">
          Inventory is not tracked for this variant, so the planner does not suggest a quantity.
        </p>
      ) : null}
      <ProjectionChart sku={sku} arrivalDate={plan.arrivalDate} />
      <dl className="facts">
        <Fact label="Shelf price" value={money(sku.unitPrice, plan.currency)} />
        <Fact label="Unit cost" value={money(sku.unitCost, plan.currency)} />
        <Fact label="On hand" value={units(sku.onHand)} />
        <Fact label="Committed" value={units(sku.committed)} />
        <Fact label="Available" value={units(sku.available)} />
        <Fact label="Incoming" value={units(sku.incoming)} />
        <Fact label="Units sold in lookback" value={units(sku.unitsSold)} />
        <Fact
          label="Trailing moving average"
          value={`${number(sku.trailingMovingAverage, 2)} /day`}
        />
        <Fact label="Forward velocity" value={`${number(sku.forwardDailyVelocity, 2)} /day`} />
        <Fact label="Trend" value={`${number(sku.trendPerDay, 3)} /day²`} />
        <Fact label="Residual σ" value={number(sku.residualStdev, 2)} />
        <Fact
          label="Days of cover"
          value={sku.daysOfCover === null ? '—' : number(sku.daysOfCover, 1)}
        />
        <Fact label="Lead-time demand" value={number(sku.leadTimeDemand, 1)} />
        <Fact
          label={`Safety stock (z ${number(plan.serviceLevelZ, 2)})`}
          value={number(sku.safetyStock, 1)}
        />
        <Fact label="Reorder point" value={number(sku.reorderPoint, 1)} />
        <Fact label="Order-up-to" value={number(sku.orderUpTo, 1)} />
        <Fact label="Inventory position" value={number(sku.inventoryPosition, 1)} />
        <Fact label="Raw quantity" value={number(sku.rawOrderQty, 1)} />
        <Fact
          label="Suggested"
          value={`${units(sku.suggestedQty)} (MOQ ${sku.moq}, carton ${sku.cartonSize})`}
        />
      </dl>
      <div className="season">
        <h3>Weekday index</h3>
        <p>
          1 is an average day. Estimated from this SKU’s lookback, not from a stored seasonal
          calendar.
        </p>
        <div className="season-bars" aria-hidden="true">
          {WEEKDAY_ORDER.map((weekday, index) => {
            const value = sku.seasonalIndex[weekday] ?? 1;
            return (
              <div key={WEEKDAY_LABELS[index]} className="season-col">
                <div className="season-track">
                  <div
                    className="season-fill"
                    style={{ height: `${Math.min(100, (value / maxSeason) * 100)}%` }}
                  />
                  <i
                    className="season-one"
                    style={{ bottom: `${Math.min(100, (1 / maxSeason) * 100)}%` }}
                  />
                </div>
                <span>{WEEKDAY_LABELS[index]}</span>
                <strong>{number(value, 2)}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
