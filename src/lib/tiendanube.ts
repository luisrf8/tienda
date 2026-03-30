import { ChannelConnection, RawOrder } from "@/lib/types";

const TIENDANUBE_API_BASE = process.env.TIENDANUBE_API_BASE_URL ?? "https://api.tiendanube.com/v1";
const TIENDANUBE_OAUTH_BASE = process.env.TIENDANUBE_OAUTH_BASE_URL ?? "https://www.tiendanube.com";
const TIENDANUBE_USER_AGENT = process.env.TIENDANUBE_USER_AGENT ?? "Zagon (larojasf1999@hotmail.com)";

type TiendanubeStore = {
  id?: number | string;
  name?: { es?: string; pt?: string; en?: string } | string;
  original_domain?: string;
  domain?: string;
  currency?: string;
};

type TiendanubeOrder = {
  id?: number | string;
  number?: number | string;
  created_at?: string;
  cancelled_at?: string | null;
  payment_status?: string;
  status?: string;
  contact_name?: string;
  customer?: {
    name?: string;
  };
  currency?: string;
  total?: string | number;
  total_discounts?: string | number;
  total_discount?: string | number;
  discount?: string | number;
  shipping_cost_customer?: string | number;
  shipping_cost_owner?: string | number;
  total_taxes?: string | number;
};

type TiendanubeProduct = {
  id?: number | string;
  name?: { es?: string; pt?: string; en?: string } | string;
  published?: boolean;
  free_shipping?: boolean;
  permalink?: string;
  created_at?: string;
  updated_at?: string;
  variants?: Array<{
    id?: number | string;
    price?: string | number;
    promotional_price?: string | number;
    stock?: string | number;
    sku?: string;
  }>;
};

export type TiendanubeCatalogProduct = {
  id: string;
  name: string;
  published: boolean;
  freeShipping: boolean;
  permalink: string;
  createdAt: string;
  updatedAt: string;
  variants: number;
  stock: number;
  price: number | null;
  promotionalPrice: number | null;
  sku: string;
};

type TiendanubeTokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  user_id?: string | number;
  error?: string;
  error_description?: string;
};

const parseAmount = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
};

const resolveStoreId = (connection: ChannelConnection): string => {
  const fromSeller = connection.credentials.sellerId?.trim();
  if (fromSeller) {
    return fromSeller;
  }

  const fromUrl = connection.credentials.storeUrl?.trim();
  if (!fromUrl) {
    throw new Error("Tiendanube requiere user_id/store_id (cargar en Seller ID). ");
  }

  const match = fromUrl.match(/\d+/);
  if (!match) {
    throw new Error("No se pudo resolver el store_id de Tiendanube. Carga el user_id en Seller ID.");
  }

  return match[0];
};

const resolveStoreName = (name: TiendanubeStore["name"]): string => {
  if (!name) {
    return "Tienda";
  }

  if (typeof name === "string") {
    return name;
  }

  return name.es ?? name.pt ?? name.en ?? "Tienda";
};

const mapTiendanubeStatus = (order: TiendanubeOrder): RawOrder["status"] => {
  if (order.cancelled_at) {
    return "cancelled";
  }

  const payment = order.payment_status?.toLowerCase();
  const status = order.status?.toLowerCase();
  if (payment === "paid" || payment === "authorized" || status === "closed") {
    return "paid";
  }

  return "pending";
};

const toRawOrder = (order: TiendanubeOrder): RawOrder => {
  const orderId = String(order.id ?? order.number ?? `tn-${Date.now()}`);
  const total = parseAmount(order.total);
  const discount = parseAmount(order.total_discounts ?? order.total_discount ?? order.discount);
  const shipping = parseAmount(order.shipping_cost_customer ?? order.shipping_cost_owner);
  const tax = parseAmount(order.total_taxes);

  return {
    id: orderId,
    date: order.created_at ?? new Date().toISOString(),
    status: mapTiendanubeStatus(order),
    customerName: order.contact_name ?? order.customer?.name,
    currency: order.currency ?? "ARS",
    total,
    discount,
    shipping,
    marketplaceFee: 0,
    tax,
    iibb: 0,
    otherCharges: 0,
  };
};

const resolveNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = parseAmount(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveInt = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapTiendanubeProduct = (product: TiendanubeProduct): TiendanubeCatalogProduct => {
  const firstVariant = product.variants?.[0];
  const totalStock = (product.variants ?? []).reduce((acc, item) => acc + resolveInt(item.stock), 0);

  return {
    id: String(product.id ?? ""),
    name: resolveStoreName(product.name),
    published: Boolean(product.published),
    freeShipping: Boolean(product.free_shipping),
    permalink: product.permalink ?? "",
    createdAt: product.created_at ?? "",
    updatedAt: product.updated_at ?? "",
    variants: product.variants?.length ?? 0,
    stock: totalStock,
    price: resolveNumberOrNull(firstVariant?.price),
    promotionalPrice: resolveNumberOrNull(firstVariant?.promotional_price),
    sku: firstVariant?.sku ?? "",
  };
};

const tiendanubeHeaders = (accessToken: string): Record<string, string> => ({
  Authentication: `bearer ${accessToken}`,
  "User-Agent": TIENDANUBE_USER_AGENT,
  "Content-Type": "application/json",
});

const tiendanubeGet = async <T>(path: string, accessToken: string): Promise<T> => {
  const response = await fetch(`${TIENDANUBE_API_BASE}${path}`, {
    method: "GET",
    headers: tiendanubeHeaders(accessToken),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as T & {
    error?: string;
    description?: string;
    message?: string;
  };

  if (!response.ok) {
    const reason = json?.description ?? json?.message ?? json?.error ?? "Error Tiendanube API";
    throw new Error(reason);
  }

  return json;
};

export const buildTiendanubeAuthorizeUrl = (clientId: string, state: string): string => {
  const appId = clientId.trim();
  if (!appId) {
    throw new Error("Falta client_id de Tiendanube para iniciar OAuth.");
  }

  return `${TIENDANUBE_OAUTH_BASE}/apps/${encodeURIComponent(appId)}/authorize?state=${encodeURIComponent(state)}`;
};

export const exchangeTiendanubeAuthorizationCode = async (input: {
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<{ accessToken: string; userId: string; scope: string }> => {
  const response = await fetch(`${TIENDANUBE_OAUTH_BASE}/apps/authorize/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": TIENDANUBE_USER_AGENT,
    },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "authorization_code",
      code: input.code,
    }),
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as TiendanubeTokenResponse | null;
  if (!response.ok || !json?.access_token || !json.user_id) {
    const reason = json?.error_description ?? json?.error ?? "No se pudo obtener access_token de Tiendanube.";
    throw new Error(reason);
  }

  return {
    accessToken: json.access_token,
    userId: String(json.user_id),
    scope: json.scope ?? "",
  };
};

export const testTiendanubeConnection = async (connection: ChannelConnection) => {
  const accessToken = connection.credentials.accessToken;
  if (!accessToken) {
    throw new Error("Tiendanube requiere accessToken.");
  }

  const storeId = resolveStoreId(connection);
  const store = await tiendanubeGet<TiendanubeStore>(`/${storeId}/store`, accessToken);

  return {
    channel: "tiendanube",
    storeId,
    storeName: resolveStoreName(store.name),
    domain: store.original_domain ?? store.domain ?? "N/A",
    currency: store.currency ?? "N/A",
  };
};

export const fetchTiendanubeOrders = async (
  connection: ChannelConnection,
  from: string,
  to: string,
): Promise<RawOrder[]> => {
  const accessToken = connection.credentials.accessToken;
  if (!accessToken) {
    throw new Error("Tiendanube requiere accessToken.");
  }

  const storeId = resolveStoreId(connection);
  const perPage = 200;
  const items: RawOrder[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      created_at_min: from,
      created_at_max: to,
    });

    const orders = await tiendanubeGet<TiendanubeOrder[]>(`/${storeId}/orders?${params.toString()}`, accessToken);
    if (!Array.isArray(orders) || orders.length === 0) {
      break;
    }

    items.push(...orders.map(toRawOrder));

    if (orders.length < perPage) {
      break;
    }
  }

  return items;
};

export const fetchTiendanubeProducts = async (
  connection: ChannelConnection,
  options?: { limit?: number },
): Promise<TiendanubeCatalogProduct[]> => {
  const accessToken = connection.credentials.accessToken;
  if (!accessToken) {
    throw new Error("Tiendanube requiere accessToken.");
  }

  const storeId = resolveStoreId(connection);
  const perPage = 200;
  const maxItems = Math.max(1, Math.min(options?.limit ?? 300, 5000));
  const items: TiendanubeCatalogProduct[] = [];

  for (let page = 1; page <= 50 && items.length < maxItems; page += 1) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });

    const products = await tiendanubeGet<TiendanubeProduct[]>(`/${storeId}/products?${params.toString()}`, accessToken);
    if (!Array.isArray(products) || products.length === 0) {
      break;
    }

    items.push(...products.map(mapTiendanubeProduct));

    if (products.length < perPage) {
      break;
    }
  }

  return items.slice(0, maxItems);
};