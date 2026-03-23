import { NextRequest, NextResponse } from "next/server";
import { testChannelConnection } from "@/lib/connectors";
import { ChannelConnection, SalesChannel } from "@/lib/types";

export const runtime = "nodejs";

const allowedChannels: SalesChannel[] = ["tiendanube", "shopify", "mercadolibre"];

const isValidConnection = (value: unknown): value is ChannelConnection => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybe = value as Partial<ChannelConnection>;
  return (
    !!maybe.channel &&
    allowedChannels.includes(maybe.channel) &&
    typeof maybe.enabled === "boolean" &&
    (maybe.mode === "demo" || maybe.mode === "api") &&
    typeof maybe.storeName === "string" &&
    !!maybe.credentials &&
    typeof maybe.credentials === "object"
  );
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!isValidConnection(body)) {
    return NextResponse.json({ error: "Payload de conexion invalido." }, { status: 400 });
  }

  try {
    const result = await testChannelConnection(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo validar la conexion." },
      { status: 400 },
    );
  }
}
