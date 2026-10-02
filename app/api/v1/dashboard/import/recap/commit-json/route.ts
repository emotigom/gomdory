import { NextResponse } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { importRecapData, parseRecapPayload } from "@/lib/recap/importer";

function buildErrorResponse(status: number, code: string, userMessage: string) {
  return NextResponse.json({ code, userMessage, error: userMessage }, { status });
}

export async function POST(request: Request) {
  let userId = "";
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return buildErrorResponse(401, "unauthorized", "로그인이 필요합니다.");
  }

  let payload: {
    recapJson?: string;
    mode?: "new" | "existing";
    targetBoardId?: string;
    title?: string;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return buildErrorResponse(400, "invalid_body", "요청 형식이 올바르지 않습니다.");
  }

  if (typeof payload.recapJson !== "string") {
    return buildErrorResponse(400, "recap_missing", "가져오기 파일이 없습니다.");
  }

  if (payload.mode !== "new" && payload.mode !== "existing") {
    return buildErrorResponse(400, "mode_invalid", "가져오기 모드가 올바르지 않습니다.");
  }

  if (payload.mode === "existing" && !payload.targetBoardId) {
    return buildErrorResponse(400, "board_missing", "보드를 선택해주세요.");
  }

  let recapPayload;
  try {
    recapPayload = parseRecapPayload(payload.recapJson);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "recap.json 검증에 실패했습니다.";
    return buildErrorResponse(400, "recap_invalid", message);
  }

  const supabase = createSupabaseAdminClient();
  let importResult;
  try {
    importResult = await importRecapData({
      supabase,
      ownerId: userId,
      mode: payload.mode,
      boardId: payload.targetBoardId,
      boardTitle:
        payload.mode === "new" && typeof payload.title === "string" ? payload.title : undefined,
      recap: recapPayload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가져오기에 실패했습니다.";
    return buildErrorResponse(400, "import_failed", message);
  }

  const importedWalls = recapPayload.walls.length;
  const externalAttachmentsKept = recapPayload.walls.reduce((sum, wall) => {
    const wallCount = wall.cards.reduce(
      (cardSum, card) => cardSum + card.externalAttachments.length,
      0,
    );
    return sum + wallCount;
  }, 0);

  return NextResponse.json({
    boardId: importResult.boardId,
    importedWalls,
    importedCards: importResult.importedCards,
    importedFiles: 0,
    missingFiles: [],
    externalAttachmentsKept,
  });
}
