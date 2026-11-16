/**
 * Read-only Admin GraphQL. Documented against 2026-10:
 * https://shopify.dev/docs/api/admin-graphql/2026-10/queries/shop
 * https://shopify.dev/docs/api/admin-graphql/2026-10/queries/products
 * https://shopify.dev/docs/api/admin-graphql/2026-10/queries/orders
 * https://shopify.dev/docs/api/admin-graphql/2026-10/queries/order
 * https://shopify.dev/docs/apps/build/inventory-management-apps/manage-quantities-states
 *
 * Required scopes: read_products, read_inventory, read_orders.
 * unitCost is returned only when the token can view product costs.
 */

export const SHOP_QUERY = `
  query PlannerShop {
    shop {
      name
      currencyCode
      ianaTimezone
      myshopifyDomain
    }
  }
`;

export const PRODUCTS_QUERY = `
  query PlannerProducts($cursor: String) {
    products(first: 20, after: $cursor, query: "status:active") {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        productType
        variants(first: 100) {
          pageInfo {
            hasNextPage
          }
          nodes {
            id
            sku
            title
            price
            inventoryItem {
              tracked
              unitCost {
                amount
              }
              inventoryLevels(first: 50) {
                pageInfo {
                  hasNextPage
                }
                nodes {
                  quantities(names: ["available", "on_hand", "committed", "incoming"]) {
                    name
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const ORDERS_QUERY = `
  query PlannerOrders($cursor: String, $query: String) {
    orders(first: 50, after: $cursor, query: $query, sortKey: CREATED_AT) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        createdAt
        cancelledAt
        displayFinancialStatus
        lineItems(first: 100) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            sku
            quantity
            currentQuantity
            variant {
              id
            }
          }
        }
      }
    }
  }
`;

export const ORDER_LINES_QUERY = `
  query PlannerOrderLines($id: ID!, $cursor: String) {
    order(id: $id) {
      lineItems(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          sku
          quantity
          currentQuantity
          variant {
            id
          }
        }
      }
    }
  }
`;

export const SHOPIFY_QUERIES = [SHOP_QUERY, PRODUCTS_QUERY, ORDERS_QUERY, ORDER_LINES_QUERY];
