import { NextResponse } from "next/server";
import { resetGoogleDriveIntegrationFixture } from "@/lib/q2/browser/googleDriveIntegrationFixture";
import { isQ2B9FixtureAuthorized } from "@/lib/q2/browser/resultDownloadFixture";

export async function POST(request: Request) {
  if (!isQ2B9FixtureAuthorized(request.headers.get("x-q2-browser-fixture-authorized"))) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, fixtureDataVersion: resetGoogleDriveIntegrationFixture() }, { headers: { "Cache-Control": "no-store" } });
}
