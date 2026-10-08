import { NextResponse } from "next/server";

import {
  isQ2B10Authorized,
  setQ2B10ClassState,
} from "@/lib/q2/browser/multiUserPollingFixture";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isQ2B10Authorized(request.headers.get("x-q2-browser-fixture-authorized"))) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { classState?: unknown } | null;
  if (body?.classState !== "live" && body?.classState !== "ended") {
    return NextResponse.json(
      { ok: false, error: "classState must be live or ended" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const next = setQ2B10ClassState(body.classState);
  return NextResponse.json(
    { ok: true, ...next },
    { headers: { "Cache-Control": "no-store" } },
  );
}
