import { NextRequest, NextResponse } from "next/server";
import { isQ2B9ELlmFixtureRequest, q2B9ELlmFixtureSnapshot, resetQ2B9ELlmFixture } from "@/lib/q2/browser/llmIntegrationFixture";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  if (!isQ2B9ELlmFixtureRequest(request)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { operation?: unknown; behavior?: unknown } | null;
  if (body?.operation === "snapshot") return NextResponse.json({ snapshot: q2B9ELlmFixtureSnapshot() });
  if (body?.operation === "reset" && (body.behavior === undefined || body.behavior === "success" || body.behavior === "timeout")) {
    resetQ2B9ELlmFixture(body.behavior ?? "success");
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}
