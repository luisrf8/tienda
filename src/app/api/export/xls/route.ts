import { NextRequest, NextResponse } from "next/server";
import { filterSales, readSales } from "@/lib/storage";
import { SalesChannel } from "@/lib/types";

export const runtime = "nodejs";

const parseChannels = (raw: string | null): SalesChannel[] => {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is SalesChannel =>
      item === "tiendanube" || item === "shopify" || item === "mercadolibre",
    );
};

const buildXlsContent = (rows: Array<Array<string | number>>): string => {
  const escapeCell = (value: string | number): string => {
    const text = String(value ?? "");
    if (text.includes("\t") || text.includes("\n") || text.includes('"')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return rows.map((row) => row.map(escapeCell).join("\t")).join("\n");
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const includeAll = searchParams.get("all") === "1";
  const from = includeAll ? undefined : searchParams.get("from") ?? undefined;
  const to = includeAll ? undefined : searchParams.get("to") ?? undefined;
  const channels = includeAll ? [] : parseChannels(searchParams.get("channels"));

  const allSales = await readSales();
  const sales = filterSales(allSales, { from, to, channels });

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

  const rows: Array<Array<string | number>> = sales.map((sale) => [
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

  const fileRows = [headers, ...rows];
  const content = buildXlsContent(fileRows);
  const suffix = includeAll ? "all" : "filtered";
  const filename = `ventas-${suffix}-${new Date().toISOString().slice(0, 10)}.xls`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
      "Cache-Control": "no-store",
    },
  });
}