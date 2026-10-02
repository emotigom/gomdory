import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isValidBoardId, isValidUuid } from "@/lib/board/idValidation";
import { createWebCodingLiteSubmissionBoardCard } from "@/lib/lesson-activities/progress";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

type WebStudioCreateCardRouteDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createWebCodingLiteSubmissionBoardCardFn?: typeof createWebCodingLiteSubmissionBoardCard;
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ boardId: string; stateId: string }> },
  deps: WebStudioCreateCardRouteDeps = {},
) {
  const { boardId, stateId } = await params;
  if (!isValidBoardId(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }
  if (!isValidUuid(stateId)) {
    return jsonError("invalid_state_id", "제출물 ID 형식이 올바르지 않습니다.");
  }

  const requireUserApiFn = deps.requireUserApiFn ?? requireUserApi;
  const createCard = deps.createWebCodingLiteSubmissionBoardCardFn ?? createWebCodingLiteSubmissionBoardCard;

  const { user } = await requireUserApiFn().catch(() => ({ user: null }));
  if (!user) {
    return jsonError("unauthorized", "로그인이 필요합니다.", 401);
  }

  try {
    const result = await createCard({ boardId, stateId, actor: { userId: user.id } });
    return NextResponse.json({
      ok: true,
      data: {
        cardId: result.cardId,
        wallId: result.wallId,
        studentLabel: result.studentLabel,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "보드 카드 생성에 실패했어요.";
    const status = message.includes("권한") ? 403 : message.includes("로그인") ? 401 : message.includes("속하지") || message.includes("없습니다") ? 404 : 502;
    return jsonError("web_studio_submission_card_failed", message, status);
  }
}
