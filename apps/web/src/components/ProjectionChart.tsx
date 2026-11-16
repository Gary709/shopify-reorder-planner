import { useId, useState } from 'react';
import type { SkuPlan } from '@tinyfab/core';
import { dayLabel, number } from '../format';

export function ProjectionChart({ sku, arrivalDate }: { sku: SkuPlan; arrivalDate: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId().replaceAll(':', '');
  const points = sku.projection;
  const width = 720;
  const height = 280;
  const pad = { left: 44, right: 16, top: 18, bottom: 36 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const maxStock = Math.max(1, ...points.flatMap((point) => [point.withoutOrder, point.withOrder]));
  const yMax = maxStock * 1.12;

  function x(index: number): number {
    if (points.length <= 1) return pad.left;
    return pad.left + (index / (points.length - 1)) * innerWidth;
  }
  function y(value: number): number {
    return pad.top + (1 - value / yMax) * innerHeight;
  }

  const without = path(points.map((point, index) => [x(index), y(point.withoutOrder)]));
  const withOrder = path(points.map((point, index) => [x(index), y(point.withOrder)]));
  const arrivalIndex = points.findIndex((point) => point.date === arrivalDate);
  const active = hover === null ? null : points[hover];
  const identical = points.every((point) => Math.abs(point.withoutOrder - point.withOrder) < 1e-6);

  return (
    <figure className="chart" id="projection">
      <figcaption>
        <strong>Stock projection</strong>
        <span>End of each day. Lost sales stay at zero; they are not backordered.</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Projected stock for ${sku.sku}. ${sku.stockoutDate ? `Stock-out ${dayLabel(sku.stockoutDate)}.` : 'No stock-out in the search window.'}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e4d6b" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1e4d6b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((fraction) => {
          const value = yMax * (1 - fraction);
          const yPos = pad.top + fraction * innerHeight;
          return (
            <g key={fraction}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={yPos}
                y2={yPos}
                className="grid-line"
              />
              <text x={pad.left - 8} y={yPos + 4} className="axis-label" textAnchor="end">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
        {arrivalIndex >= 0 ? (
          <g>
            <line
              x1={x(arrivalIndex)}
              x2={x(arrivalIndex)}
              y1={pad.top}
              y2={height - pad.bottom}
              className="arrival-line"
            />
            <text x={x(arrivalIndex) + 6} y={pad.top + 12} className="arrival-label">
              Arrives
            </text>
          </g>
        ) : null}
        <path
          d={`${withOrder} L ${x(points.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`}
          fill={`url(#${gradientId})`}
        />
        <path d={without} className="line-without" />
        <path d={withOrder} className="line-with" />
        {points.map((point, index) => (
          <rect
            key={point.date}
            x={x(index) - innerWidth / Math.max(points.length, 1) / 2}
            y={pad.top}
            width={innerWidth / Math.max(points.length, 1)}
            height={innerHeight}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}
        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.top}
            y2={height - pad.bottom}
            className="hover-line"
          />
        ) : null}
        <text x={pad.left} y={height - 10} className="axis-label">
          {points[0] ? dayLabel(points[0].date) : ''}
        </text>
        <text x={width - pad.right} y={height - 10} className="axis-label" textAnchor="end">
          {points.at(-1) ? dayLabel(points.at(-1)?.date ?? null) : ''}
        </text>
      </svg>
      <div className="legend">
        <span>
          <i className="swatch-line swatch-without" /> Without this shipment
        </span>
        <span>
          <i className="swatch-line swatch-with" /> With this shipment
        </span>
        {identical ? (
          <span className="legend-note">The lines match: nothing extra arrives on this boat.</span>
        ) : null}
      </div>
      {active ? (
        <dl className="hover-readout">
          <div>
            <dt>Date</dt>
            <dd>{dayLabel(active.date)}</dd>
          </div>
          <div>
            <dt>Forecast demand</dt>
            <dd>{number(active.demand, 2)}</dd>
          </div>
          <div>
            <dt>Without shipment</dt>
            <dd>{number(active.withoutOrder, 1)}</dd>
          </div>
          <div>
            <dt>With shipment</dt>
            <dd>{number(active.withOrder, 1)}</dd>
          </div>
        </dl>
      ) : (
        <p className="hover-hint">Hover the chart for a single day.</p>
      )}
      {arrivalIndex < 0 ? (
        <p className="hover-hint">
          Arrival on {dayLabel(arrivalDate)} is past the end of this chart.
        </p>
      ) : null}
    </figure>
  );
}

function path(coords: (number | undefined)[][]): string {
  return coords
    .map((pair, index) => {
      const px = pair[0] ?? 0;
      const py = pair[1] ?? 0;
      return `${index === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`;
    })
    .join(' ');
}
