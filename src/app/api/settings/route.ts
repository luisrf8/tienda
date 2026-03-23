import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings";
import { AppSettings, SalesChannel } from "@/lib/types";

export const runtime = "nodejs";

const allowedChannels: SalesChannel[] = ["tiendanube", "shopify", "mercadolibre"];

const isValidSettings = (value: unknown): value is AppSettings => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybe = value as Partial<AppSettings>;
  return (
    Array.isArray(maybe.connections) &&
    Array.isArray(maybe.automations) &&
    !!maybe.exportSettings &&
    maybe.connections.every((connection) => allowedChannels.includes(connection.channel))
  );
};

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!isValidSettings(body)) {
    return NextResponse.json({ error: "Payload de settings invalido." }, { status: 400 });
  }

  await writeSettings(body);
  return NextResponse.json({ ok: true });
}
