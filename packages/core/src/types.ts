export type DataSource = 'sample' | 'shopify';

export type SkuStatus = 'stockout-risk' | 'reorder' | 'covered' | 'no-demand' | 'untracked';

export type SeasonalIndex = [number, number, number, number, number, number, number];

export interface PlannerSettings {
  leadTimeDays: number;
  reviewPeriodDays: number;
  serviceLevel: number;
  movingAverageWindow: number;
  lookbackDays: number;
  horizonDays: number;
  budgetCap: number | null;
  /** Used when a SKU has no MOQ of its own and no override is set. */
  defaultMoq: number;
  /** Used when a SKU has no carton size of its own and no override is set. */
  defaultCartonSize: number;
  /** When set, replaces every SKU's MOQ. */
  moqOverride: number | null;
  /** When set, replaces every SKU's carton size. */
  cartonSizeOverride: number | null;
}

export interface VariantInput {
  sku: string;
  productTitle: string;
  variantTitle: string;
  productType: string;
  unitCost: number | null;
  unitPrice: number | null;
  onHand: number;
  /** Sellable now. May be negative when the variant is oversold. */
  available: number;
  committed: number;
  incoming: number;
  inventoryTracked: boolean;
  moq: number | null;
  cartonSize: number | null;
}

export interface OrderLineInput {
  sku: string;
  quantity: number;
}

export interface OrderInput {
  id: string;
  createdAt: string;
  lineItems: OrderLineInput[];
}

export interface StoreSnapshot {
  variants: VariantInput[];
  orders: OrderInput[];
  /** Planning date. Demand on this date is not part of history. */
  asOf: string;
  /** First date the feed actually covers. Earlier days are not treated as zero sales. */
  historyStart: string;
  timeZone: string;
  source: DataSource;
  synthetic: boolean;
  disclaimer: string;
  shopName: string;
  currency: string;
}

export interface ProjectionPoint {
  date: string;
  demand: number;
  /** End-of-day stock with existing incoming only. Lost sales, so never below 0. */
  withoutOrder: number;
  /** End-of-day stock if the suggested shipment also arrives at the lead time. */
  withOrder: number;
}

export interface SkuPlan {
  sku: string;
  productTitle: string;
  variantTitle: string;
  productType: string;
  unitCost: number | null;
  unitPrice: number | null;
  onHand: number;
  available: number;
  committed: number;
  incoming: number;
  inventoryTracked: boolean;
  moq: number;
  cartonSize: number;
  unitsSold: number;
  historyDays: number;
  trailingMovingAverage: number;
  trendPerDay: number;
  /** Index 0 is Sunday. The seven values average to 1 when there is history. */
  seasonalIndex: number[];
  residualStdev: number;
  forwardDailyVelocity: number;
  daysOfCover: number | null;
  leadTimeDemand: number;
  safetyStock: number;
  reorderPoint: number;
  protectionDemand: number;
  protectionSafetyStock: number;
  orderUpTo: number;
  inventoryPosition: number;
  rawOrderQty: number;
  suggestedQty: number;
  roundedUp: boolean;
  stockoutDate: string | null;
  stockoutBeforeArrival: boolean;
  status: SkuStatus;
  projection: ProjectionPoint[];
}

export interface ShipmentLine {
  sku: string;
  productTitle: string;
  variantTitle: string;
  productType: string;
  quantity: number;
  cartons: number;
  unitCost: number | null;
  lineCost: number | null;
  moq: number;
  cartonSize: number;
  reason: string;
  partial: boolean;
}

export interface WithheldLine {
  sku: string;
  productTitle: string;
  variantTitle: string;
  suggestedQty: number;
  unitCost: number | null;
  reason: string;
}

export interface ShipmentGroup {
  productType: string;
  units: number;
  knownCost: number;
  lines: number;
}

export interface PurchaseOrder {
  lines: ShipmentLine[];
  withheld: WithheldLine[];
  groups: ShipmentGroup[];
  totalUnits: number;
  knownCost: number;
  hasUnknownCost: boolean;
  budgetCap: number | null;
  budgetRemaining: number | null;
}

export interface PlanResult {
  source: DataSource;
  synthetic: boolean;
  disclaimer: string;
  shopName: string;
  currency: string;
  timeZone: string;
  asOf: string;
  arrivalDate: string;
  historyStart: string;
  historyDays: number;
  stockoutSearchDays: number;
  settings: PlannerSettings;
  serviceLevelZ: number;
  assumptions: string[];
  warnings: string[];
  skippedWithoutSku: number;
  mergedDuplicateSkus: number;
  ignoredOrderUnits: number;
  skus: SkuPlan[];
  purchaseOrder: PurchaseOrder;
}
