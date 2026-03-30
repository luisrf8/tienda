import { NextRequest, NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";
import { fetchTiendanubeProducts } from "@/lib/tiendanube";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const settings = await readSettings();
  const connection = settings.connections.find((item) => item.channel === "tiendanube");

  if (!connection || !connection.enabled) {
    return NextResponse.json(
      { error: "La conexion Tiendanube no esta habilitada." },
      { status: 400 },
    );
  }

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = Number(limitRaw ?? 300);

  try {
    const items = await fetchTiendanubeProducts(connection, { limit });
    return NextResponse.json({
      ok: true,
      total: items.length,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron obtener productos de Tiendanube." },
      { status: 400 },
    );
  }
}