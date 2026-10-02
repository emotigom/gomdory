import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { isValidBoardId } from "@/lib/board/idValidation";
import { updateWebCodingLiteHintSettingsForBoard } from "@/lib/lesson-activities/progress";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

type WebStudioSettingsRouteDeps = {
  requireUserApiFn?: typeof requireUserApi;
  updateWebCodingLiteHintSettingsForBoardFn?: typeof updateWebCodingLiteHintSettingsForBoard;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  deps: WebStudioSettingsRouteDeps = {},
) {
  const { boardId } = await params;
  if (!isValidBoardId(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const requireUserApiFn = deps.requireUserApiFn ?? requireUserApi;
  const updateSettings = deps.updateWebCodingLiteHintSettingsForBoardFn ?? updateWebCodingLiteHintSettingsForBoard;

  const { user } = await requireUserApiFn().catch(() => ({ user: null }));
  if (!user) {
    return jsonError("unauthorized", "로그인이 필요합니다.", 401);
  }

  const body = (await request.json().catch(() => null)) as { hintsEnabled?: unknown } | null;
  if (typeof body?.hintsEnabled !== "boolean") {
    return jsonError("invalid_hints_enabled", "힌트 설정 값이 올바르지 않습니다.");
  }

  try {
    const payload = await updateSettings({
      boardId,
      actor: { userId: user.id },
      hintsEnabled: body.hintsEnabled,
    });
    return NextResponse.json({ ok: true, data: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "웹 스튜디오 힌트 설정을 저장하지 못했습니다.";
    const status = message.includes("권한") ? 403 : message.includes("로그인") ? 401 : message.includes("없습니다") ? 404 : 502;
    return jsonError("web_studio_settings_failed", message, status);
  }
}
