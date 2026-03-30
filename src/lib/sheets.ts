import { google } from "googleapis";
import { ExportSettings, SaleRecord } from "@/lib/types";

const DEFAULT_SHEET_TAB = "Ventas";
const CHANNEL_SHEET_TAB: Record<SaleRecord["source"], string> = {
  tiendanube: "VENTAS TIENDA NUBE",
  mercadolibre: "VENTAS MERCADO LIBRE",
  shopify: "VENTAS SHOPIFY",
};
const GLOBAL_SHEET_TABS = ["INGRESOS Y RESULTADOS", "EGRESOS"];
const TIENDANUBE_EXPORT_TAB = "VENTAS TIENDA NUBE";

const DEFAULT_HEADERS = [
  "Fecha",
  "Canal",
  "Order ID",
  "Estado",
  "Cliente",
  "Moneda",
  "Venta Bruta",
  "Descuentos",
  "Envio",
  "Comision Marketplace",
  "Impuestos",
  "IIBB",
  "Otros Cargos",
  "Neto",
];

const normalizeHeader = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("es-AR");
};

const formatMonth = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
};

const mapPaymentStatus = (status: SaleRecord["status"]): string => {
  if (status === "paid") {
    return "Pagado";
  }

  if (status === "pending") {
    return "Pendiente";
  }

  return "Cancelado";
};

const resolveTiendanubeCellValue = (header: string, sale: SaleRecord): string | number => {
  const key = normalizeHeader(header);

  if (key === "numerodeorden" || key === "identificadordelaorden") {
    return sale.orderId;
  }

  if (key === "email") {
    return "";
  }

  if (key === "fecha" || key === "fechaventa") {
    return formatDate(sale.orderedAt);
  }

  if (key === "estadodelaorden") {
    return sale.status;
  }

  if (key === "estadodelpago") {
    return mapPaymentStatus(sale.status);
  }

  if (key === "estadodelenvio") {
    return "";
  }

  if (key === "moneda") {
    return sale.currency;
  }

  if (key === "subtotaldeproductos") {
    return sale.grossAmount;
  }

  if (key === "descuento") {
    return sale.discountAmount;
  }

  if (key === "costodeenvio") {
    return sale.shippingAmount;
  }

  if (key === "total") {
    return sale.grossAmount;
  }

  if (key === "nombredelcomprador") {
    return sale.customerName ?? "";
  }

  if (key === "mediodepago" || key === "mediopago") {
    return "Tienda Nube";
  }

  if (key === "canal") {
    return sale.source;
  }

  if (key === "mes") {
    return formatMonth(sale.orderedAt);
  }

  if (key === "identificadordelatransaccionenelmediodepago") {
    return "";
  }

  return "";
};

