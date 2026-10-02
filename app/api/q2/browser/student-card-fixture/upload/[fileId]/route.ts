import { NextResponse } from "next/server";

import { isQ2B5StudentCardFixtureEnabled } from "@/lib/q2/browser/studentEntryFixture";

export async function PUT(request: Request) {
  if (!isQ2B5StudentCardFixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
