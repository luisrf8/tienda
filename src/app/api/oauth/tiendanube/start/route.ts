import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildTiendanubeAuthorizeUrl } from "@/lib/tiendanube";
import { readSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const settings = await readSettings();
  const connection = settings.connections.find((item) => item.channel === "tiendanube");

  const clientId = connection?.credentials.clientId?.trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "Falta client_id de Tiendanube en Configuracion > Conexiones." },
      { status: 400 },
    );
  }

  const state = crypto.randomUUID();
  const authorizeUrl = buildTiendanubeAuthorizeUrl(clientId, state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("tn_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}