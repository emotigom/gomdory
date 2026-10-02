import { NextResponse } from "next/server";

import {
  isQ2B5StudentCardFixtureEnabled,
  q4StudentComposeFixtureLedger,
  resetQ2B5StudentCardFixtureStore,
  setQ4StudentComposeFixtureScenario,
} from "@/lib/q2/browser/studentEntryFixture";

export const dynamic = "force-dynamic";

/** Test-only reset seam: middleware has already limited its authorization to local B5 fixture traffic. */
export async function POST(request: Request) {
  if (!isQ2B5StudentCardFixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  resetQ2B5StudentCardFixtureStore();
  const body: unknown = await request.json().catch(() => null);
  const scenario = typeof body === "object" && body !== null && "scenario" in body ? body.scenario : "success";
  if (!setQ4StudentComposeFixtureScenario(scenario)) return NextResponse.json({ ok: false }, { status: 400 });
  return NextResponse.json({ ok: true, ledger: q4StudentComposeFixtureLedger() }, { headers: { "Cache-Control": "no-store" } });
}
