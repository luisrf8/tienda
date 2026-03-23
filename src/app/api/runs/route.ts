import { NextResponse } from "next/server";
import { readRuns } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  const runs = await readRuns();
  return NextResponse.json({ items: runs });
}
