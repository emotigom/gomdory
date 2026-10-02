import { NextResponse } from "next/server";
import { isQ2B10Authorized, resetQ2B10Fixture } from "@/lib/q2/browser/multiUserPollingFixture";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { if (!isQ2B10Authorized(request.headers.get("x-q2-browser-fixture-authorized"))) return NextResponse.json({ ok: false }, { status: 404 }); const store = resetQ2B10Fixture(); return NextResponse.json({ ok: true, stateVersion: store.stateVersion }, { headers: { "Cache-Control": "no-store" } }); }
