import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isValidBoardId } from "@/lib/board/idValidation";
import {
  endActiveLessonSessionForBoard,
  startLessonSessionForBoard,
} from "@/lib/lesson-activities/sessions";
import { getLessonTemplate, type LessonTemplate } from "@/lib/lesson-activities/registry";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

type LessonSessionRouteDeps = {
  requireUserApiFn?: typeof requireUserApi;
  startLessonSessionForBoardFn?: typeof startLessonSessionForBoard;
  endActiveLessonSessionForBoardFn?: typeof endActiveLessonSessionForBoard;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  deps: LessonSessionRouteDeps = {},
) {
  const { boardId } = await params;
  if (!isValidBoardId(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const requireUserApiFn = deps.requireUserApiFn ?? requireUserApi;
  const startLessonSessionForBoardFn = deps.startLessonSessionForBoardFn ?? startLessonSessionForBoard;

  const { user } = await requireUserApiFn().catch(() => ({ user: null }));
  if (!user) {
    return jsonError("unauthorized", "로그인이 필요합니다.", 401);
  }

  const body = (await request.json().catch(() => null)) as { lessonTemplateId?: unknown } | null;
  const lessonTemplateId = typeof body?.lessonTemplateId === "string" ? body.lessonTemplateId : "";
  const template = getLessonTemplate(lessonTemplateId as LessonTemplate["id"]);
  if (!template) {
    return jsonError("invalid_lesson_template", "지원하지 않는 수업 실습 템플릿입니다.");
  }

  try {
    const activeSession = await startLessonSessionForBoardFn(boardId, template.id, { userId: user.id });
    return NextResponse.json({ ok: true, data: activeSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : "수업 실습을 시작하지 못했습니다.";
    const status = message.includes("권한") ? 403 : message.includes("로그인") ? 401 : 502;
    return jsonError("lesson_session_start_failed", message, status);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  deps: LessonSessionRouteDeps = {},
) {
  const { boardId } = await params;
  if (!isValidBoardId(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const requireUserApiFn = deps.requireUserApiFn ?? requireUserApi;
  const endActiveLessonSessionForBoardFn = deps.endActiveLessonSessionForBoardFn ?? endActiveLessonSessionForBoard;

  const { user } = await requireUserApiFn().catch(() => ({ user: null }));
  if (!user) {
    return jsonError("unauthorized", "로그인이 필요합니다.", 401);
  }

  try {
    const endedSession = await endActiveLessonSessionForBoardFn(boardId, { userId: user.id });
    return NextResponse.json({ ok: true, data: endedSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : "수업 실습을 종료하지 못했습니다.";
    const status = message.includes("권한") ? 403 : message.includes("로그인") ? 401 : 502;
    return jsonError("lesson_session_end_failed", message, status);
  }
}
