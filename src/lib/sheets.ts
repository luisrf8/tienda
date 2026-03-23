import { google } from "googleapis";
import { ExportSettings, SaleRecord } from "@/lib/types";

const getSheetsClient = (exportSettings?: ExportSettings) => {
  const serviceAccountRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = exportSettings?.spreadsheetId ?? process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetTab = exportSettings?.sheetTab ?? process.env.GOOGLE_SHEETS_TAB ?? "Ventas";

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
    sheetTab,
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

  const headers = [
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

  const rows = sales.map((sale) => [
    sale.orderedAt,
    sale.source,
    sale.orderId,
    sale.status,
    sale.customerName ?? "",
    sale.currency,
    sale.grossAmount,
    sale.discountAmount,
    sale.shippingAmount,
    sale.marketplaceFeeAmount,
    sale.taxAmount,
    sale.iibbAmount,
    sale.otherChargesAmount,
    sale.netAmount,
  ]);

  const values = [headers, ...rows];

  await client.sheets.spreadsheets.values.clear({
    spreadsheetId: client.spreadsheetId,
    range: `${client.sheetTab}!A:N`,
  });

  await client.sheets.spreadsheets.values.update({
    spreadsheetId: client.spreadsheetId,
    range: `${client.sheetTab}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return { ok: true };
};
