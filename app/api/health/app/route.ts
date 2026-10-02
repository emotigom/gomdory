import { NextResponse } from "next/server";

import { probeAppResponsiveness } from "@/lib/status/healthProbes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = await probeAppResponsiveness();
  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
