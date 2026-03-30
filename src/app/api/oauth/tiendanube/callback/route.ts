import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings";
import { exchangeTiendanubeAuthorizationCode } from "@/lib/tiendanube";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  const storedState = request.cookies.get("tn_oauth_state")?.value;

  if (!code) {
    return NextResponse.json({ error: "Callback sin code de autorizacion." }, { status: 400 });
  }

  if (!state || !storedState || state !== storedState) {
    return NextResponse.json({ error: "State OAuth invalido o expirado." }, { status: 400 });
  }

  const settings = await readSettings();
  const connection = settings.connections.find((item) => item.channel === "tiendanube");
  const clientId = connection?.credentials.clientId?.trim();
  const clientSecret = connection?.credentials.clientSecret?.trim();

  if (!connection || !clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: "Configura client_id y client_secret en la conexion Tiendanube antes de autorizar.",
      },
      { status: 400 },
    );
  }

  try {
    const token = await exchangeTiendanubeAuthorizationCode({
      clientId,
      clientSecret,
      code,
    });

    const nextSettings = {
      ...settings,
      connections: settings.connections.map((item) => {
        if (item.channel !== "tiendanube") {
          return item;
        }

        return {
          ...item,
          mode: "api" as const,
          enabled: true,
          credentials: {
            ...item.credentials,
            accessToken: token.accessToken,
            sellerId: token.userId,
          },
        };
      }),
    };

    await writeSettings(nextSettings);

    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("tn_connected", "1");

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("tn_oauth_state");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo completar OAuth Tiendanube.",
      },
      { status: 400 },
    );
  }
}