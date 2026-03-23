import { ChannelConnection, RawOrder } from "@/lib/types";

const SHOPIFY_API_VERSION = "2026-01";

type MoneyV2 = {
  amount: string;
  currencyCode: string;
};

type ShopifyOrderNode = {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt?: string | null;
  displayFinancialStatus?: string | null;
  customer?: {
    displayName?: string | null;
  } | null;
  currentTotalPriceSet?: { shopMoney: MoneyV2 } | null;
  currentTotalDiscountsSet?: { shopMoney: MoneyV2 } | null;
  currentShippingPriceSet?: { shopMoney: MoneyV2 } | null;
  currentTotalTaxSet?: { shopMoney: MoneyV2 } | null;
};

type ShopifyOrdersResponse = {
  data?: {
    orders?: {
      edges: Array<{
        cursor: string;
        node: ShopifyOrderNode;
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor?: string | null;
      };
    };
    shop?: {
      name: string;
      myshopifyDomain: string;
      currencyCode?: string | null;
    };
  };
  errors?: Array<{
    message: string;
  }>;
};

type ShopifyOrdersConnection = NonNullable<NonNullable<ShopifyOrdersResponse["data"]>["orders"]>;

const parseAmount = (value?: string | null): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDomain = (storeUrl?: string): string => {
  if (!storeUrl) {
    throw new Error("Shopify requiere storeUrl o dominio myshopify.");
  }

  const sanitized = storeUrl.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0]?.trim();
  if (!sanitized) {
    throw new Error("El storeUrl de Shopify no es valido.");
  }

  return sanitized;
};

const buildShopifyEndpoint = (storeUrl?: string): string => {
  const domain = normalizeDomain(storeUrl);
  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
};

const buildOrderSearchQuery = (from: string, to: string): string => {
  const fromDate = from.slice(0, 10);
  const toDate = to.slice(0, 10);
  return `created_at:>=${fromDate} created_at:<=${toDate}`;
};

const mapShopifyStatus = (order: ShopifyOrderNode): RawOrder["status"] => {
  if (order.cancelledAt) {
    return "cancelled";
  }

  const status = order.displayFinancialStatus?.toUpperCase();
  if (status === "PAID") {
    return "paid";
  }

  return "pending";
};

const mapShopifyOrder = (order: ShopifyOrderNode): RawOrder => {
  const totalMoney = order.currentTotalPriceSet?.shopMoney;
  const discountMoney = order.currentTotalDiscountsSet?.shopMoney;
  const shippingMoney = order.currentShippingPriceSet?.shopMoney;
  const taxMoney = order.currentTotalTaxSet?.shopMoney;

  return {
    id: order.id,
    date: order.createdAt,
    status: mapShopifyStatus(order),
    customerName: order.customer?.displayName ?? undefined,
    currency: totalMoney?.currencyCode ?? taxMoney?.currencyCode ?? "ARS",
    total: parseAmount(totalMoney?.amount),
    discount: parseAmount(discountMoney?.amount),
    shipping: parseAmount(shippingMoney?.amount),
    marketplaceFee: 0,
    tax: parseAmount(taxMoney?.amount),
    iibb: 0,
    otherCharges: 0,
  };
};

const shopifyGraphql = async <TData>(
  connection: ChannelConnection,
  query: string,
  variables: Record<string, unknown>,
): Promise<TData> => {
  const accessToken = connection.credentials.accessToken;
  if (!accessToken) {
    throw new Error("Shopify requiere accessToken.");
  }

  const response = await fetch(buildShopifyEndpoint(connection.credentials.storeUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const json = (await response.json()) as TData & ShopifyOrdersResponse;
  if (!response.ok) {
    const message = json.errors?.map((item) => item.message).join(" | ") || "Error Shopify Admin API";
    throw new Error(message);
  }

  if (json.errors?.length) {
    throw new Error(json.errors.map((item) => item.message).join(" | "));
  }

  return json;
};

export const testShopifyConnection = async (connection: ChannelConnection) => {
  const query = `#graphql
    query TestShop {
      shop {
        name
        myshopifyDomain
        currencyCode
      }
    }
  `;

  const json = await shopifyGraphql<ShopifyOrdersResponse>(connection, query, {});
  const shop = json.data?.shop;
  if (!shop) {
    throw new Error("Shopify no devolvio datos de tienda.");
  }

  return {
    channel: "shopify",
    storeName: shop.name,
    domain: shop.myshopifyDomain,
    currency: shop.currencyCode ?? "N/A",
  };
};

export const fetchShopifyOrders = async (
  connection: ChannelConnection,
  from: string,
  to: string,
): Promise<RawOrder[]> => {
  const query = `#graphql
    query OrdersPage($first: Int!, $after: String, $search: String!) {
      orders(first: $first, after: $after, query: $search, sortKey: CREATED_AT, reverse: true) {
        edges {
          cursor
          node {
            id
            name
            createdAt
            cancelledAt
            displayFinancialStatus
            customer {
              displayName
            }
            currentTotalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            currentTotalDiscountsSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            currentShippingPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            currentTotalTaxSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const items: RawOrder[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const json: ShopifyOrdersResponse = await shopifyGraphql<ShopifyOrdersResponse>(connection, query, {
      first: 100,
      after,
      search: buildOrderSearchQuery(from, to),
    });

    const orders: ShopifyOrdersConnection | undefined = json.data?.orders;
    if (!orders) {
      break;
    }

    items.push(...orders.edges.map((edge: { cursor: string; node: ShopifyOrderNode }) => mapShopifyOrder(edge.node)));
    hasNextPage = orders.pageInfo.hasNextPage;
    after = orders.pageInfo.endCursor ?? null;
  }

  return items;
};
