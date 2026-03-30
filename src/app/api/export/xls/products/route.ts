import { NextRequest, NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";
import { fetchTiendanubeProducts } from "@/lib/tiendanube";

export const runtime = "nodejs";

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
  const settings = await readSettings();
  const connection = settings.connections.find((item) => item.channel === "tiendanube");

  if (!connection || !connection.enabled) {
    return NextResponse.json({ error: "La conexion Tiendanube no esta habilitada." }, { status: 400 });
  }

  const limit = Math.max(50, Math.min(5000, Number(request.nextUrl.searchParams.get("limit") ?? 1000)));
  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const allItems = await fetchTiendanubeProducts(connection, { limit });
    const items = q
      ? allItems.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.id.toLowerCase().includes(q) ||
            item.sku.toLowerCase().includes(q),
        )
      : allItems;

    const headers = [
      "ID",
      "Producto",
      "SKU",
      "Precio",
      "Precio Promocional",
      "Stock",
      "Variantes",
      "Publicado",
      "Envio Gratis",
      "Permalink",
      "Creado",
      "Actualizado",
    ];

    const rows: Array<Array<string | number>> = items.map((item) => [
      item.id,
      item.name,
      item.sku,
      item.price ?? "",
      item.promotionalPrice ?? "",
      item.stock,
      item.variants,
      item.published ? "Si" : "No",
      item.freeShipping ? "Si" : "No",
      item.permalink,
      item.createdAt,
      item.updatedAt,
    ]);

    const content = buildXlsContent([headers, ...rows]);
    const suffix = q ? "filtrado" : "completo";
    const filename = `productos-tiendanube-${suffix}-${new Date().toISOString().slice(0, 10)}.xls`;

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename=${filename}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron exportar productos." },
      { status: 400 },
    );
  }
}