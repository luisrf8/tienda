import { NextRequest, NextResponse } from "next/server";
import { calculateTotals } from "@/lib/metrics";
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const channels = parseChannels(searchParams.get("channels"));

  const sales = await readSales();
  const filtered = filterSales(sales, { from, to, channels });
  const totals = calculateTotals(filtered);

  return NextResponse.json({
    totals,
    items: filtered,
  });
}
