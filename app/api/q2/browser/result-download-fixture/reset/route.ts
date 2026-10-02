import { NextResponse } from "next/server";
import { isQ2B8FixtureAuthorized, resetResultDownloadScenario } from "@/lib/q2/browser/resultDownloadFixture";
export async function POST(request: Request) { if (!isQ2B8FixtureAuthorized(request.headers.get("x-q2-browser-fixture-authorized"))) return NextResponse.json({ ok: false }, { status: 404 }); const store = resetResultDownloadScenario(); return NextResponse.json({ ok: true, fixtureDataVersion: store.stateVersion }, { headers: { "Cache-Control": "no-store" } }); }
