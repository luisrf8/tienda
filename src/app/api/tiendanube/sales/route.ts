import { NextRequest, NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";
import { fetchTiendanubeOrders } from "@/lib/tiendanube";

export const runtime = "nodejs";

const last30DaysRange = () => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
};

export async function GET(request: NextRequest) {
  const settings = await readSettings();
  const connection = settings.connections.find((item) => item.channel === "tiendanube");

  if (!connection || !connection.enabled) {
    return NextResponse.json({ error: "La conexion Tiendanube no esta habilitada." }, { status: 400 });
  }

  const fallbackRange = last30DaysRange();
  const from = request.nextUrl.searchParams.get("from") ?? fallbackRange.from;
  const to = request.nextUrl.searchParams.get("to") ?? fallbackRange.to;
  const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 200), 2000));

  try {
    const items = await fetchTiendanubeOrders(connection, from, to);
    return NextResponse.json({
      ok: true,
      total: items.length,
      items: items.slice(0, limit),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron obtener ventas de Tiendanube." },
      { status: 400 },
    );
  }
}