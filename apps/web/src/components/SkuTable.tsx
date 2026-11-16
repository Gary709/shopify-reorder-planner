import { useMemo, useState } from 'react';
import type { SkuPlan } from '@tinyfab/core';
import { colourSwatch, dayLabel, money, number, STATUS_LABEL, units } from '../format';

type SortKey =
  | 'sku'
  | 'available'
  | 'incoming'
  | 'velocity'
  | 'cover'
  | 'reorderPoint'
  | 'suggested'
  | 'stockout'
  | 'lineCost'
  | 'status';

const STATUS_RANK = {
  'stockout-risk': 0,
  reorder: 1,
  covered: 2,
  'no-demand': 3,
  untracked: 4,
} as const;

export function SkuTable({
  skus,
  currency,
  selected,
  onSelect,
}: {
  skus: SkuPlan[];
  currency: string;
  selected: string | null;
  onSelect: (sku: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('cover');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? skus.filter((sku) =>
          `${sku.sku} ${sku.productTitle} ${sku.variantTitle} ${sku.productType}`
            .toLowerCase()
            .includes(needle),
        )
      : skus;
    const sorted = filtered
      .slice()
      .sort((a, b) => compare(a, b, sortKey, direction === 'asc' ? 1 : -1));
    return sorted;
  }, [skus, query, sortKey, direction]);

  function toggle(key: SortKey) {
    if (sortKey === key) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setDirection('asc');
  }

  return (
    <section className="card table-card" aria-label="SKU plan">
      <div className="card-head">
        <h2>SKUs</h2>
        <label className="filter">
          <span className="sr-only">Filter the table</span>
          <input
            value={query}
            placeholder="Filter SKUs"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <SortHeader
                label="SKU"
                column="sku"
                active={sortKey}
                direction={direction}
                onSort={toggle}
              />
              <SortHeader
                label="Available"
                column="available"
                active={sortKey}
                direction={direction}
                onSort={toggle}
              />
              <SortHeader
                label="Incoming"
                column="incoming"
                active={sortKey}
                direction={direction}
                onSort={toggle}
              />
              <SortHeader
                label="Velocity"
                column="velocity"
                active={sortKey}
                direction={direction}
                onSort={toggle}
              />
              <SortHeader
                label="Days of cover"
                column="cover"
                active={sortKey}
                direction={direction}
                onSort={toggle}
              />
              <SortHeader
                label="Reorder point"
                column="reorderPoint"
                active={sortKey}
                direction={direction}
                onSort={toggle}
              />
              <SortHeader
                label="Suggested"
                column="suggested"
                active={sortKey}
                direction={direction}
                onSort={toggle}
              />
              <SortHeader
                label="Stock-out"
                column="stockout"
                active={sortKey}
                direction={direction}
                onSort={toggle}
              />
              <SortHeader
                label="Line cost"
                column="lineCost"
                active={sortKey}
                direction={direction}
                onSort={toggle}
              />
              <SortHeader
                label="Status"
                column="status"
                active={sortKey}
                direction={direction}
                onSort={toggle}
              />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={10} className="empty">
                  No SKUs match that filter. The shipment below is unchanged.
                </td>
              </tr>
            ) : (
              visible.map((sku) => {
                const lineCost = sku.unitCost === null ? null : sku.unitCost * sku.suggestedQty;
                const swatch = colourSwatch(sku.variantTitle);
                return (
                  <tr
                    key={sku.sku}
                    className={`status-${sku.status}${selected === sku.sku ? ' is-selected' : ''}`}
                    aria-selected={selected === sku.sku}
                    tabIndex={0}
                    onClick={() => onSelect(sku.sku)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(sku.sku);
                      }
                    }}
                  >
                    <th scope="row">
                      <span className="sku-name">
                        {swatch ? (
                          <span
                            className={`swatch${swatch === '#f7f4ee' || swatch === '#d5e3ea' || swatch === '#e4d0b0' ? ' swatch-light' : ''}`}
                            style={{ background: swatch }}
                          />
                        ) : null}
                        <span>
                          <strong>{sku.sku}</strong>
                          <small>
                            {sku.productTitle} · {sku.variantTitle}
                          </small>
                        </span>
                      </span>
                    </th>
                    <td>{units(sku.available)}</td>
                    <td>{units(sku.incoming)}</td>
                    <td>
                      {number(sku.forwardDailyVelocity, 2)}
                      <small>/day</small>
                    </td>
                    <td>{sku.daysOfCover === null ? '—' : number(sku.daysOfCover, 1)}</td>
                    <td>{number(sku.reorderPoint, 1)}</td>
                    <td>
                      <strong>{units(sku.suggestedQty)}</strong>
                      {sku.roundedUp ? <small>from {number(sku.rawOrderQty, 1)}</small> : null}
                    </td>
                    <td>{sku.stockoutDate ? dayLabel(sku.stockoutDate) : '—'}</td>
                    <td>{sku.suggestedQty > 0 ? money(lineCost, currency) : '—'}</td>
                    <td>
                      <span className={`pill pill-${sku.status}`}>{STATUS_LABEL[sku.status]}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SortHeader({
  label,
  column,
  active,
  direction,
  onSort,
}: {
  label: string;
  column: SortKey;
  active: SortKey;
  direction: 'asc' | 'desc';
  onSort: (column: SortKey) => void;
}) {
  const isActive = active === column;
  return (
    <th
      scope="col"
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" onClick={() => onSort(column)}>
        {label}
        <span aria-hidden="true">{isActive ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}</span>
      </button>
    </th>
  );
}

function compare(a: SkuPlan, b: SkuPlan, key: SortKey, sign: 1 | -1): number {
  switch (key) {
    case 'sku':
      return a.sku.localeCompare(b.sku) * sign;
    case 'available':
      return (a.available - b.available) * sign;
    case 'incoming':
      return (a.incoming - b.incoming) * sign;
    case 'velocity':
      return (a.forwardDailyVelocity - b.forwardDailyVelocity) * sign;
    case 'cover':
      return nullsLast(a.daysOfCover, b.daysOfCover, sign);
    case 'reorderPoint':
      return (a.reorderPoint - b.reorderPoint) * sign;
    case 'suggested':
      return (a.suggestedQty - b.suggestedQty) * sign;
    case 'stockout':
      return nullsLast(a.stockoutDate, b.stockoutDate, sign);
    case 'lineCost':
      return nullsLast(lineCost(a), lineCost(b), sign);
    case 'status':
      return (STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.sku.localeCompare(b.sku)) * sign;
    default:
      return 0;
  }
}

function lineCost(sku: SkuPlan): number | null {
  if (sku.unitCost === null || sku.suggestedQty <= 0) return null;
  return sku.unitCost * sku.suggestedQty;
}

function nullsLast(a: number | string | null, b: number | string | null, sign: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (a < b) return -sign;
  if (a > b) return sign;
  return 0;
}
