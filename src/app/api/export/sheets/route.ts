import { NextRequest, NextResponse } from "next/server";
import { exportSalesToSheets } from "@/lib/sheets";
import { readSettings } from "@/lib/settings";
import { filterSales, readSales } from "@/lib/storage";
import { SalesChannel } from "@/lib/types";

export const runtime = "nodejs";

const parseChannels = (raw: unknown): SalesChannel[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(
    (value): value is SalesChannel =>
      value === "tiendanube" || value === "shopify" || value === "mercadolibre",
  );
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const from = typeof body.from === "string" ? body.from : undefined;
  const to = typeof body.to === "string" ? body.to : undefined;
  const channels = parseChannels(body.channels);

  const all = await readSales();
  const filtered = filterSales(all, { from, to, channels });

  const settings = await readSettings();
  const result = await exportSalesToSheets(filtered, settings.exportSettings);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
  }

  return NextResponse.json({ ok: true, exportedRows: filtered.length, mode: "append" });
}
