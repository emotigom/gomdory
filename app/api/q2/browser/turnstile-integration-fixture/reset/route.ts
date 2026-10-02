import { NextResponse } from "next/server";
import { isQ2B9DTurnstileFixtureEnabled } from "@/lib/q2/browser/studentEntryFixture";
import { issueQ2B9DTurnstileChallenge, q2B9DTurnstileFixtureSnapshot, resetQ2B9DTurnstileFixture } from "@/lib/q2/browser/turnstileIntegrationFixture";

export const dynamic = "force-dynamic";

function denied() { return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 }); }
export async function POST(request: Request) {
  if (!isQ2B9DTurnstileFixtureEnabled(request.headers.get("x-q2-browser-fixture-authorized"))) return denied();
  const body = await request.json().catch(() => null) as { operation?: string; hostname?: string; action?: string; cdata?: string } | null;
  if (body?.operation === "reset") { resetQ2B9DTurnstileFixture(); return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }); }
  if (body?.operation === "issue" && body.hostname) return NextResponse.json({ ok: true, token: issueQ2B9DTurnstileChallenge({ hostname: body.hostname, action: body.action, cdata: body.cdata }) }, { headers: { "Cache-Control": "no-store" } });
  if (body?.operation === "snapshot") return NextResponse.json({ ok: true, snapshot: q2B9DTurnstileFixtureSnapshot() }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ ok: false, error: { code: "INVALID_REQUEST" } }, { status: 400 });
}
