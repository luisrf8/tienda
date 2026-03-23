import { NextRequest, NextResponse } from "next/server";
import { runSalesSync } from "@/lib/sync-service";
import { SalesChannel, SyncRequest } from "@/lib/types";

export const runtime = "nodejs";

const allowedChannels: SalesChannel[] = ["tiendanube", "shopify", "mercadolibre"];

const isValidSyncBody = (value: unknown): value is SyncRequest => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Partial<SyncRequest>;
  return (
    typeof v.from === "string" &&
    typeof v.to === "string" &&
    Array.isArray(v.channels) &&
    v.channels.every((c) => allowedChannels.includes(c))
  );
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!isValidSyncBody(body)) {
    return NextResponse.json(
      { error: "Body invalido. Se esperaba from, to y channels." },
      { status: 400 },
    );
  }

  try {
    const result = await runSalesSync({
      from: body.from,
      to: body.to,
      channels: body.channels,
      triggeredBy: "manual",
    });

    return NextResponse.json({
      requestedChannels: body.channels,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo sincronizar.",
      },
      { status: 400 },
    );
  }
}
