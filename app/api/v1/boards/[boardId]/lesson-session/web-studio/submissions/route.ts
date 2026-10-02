import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isValidBoardId } from "@/lib/board/idValidation";
import { getWebCodingLiteSubmissionsForBoard } from "@/lib/lesson-activities/progress";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

type WebStudioSubmissionsRouteDeps = {
  requireUserApiFn?: typeof requireUserApi;
  getWebCodingLiteSubmissionsForBoardFn?: typeof getWebCodingLiteSubmissionsForBoard;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  deps: WebStudioSubmissionsRouteDeps = {},
) {
  const { boardId } = await params;
  if (!isValidBoardId(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const requireUserApiFn = deps.requireUserApiFn ?? requireUserApi;
  const getSubmissions = deps.getWebCodingLiteSubmissionsForBoardFn ?? getWebCodingLiteSubmissionsForBoard;

  const { user } = await requireUserApiFn().catch(() => ({ user: null }));
  if (!user) {
    return jsonError("unauthorized", "로그인이 필요합니다.", 401);
  }

  try {
    const payload = await getSubmissions(boardId, { userId: user.id });
    return NextResponse.json({ ok: true, data: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "웹 코딩 제출물을 불러오지 못했습니다.";
    const status = message.includes("권한") ? 403 : message.includes("로그인") ? 401 : message.includes("없습니다") ? 404 : 502;
    return jsonError("web_studio_submissions_failed", message, status);
  }
}
