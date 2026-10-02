import { NextResponse } from "next/server";
import { isQ2B10Authorized, q2B10Snapshot } from "@/lib/q2/browser/multiUserPollingFixture";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return isQ2B10Authorized(request.headers.get("x-q2-browser-fixture-authorized")) ? NextResponse.json({ ok: true, ...q2B10Snapshot() }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ ok: false }, { status: 404 }); }
