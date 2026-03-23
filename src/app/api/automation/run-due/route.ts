import { NextRequest, NextResponse } from "next/server";
import { runDueAutomations } from "@/lib/sync-service";

export const runtime = "nodejs";

const isAuthorized = (request: NextRequest): boolean => {
  const expectedKey = process.env.AUTOMATION_API_KEY;
  if (!expectedKey) {
    return true;
  }

  return request.headers.get("x-automation-key") === expectedKey;
};

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const result = await runDueAutomations();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron ejecutar automatizaciones." },
      { status: 400 },
    );
  }
}
