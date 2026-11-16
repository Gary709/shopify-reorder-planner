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
          Hits zero on {dayLabel(sku.stockoutDate)}. A boat ordered today lands{' '}
          {dayLabel(plan.arrivalDate)}. Ordering now does not cover the weeks it is at sea.
        </p>
      ) : null}
      {!sku.inventoryTracked ? (
        <p className="callout calm">
          Shopify is not tracking this colour, so I am not suggesting a qty.
        </p>
      ) : null}
      <ProjectionChart sku={sku} arrivalDate={plan.arrivalDate} />
      <dl className="facts">
        <Fact label="Shelf price" value={money(sku.unitPrice, plan.currency)} />
        <Fact
          label="My cost"
          value={sku.unitCost === null ? 'not on file' : money(sku.unitCost, plan.currency)}
        />
        <Fact label="On hand" value={units(sku.onHand)} />
        <Fact label="Sold, not sent" value={units(sku.committed)} />
        <Fact label="Can sell" value={units(sku.available)} />
        <Fact label="Already on a boat" value={units(sku.incoming)} />
        <Fact label="Sold in the window" value={units(sku.unitsSold)} />
        <Fact label="Recent average" value={`${number(sku.trailingMovingAverage, 2)} /day`} />
        <Fact label="Expected sales" value={`${number(sku.forwardDailyVelocity, 2)} /day`} />
        <Fact label="Trend" value={`${number(sku.trendPerDay, 3)} per day`} />
        <Fact label="Day-to-day noise" value={number(sku.residualStdev, 2)} />
        <Fact
          label="Days left"
          value={sku.daysOfCover === null ? '—' : number(sku.daysOfCover, 1)}
        />
        <Fact label="Sales while the boat is coming" value={number(sku.leadTimeDemand, 1)} />
        <Fact label="Extra to hold" value={number(sku.safetyStock, 1)} />
        <Fact label="Reorder when stock hits" value={number(sku.reorderPoint, 1)} />
        <Fact label="Want on hand after this order" value={number(sku.orderUpTo, 1)} />
        <Fact label="Stock I can count" value={number(sku.inventoryPosition, 1)} />
        <Fact label="Before rounding" value={number(sku.rawOrderQty, 1)} />
        <Fact
          label="Order"
          value={`${units(sku.suggestedQty)} (min ${sku.moq}, box ${sku.cartonSize})`}
        />
      </dl>
      <div className="season">
        <h3>Which days it sells</h3>
        <p>1 is a normal day for this colour, from its own order history.</p>
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
