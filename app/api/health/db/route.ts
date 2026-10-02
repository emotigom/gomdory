import { NextResponse } from "next/server";

import { probeDatabaseReachability } from "@/lib/status/healthProbes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = await probeDatabaseReachability();
  return NextResponse.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
