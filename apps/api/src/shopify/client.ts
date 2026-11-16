import { addDays, calendarDate, PlannerError, type StoreSnapshot } from '@tinyfab/core';
import { shopifyGraphqlUrl, type ShopifySource } from '../env.js';
import { applyPolicies, type SkuPolicy } from '../policies.js';
import { ORDER_LINES_QUERY, ORDERS_QUERY, PRODUCTS_QUERY, SHOP_QUERY } from './queries.js';
import { mapOrders, mapProducts, mapShop } from './map.js';

const MAX_PRODUCT_PAGES = 40;
const MAX_ORDER_PAGES = 80;
const MAX_LINE_PAGES = 10;

interface GraphqlResponse {
  data?: unknown;
  errors?: { message?: string }[];
  extensions?: {
    cost?: { throttleStatus?: { currentlyAvailable?: number } };
  };
}

export async function fetchShopifySnapshot(
  source: ShopifySource,
  policies: Record<string, SkuPolicy>,
  deps: { fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<StoreSnapshot> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = shopifyGraphqlUrl(source.domain, source.version);
  const now = deps.now ?? new Date();

  const shopData = await graphql(fetchImpl, url, source.token, SHOP_QUERY, {});
  const shop = mapShop(shopData);
  const asOf = calendarDate(now.toISOString(), shop.timeZone);
  const historyStart = addDays(asOf, -source.lookbackDays);

  const productNodes: unknown[] = [];
  await eachPage({
    maxPages: MAX_PRODUCT_PAGES,
    label: 'product',
    fetchPage: (cursor) => graphql(fetchImpl, url, source.token, PRODUCTS_QUERY, { cursor }),
    read: (payload) => {
      const products = asRecord(dataOf(payload).products, 'products');
      productNodes.push(...asArray(products.nodes, 'products.nodes'));
      return pageInfo(products);
    },
  });
  const mappedProducts = mapProducts(productNodes);
  if (mappedProducts.truncated.length > 0) {
    throw new PlannerError(
      `A product has more than 100 variants (${mappedProducts.truncated.slice(0, 3).join(', ')}). Narrow the catalogue before planning.`,
      502,
    );
  }

  const orderNodes: unknown[] = [];
  // Pull a couple of extra UTC days so a shop timezone ahead of UTC still
  // includes orders that fall on historyStart. The planner drops anything
  // before historyStart rather than treating it as a zero-sales day.
  const orderQuery = `created_at:>='${addDays(historyStart, -2)}T00:00:00Z' -status:cancelled`;
  await eachPage({
    maxPages: MAX_ORDER_PAGES,
    label: 'order',
    fetchPage: (cursor) =>
      graphql(fetchImpl, url, source.token, ORDERS_QUERY, { cursor, query: orderQuery }),
    read: (payload) => {
      const orders = asRecord(dataOf(payload).orders, 'orders');
      orderNodes.push(...asArray(orders.nodes, 'orders.nodes'));
      return pageInfo(orders);
    },
  });

  for (const node of orderNodes) {
    const order = asRecord(node, 'order');
    const lineItems = asRecord(order.lineItems, 'lineItems');
    let info = pageInfo(lineItems);
    let cursor = info.cursor;
    let pages = 1;
    const seenCursors = new Set<string>();
    while (info.hasNextPage) {
      if (!cursor || seenCursors.has(cursor) || pages >= MAX_LINE_PAGES) {
        throw new PlannerError(
          `Order ${String(order.id ?? '')} has too many line items to read.`,
          502,
        );
      }
      seenCursors.add(cursor);
      const extra = await graphql(fetchImpl, url, source.token, ORDER_LINES_QUERY, {
        id: order.id,
        cursor,
      });
      const connection = asRecord(asRecord(dataOf(extra).order, 'order').lineItems, 'lineItems');
      const nodes = asArray(lineItems.nodes, 'lineItems.nodes');
      nodes.push(...asArray(connection.nodes, 'lineItems.nodes'));
      lineItems.nodes = nodes;
      info = pageInfo(connection);
      cursor = info.cursor;
      pages += 1;
    }
  }

  return {
    variants: applyPolicies(mappedProducts.variants, policies),
    orders: mapOrders(orderNodes),
    asOf,
    historyStart,
    timeZone: shop.timeZone,
    source: 'shopify',
    synthetic: false,
    disclaimer: `Live read from ${shop.name}. The Admin API token is used read-only (products, inventory, orders). Nothing is written back to Shopify. Unit cost appears only when the token can view product costs. MOQ and carton size come from data/sku-policies.json or the planner defaults.`,
    shopName: shop.name,
    currency: shop.currency,
  };
}

async function graphql(
  fetchImpl: typeof fetch,
  url: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  if (/\bmutation\b/i.test(query)) {
    throw new PlannerError('Refusing to send a Shopify mutation. This planner is read-only.', 500);
  }
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'request failed';
    throw new PlannerError(`Shopify Admin API request failed: ${message}`, 502);
  }
  if (!response.ok) {
    throw new PlannerError(`Shopify Admin API responded HTTP ${response.status}.`, 502);
  }
  const body = (await response.json()) as GraphqlResponse;
  if (body.errors && body.errors.length > 0) {
    const message = body.errors.map((error) => error.message || 'Unknown error').join('; ');
    throw new PlannerError(`Shopify Admin API: ${message}`, 502);
  }
  const available = body.extensions?.cost?.throttleStatus?.currentlyAvailable;
  if (typeof available === 'number' && available < 200) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return body;
}

async function eachPage(args: {
  maxPages: number;
  label: string;
  fetchPage: (cursor: string | null) => Promise<unknown>;
  read: (payload: unknown) => { hasNextPage: boolean; cursor: string | null };
}): Promise<void> {
  let cursor: string | null = null;
  for (let page = 1; page <= args.maxPages; page += 1) {
    const payload = await args.fetchPage(cursor);
    const info = args.read(payload);
    if (!info.hasNextPage) return;
    if (!info.cursor) {
      throw new PlannerError(`Shopify returned another ${args.label} page without a cursor.`, 502);
    }
    cursor = info.cursor;
  }
  throw new PlannerError(
    `Stopped after ${args.maxPages} ${args.label} pages. Shorten the order lookback or narrow the catalogue.`,
    502,
  );
}

function pageInfo(connection: Record<string, unknown>): {
  hasNextPage: boolean;
  cursor: string | null;
} {
  const info = asRecord(connection.pageInfo, 'pageInfo');
  const cursor = info.endCursor;
  return {
    hasNextPage: info.hasNextPage === true,
    cursor: typeof cursor === 'string' ? cursor : null,
  };
}

function dataOf(payload: unknown): Record<string, unknown> {
  return asRecord(asRecord(payload, 'response').data, 'data');
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PlannerError(`Unexpected Shopify response at ${label}`, 502);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new PlannerError(`Unexpected Shopify response at ${label}`, 502);
  return value;
}