const resolveCellValue = (header: string, sale: SaleRecord, sheetTab: string): string | number => {
  if (sheetTab === TIENDANUBE_EXPORT_TAB) {
    return resolveTiendanubeCellValue(header, sale);
  }

  const key = normalizeHeader(header);
  const totalExpenses =
    sale.discountAmount + sale.marketplaceFeeAmount + sale.taxAmount + sale.iibbAmount + sale.otherChargesAmount;
  const paymentMethodByChannel: Record<SaleRecord["source"], string> = {
    tiendanube: "Tienda Nube",
    mercadolibre: "Mercado Pago",
    shopify: "Transferencia o Deposito bancario",
  };

  if (key.includes("fecha")) {
    return sale.orderedAt;
  }

  if (key.includes("canal") || key.includes("origen") || key.includes("fuente")) {
    return sale.source;
  }

  if (key.includes("order") || key.includes("pedido") || key.includes("ventaid") || key === "id") {
    return sale.orderId;
  }

  if (key.includes("estado") || key.includes("status")) {
    return sale.status;
  }

  if (key.includes("concepto") || key.includes("detalle") || key.includes("descripcion")) {
    return `Venta ${sale.source} ${sale.orderId}`;
  }

  if (key.includes("medio") && key.includes("pago")) {
    return paymentMethodByChannel[sale.source];
  }

  if (key.includes("medio") && key.includes("cobro")) {
    return paymentMethodByChannel[sale.source];
  }

  if (key.includes("cliente") || key.includes("customer")) {
    return sale.customerName ?? "";
  }

  if (key.includes("moneda") || key.includes("currency")) {
    return sale.currency;
  }

  if (key.includes("bruta") || key.includes("bruto") || key.includes("gross") || key.includes("totalventa")) {
    return sale.grossAmount;
  }

  if (key.includes("ingreso") || key.includes("cobrado") || key.includes("cobro")) {
    return sale.grossAmount;
  }

  if (key.includes("descuento") || key.includes("discount")) {
    return sale.discountAmount;
  }

  if (key.includes("envio") || key.includes("shipping")) {
    return sale.shippingAmount;
  }

  if (key.includes("comision") || key.includes("fee") || key.includes("marketplace")) {
    return sale.marketplaceFeeAmount;
  }

  if (key.includes("impuesto") || key.includes("tax")) {
    return sale.taxAmount;
  }

  if (key.includes("egreso") || key.includes("gasto") || key.includes("costo")) {
    return totalExpenses;
  }

  if (key.includes("monto") || key.includes("importe") || key.includes("valor")) {
    return sale.netAmount;
  }

  if (key.includes("iibb") || key.includes("ingresosbrutos")) {
    return sale.iibbAmount;
  }

  if (key.includes("otros") || key.includes("cargo") || key.includes("charges")) {
    return sale.otherChargesAmount;
  }

  if (key.includes("neto") || key.includes("net")) {
    return sale.netAmount;
  }

  return "";
};

const getHeaderScore = (row: string[]): number => {
  const knownTokens = [
    "fecha",
    "canal",
    "order",
    "pedido",
    "estado",
    "cliente",
    "moneda",
    "bruta",
    "descuento",
    "envio",
    "comision",
    "impuesto",
    "iibb",
    "neto",
  ];

  return row.reduce((acc, cell) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) {
      return acc;
    }

    const matches = knownTokens.some((token) => normalized.includes(token));
    return matches ? acc + 1 : acc;
  }, 0);
};

const detectTableHeaders = async (input: {
  spreadsheetId: string;
  sheetTab: string;
  sheets: ReturnType<typeof google.sheets>;
}): Promise<{ headers: string[]; headerRow: number }> => {
  const preview = await input.sheets.spreadsheets.values.get({
    spreadsheetId: input.spreadsheetId,
    range: `${input.sheetTab}!A1:AZ20`,
  });

  const rows = (preview.data.values ?? []) as string[][];
  if (!rows.length) {
    return { headers: DEFAULT_HEADERS, headerRow: 1 };
  }

  let bestIndex = 0;
  let bestScore = 0;

  rows.forEach((row, index) => {
    const score = getHeaderScore(row.map((cell) => String(cell ?? "")));
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestScore < 2) {
    return { headers: DEFAULT_HEADERS, headerRow: 1 };
  }

  const detectedHeaders = rows[bestIndex]
    .map((cell) => String(cell ?? "").trim())
    .filter((cell) => cell.length > 0);

  return {
    headers: detectedHeaders.length > 0 ? detectedHeaders : DEFAULT_HEADERS,
    headerRow: bestIndex + 1,
  };
};

const ensureSheetTab = async (input: {
  spreadsheetId: string;
  sheetTab: string;
  sheets: ReturnType<typeof google.sheets>;
}): Promise<void> => {
  const metadata = await input.sheets.spreadsheets.get({
    spreadsheetId: input.spreadsheetId,
    fields: "sheets.properties.title",
  });

  const existingTitles = new Set(
    (metadata.data.sheets ?? []).map((sheet) => String(sheet.properties?.title ?? "")).filter(Boolean),
  );

  if (existingTitles.has(input.sheetTab)) {
    return;
  }

  await input.sheets.spreadsheets.batchUpdate({
    spreadsheetId: input.spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: input.sheetTab },
          },
        },
      ],
    },
  });
};

