import { NextResponse } from "next/server";

import { getActiveBanner } from "@/lib/ops/banners.server";

export async function GET() {
  const banner = await getActiveBanner();

  return NextResponse.json({
    ok: true,
    message: banner?.message ?? null,
    level: banner?.level ?? "info",
    updatedAt: null,
  });
}
