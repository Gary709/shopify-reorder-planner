import type { PlanResult } from '@tinyfab/core';
import { downloadPurchaseOrder } from '../csv';
import { money, units } from '../format';

export function PurchaseOrder({ plan }: { plan: PlanResult }) {
  const shipment = plan.purchaseOrder;
  return (
    <section className="card po-card" id="shipment" aria-label="Suggested shipment">
      <div className="card-head">
        <div>
          <h2>This order</h2>
          <p className="section-note">
            One boat from China. Colours that run out sooner go on first.
            {shipment.budgetCap === null
              ? ' No spend limit.'
              : ` Limit ${money(shipment.budgetCap, plan.currency)}.`}
          </p>
        </div>
        <button
          type="button"
          className="primary"
          disabled={shipment.lines.length === 0}
          onClick={() => downloadPurchaseOrder(plan)}
        >
          Export CSV
        </button>
      </div>
      {shipment.groups.length > 0 ? (
        <ul className="groups">
          {shipment.groups.map((group) => (
            <li key={group.productType}>
              <strong>{group.productType}</strong>
              <span>
                {units(group.units)} units
                {group.knownCost > 0 ? ` · ${money(group.knownCost, plan.currency)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="section-note">Nothing to order with these settings.</p>
      )}
      {shipment.lines.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Quantity</th>
                <th scope="col">Cartons</th>
                <th scope="col">Unit cost</th>
                <th scope="col">Line cost</th>
                <th scope="col">Why</th>
              </tr>
            </thead>
            <tbody>
              {shipment.lines.map((line) => (
                <tr key={line.sku}>
                  <th scope="row">
                    <strong>{line.sku}</strong>
                    <small>
                      {line.productTitle} · {line.variantTitle}
                    </small>
                  </th>
                  <td>
                    {units(line.quantity)}
                    {line.partial ? <small>partial</small> : null}
                  </td>
                  <td>{units(line.cartons)}</td>
                  <td>{money(line.unitCost, plan.currency)}</td>
                  <td>{money(line.lineCost, plan.currency)}</td>
                  <td className="reason">{line.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <footer className="po-total">
        <span>{units(shipment.totalUnits)} units</span>
        <strong>
          {shipment.hasUnknownCost && shipment.knownCost === 0
            ? 'Cost not on file'
            : money(shipment.knownCost, plan.currency)}
        </strong>
        {shipment.budgetRemaining !== null ? (
          <span>{money(shipment.budgetRemaining, plan.currency)} left of the cap</span>
        ) : null}
      </footer>
      {shipment.hasUnknownCost ? (
        <p className="section-note">
          No factory cost on file, so this order has no dollar total and a spend limit will not trim
          it.
        </p>
      ) : null}
      <div className="withheld">
        <h3>Left off</h3>
        {shipment.withheld.length === 0 ? (
          <p>Nothing left off.</p>
        ) : (
          <ul>
            {shipment.withheld.map((line) => (
              <li key={line.sku}>
                <strong>{line.sku}</strong>
                <span>
                  suggested {units(line.suggestedQty)} · {line.reason}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
