import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { startLessonRun, type StartLessonRunInput, type StartLessonRunResult } from "@/lib/lesson-run/startLessonRun";

type StartLessonRunRouteDeps = {
  startLessonRunFn?: typeof startLessonRun;
  requireUserApiFn?: typeof requireUserApi;
};

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "cache-control": "no-store" } });
}

function error(code: string, message: string, status = 400) {
  return json({ ok: false, error: { code, message } }, status);
}

function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("application/json");
}

function resultPayload(result: StartLessonRunResult) {
  return {
    ok: result.ok,
    disposition: result.disposition,
    message: result.message,
    sessionId: result.sessionId,
    lessonRunState: result.lessonRunState,
    validation: result.validation,
    diagnosticsWarnings: result.diagnosticsWarnings,
  };
}

async function handlePost(request: Request, deps: StartLessonRunRouteDeps = {}) {
  if (!isJsonRequest(request)) {
    return error("json_required", "JSON 요청만 지원합니다.", 415);
  }

  const body = await request.json().catch(() => null) as Partial<StartLessonRunInput> | null;
  const boardId = typeof body?.boardId === "string" ? body.boardId.trim() : "";
  if (!boardId) {
    return error("board_id_required", "boardId가 필요합니다.", 400);
  }

  const startLessonRunFn = deps.startLessonRunFn ?? startLessonRun;
  const result = await startLessonRunFn(
    {
      boardId,
      requestedPreset: typeof body?.requestedPreset === "string" ? body.requestedPreset : null,
      durationMinutes: typeof body?.durationMinutes === "number" ? body.durationMinutes : null,
      options: body?.options ?? null,
      idempotencyKey: typeof body?.idempotencyKey === "string" ? body.idempotencyKey : null,
      clientRequestId: typeof body?.clientRequestId === "string" ? body.clientRequestId : null,
    },
    deps.requireUserApiFn ? { requireUserApiFn: deps.requireUserApiFn } : {},
  );

  return json(resultPayload(result), result.httpStatus);
}

export async function POST(request: Request) {
  return handlePost(request);
}
