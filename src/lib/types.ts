export type SalesChannel = "tiendanube" | "shopify" | "mercadolibre";

export type ConnectionMode = "demo" | "api";

export type SaleRecord = {
  id: string;
  source: SalesChannel;
  orderId: string;
  orderedAt: string;
  currency: string;
  customerName?: string;
  status: "paid" | "pending" | "cancelled";
  grossAmount: number;
  discountAmount: number;
  shippingAmount: number;
  marketplaceFeeAmount: number;
  taxAmount: number;
  iibbAmount: number;
  otherChargesAmount: number;
  netAmount: number;
};

export type SyncRequest = {
  from: string;
  to: string;
  channels: SalesChannel[];
};

export type SalesTotals = {
  totalOrders: number;
  gross: number;
  discounts: number;
  shipping: number;
  marketplaceFees: number;
  taxes: number;
  iibb: number;
  otherCharges: number;
  net: number;
};

export type SalesResponse = {
  totals: SalesTotals;
  items: SaleRecord[];
};

export type RawOrder = {
  id: string;
  date: string;
  status: "paid" | "pending" | "cancelled";
  customerName?: string;
  currency: string;
  total: number;
  discount: number;
  shipping: number;
  marketplaceFee: number;
  tax: number;
  iibb: number;
  otherCharges: number;
};

export type ChannelCredentials = {
  accessToken?: string;
  storeUrl?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  sellerId?: string;
};

export type ChannelConnection = {
  channel: SalesChannel;
  enabled: boolean;
  mode: ConnectionMode;
  storeName: string;
  credentials: ChannelCredentials;
};

export type ExportSettings = {
  enabled: boolean;
  spreadsheetId?: string;
  sheetTab: string;
};

export type AutomationJob = {
  id: string;
  name: string;
  channels: SalesChannel[];
  fromDaysBack: number;
  schedule: "manual" | "daily" | "hourly";
  enabled: boolean;
  exportToSheets: boolean;
  lastRunAt?: string;
};

export type AppSettings = {
  connections: ChannelConnection[];
  exportSettings: ExportSettings;
  automations: AutomationJob[];
};

export type SyncRun = {
  id: string;
  createdAt: string;
  triggeredBy: "manual" | "automation";
  jobId?: string;
  from: string;
  to: string;
  channels: SalesChannel[];
  status: "success" | "failed";
  fetched: number;
  inserted: number;
  skipped: number;
  exportedRows: number;
  message: string;
};
