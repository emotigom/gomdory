import { NextResponse } from "next/server";

import { isQ2B10FixtureEnabled, isQ2B5StudentCardFixtureEnabled } from "@/lib/q2/browser/studentEntryFixture";

export async function PUT(request: Request) {
  const authorization = request.headers.get("x-q2-browser-fixture-authorized");
  if (!isQ2B5StudentCardFixtureEnabled(authorization) && !isQ2B10FixtureEnabled(authorization)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
