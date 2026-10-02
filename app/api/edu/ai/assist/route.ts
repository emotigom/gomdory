import { NextResponse } from "next/server";
import { runEduAiOrchestrator } from "@/lib/edu/ai/orchestrator/aiOrchestrator";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const maybe = body as { taskKind?: unknown } | null;
  if (!maybe || typeof maybe !== "object" || typeof maybe.taskKind !== "string") {
    return NextResponse.json({ ok: false, code: "EDU_AI_BAD_REQUEST" }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  try {
    const result = await runEduAiOrchestrator(body as never);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, code: "EDU_AI_BAD_REQUEST" }, { status: 400, headers: { "cache-control": "no-store" } });
  }
}
