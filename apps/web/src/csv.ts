import type { PlanResult } from '@tinyfab/core';

export function purchaseOrderCsv(plan: PlanResult): string {
  const source = plan.synthetic ? 'synthetic-sample' : 'shopify';
  const header = [
    'sku',
    'product',
    'variant',
    'product_type',
    'quantity',
    'cartons',
    'unit_cost',
    'line_cost',
    'currency',
    'moq',
    'carton_size',
    'reason',
    'data_source',
  ];
  const rows = plan.purchaseOrder.lines.map((line) =>
    [
      line.sku,
      line.productTitle,
      line.variantTitle,
      line.productType,
      line.quantity,
      line.cartons,
      line.unitCost,
      line.lineCost,
      plan.currency,
      line.moq,
      line.cartonSize,
      line.reason,
      source,
    ]
      .map(cell)
      .join(','),
  );
  return `\uFEFF${[header.join(','), ...rows].join('\n')}\n`;
}

export function downloadPurchaseOrder(plan: PlanResult): void {
  const blob = new Blob([purchaseOrderCsv(plan)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reorder-shipment-${plan.asOf}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
