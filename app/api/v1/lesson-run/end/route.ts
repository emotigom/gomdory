import { NextResponse } from "next/server";

import { endLessonRun, type EndLessonRunInput, type EndLessonRunResult } from "@/lib/lesson-run/endLessonRun";

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "cache-control": "no-store" } });
}

function error(code: string, message: string, status = 400) {
  return json({ ok: false, error: { code, message } }, status);
}

function isJsonRequest(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
}

function resultPayload(result: EndLessonRunResult) {
  return {
    ok: result.ok,
    disposition: result.disposition,
    message: result.message,
    sessionId: result.sessionId,
    endedSessionIds: result.endedSessionIds,
    lessonRunState: result.lessonRunState,
    validation: result.validation,
    diagnosticsWarnings: result.diagnosticsWarnings,
  };
}

export async function POST(request: Request) {
  if (!isJsonRequest(request)) return error("json_required", "JSON 요청만 지원합니다.", 415);

  const body = await request.json().catch(() => null) as Partial<EndLessonRunInput> | null;
  const boardId = typeof body?.boardId === "string" ? body.boardId.trim() : "";
  if (!boardId) return error("board_id_required", "boardId가 필요합니다.", 400);

  const result = await endLessonRun({
    boardId,
    idempotencyKey: typeof body?.idempotencyKey === "string" ? body.idempotencyKey : null,
    clientRequestId: typeof body?.clientRequestId === "string" ? body.clientRequestId : null,
  });
  return json(resultPayload(result), result.httpStatus);
}