const appendSalesToTab = async (input: {
  spreadsheetId: string;
  sheetTab: string;
  sheets: ReturnType<typeof google.sheets>;
  sales: SaleRecord[];
}): Promise<void> => {
  if (input.sales.length === 0) {
    return;
  }

  await ensureSheetTab({
    spreadsheetId: input.spreadsheetId,
    sheetTab: input.sheetTab,
    sheets: input.sheets,
  });

  const { headers, headerRow } = await detectTableHeaders({
    spreadsheetId: input.spreadsheetId,
    sheetTab: input.sheetTab,
    sheets: input.sheets,
  });

  const orderIdColIndex = headers.findIndex((header) => {
    const key = normalizeHeader(header);
    return (
      key === "numerodeorden" ||
      key === "identificadordelaorden" ||
      key.includes("order") ||
      key.includes("pedido") ||
      key.includes("orden") ||
      key.includes("ventaid") ||
      key === "id"
    );
  });

  let recordsToAppend = input.sales;
  if (orderIdColIndex >= 0) {
    const existing = await input.sheets.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: `${input.sheetTab}!A${headerRow + 1}:AZ`,
    });

    const existingOrderIds = new Set(
      (existing.data.values ?? [])
        .map((row) => String(row[orderIdColIndex] ?? "").trim())
        .filter((value) => value.length > 0),
    );

    recordsToAppend = input.sales.filter((sale) => !existingOrderIds.has(sale.orderId));
  }

  if (recordsToAppend.length === 0) {
    return;
  }

  const rows = recordsToAppend.map((sale) => headers.map((header) => resolveCellValue(header, sale, input.sheetTab)));

  await input.sheets.spreadsheets.values.append({
    spreadsheetId: input.spreadsheetId,
    range: `${input.sheetTab}!A${headerRow + 1}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
};

const getSheetsClient = (exportSettings?: ExportSettings) => {
  const serviceAccountRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = exportSettings?.spreadsheetId ?? process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!serviceAccountRaw || !spreadsheetId) {
    return null;
  }

  let credentials: { client_email: string; private_key: string };

  try {
    credentials = JSON.parse(serviceAccountRaw) as { client_email: string; private_key: string };
  } catch {
    return null;
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    spreadsheetId,
    sheets: google.sheets({ version: "v4", auth }),
  };
};

export const exportSalesToSheets = async (
  sales: SaleRecord[],
  exportSettings?: ExportSettings,
): Promise<{ ok: boolean; reason?: string }> => {
  const client = getSheetsClient(exportSettings);

  if (!client) {
    return {
      ok: false,
      reason: "Faltan GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_SHEETS_SPREADSHEET_ID en el entorno.",
    };
  }

  if (sales.length === 0) {
    return { ok: true };
  }

  const fallbackTab = exportSettings?.sheetTab?.trim() || process.env.GOOGLE_SHEETS_TAB || DEFAULT_SHEET_TAB;

  const grouped = sales.reduce<Record<SaleRecord["source"], SaleRecord[]>>(
    (acc, sale) => {
      acc[sale.source].push(sale);
      return acc;
    },
    {
      tiendanube: [],
      mercadolibre: [],
      shopify: [],
    },
  );

  for (const [channel, channelSales] of Object.entries(grouped) as Array<[SaleRecord["source"], SaleRecord[]]>) {
    if (channelSales.length === 0) {
      continue;
    }

    const destinationTab = CHANNEL_SHEET_TAB[channel] || fallbackTab;
    await appendSalesToTab({
      spreadsheetId: client.spreadsheetId,
      sheetTab: destinationTab,
      sheets: client.sheets,
      sales: channelSales,
    });
  }

  for (const tabName of GLOBAL_SHEET_TABS) {
    await appendSalesToTab({
      spreadsheetId: client.spreadsheetId,
      sheetTab: tabName,
      sheets: client.sheets,
      sales,
    });
  }

  if (fallbackTab !== DEFAULT_SHEET_TAB && !GLOBAL_SHEET_TABS.includes(fallbackTab)) {
    await appendSalesToTab({
      spreadsheetId: client.spreadsheetId,
      sheetTab: fallbackTab,
      sheets: client.sheets,
      sales,
    });
  }

  return { ok: true };
};
