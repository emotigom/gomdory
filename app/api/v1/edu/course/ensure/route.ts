import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { ensureEduLessonLinkCard } from "@/lib/edu/lessonLinkGenerator";
import { ensureEduPracticeTemplateCards } from "@/lib/edu/practiceTemplateGenerator";
import { getBoard } from "@/lib/data/boards.server";
import { createCard, listWallCardsForEduLink, updateCardExternalAttachments, updateCardText } from "@/lib/data/cards";
import { generateShareCode } from "@/lib/data/share";
import { createWall, listWalls, reorderWalls } from "@/lib/data/walls";
import { jsonErrorWithRequestId } from "@/lib/standards/apiServer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { getShortPreferredOrigin, getTeacherCanonicalOrigin } from "@/lib/http/siteConfig";
import { buildEduClassInsertPayload, buildEduJoinCodeInsertPayload } from "@/lib/db/eduClassPayloads";

type EnsureResponse = {
  ok: true;
  shareCode: string;
  joinShortUrl: string;
  courseUrl: string;
  entryUrl: string;
  createdCount: number;
  updatedCount: number;
};

type ErrorResponse = {
  ok: false;
  message: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message } satisfies ErrorResponse, { status });
}

async function ensureEduShareCode(boardId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("edu_classes")
    .select("share_code")
    .eq("board_id", boardId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.share_code) {
    await ensureEduJoinCode(admin, boardId, existing.share_code);
    return existing.share_code;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareCode = generateShareCode();
    const { error: insertError } = await admin
      .from("edu_classes")
      .insert(buildEduClassInsertPayload(boardId, shareCode))
      .select("share_code")
      .single();

    if (!insertError) {
      await ensureEduJoinCode(admin, boardId, shareCode);
      return shareCode;
    }

    if (insertError.code === "23505") {
      const { data: row } = await admin
        .from("edu_classes")
        .select("share_code")
        .eq("board_id", boardId)
        .maybeSingle();

      if (row?.share_code) {
        await ensureEduJoinCode(admin, boardId, row.share_code);
        return row.share_code;
      }
      lastError = new Error("share_code_conflict");
      continue;
    }

    lastError = new Error(insertError.message);
    break;
  }

  throw lastError ?? new Error("share_code_conflict");
}

async function ensureEduJoinCode(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  boardId: string,
  shareCode: string,
) {
  const { error } = await admin
    .from("edu_join_codes")
    .insert(buildEduJoinCodeInsertPayload(shareCode, boardId))
    .select("code")
    .single();

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = getOrCreateRequestId(request);
  let boardId = "";
  let mode: "lessonLink" | "practiceTemplate" = "lessonLink";
  try {
    const payload = (await request.json().catch(() => null)) as { boardId?: unknown; mode?: unknown } | null;
    boardId = typeof payload?.boardId === "string" ? payload.boardId.trim() : "";
    mode = payload?.mode === "practiceTemplate" ? "practiceTemplate" : "lessonLink";
  } catch {
    boardId = "";
    mode = "lessonLink";
  }

  if (!boardId) {
    return jsonError("boardId 값이 필요합니다.", 400);
  }

  const authorName = "선생님";
  try {
    await requireUserApi();
  } catch {
    return jsonError("인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole) {
    return jsonError("보드를 확인하지 못했습니다.", 404);
  }

  if (boardRole === "viewer") {
    return jsonError("이 보드에 접근할 수 없습니다.", 403);
  }

  const { board, error: boardError } = await getBoard(boardId);

  if (boardError || !board) {
    return jsonError("보드를 찾을 수 없습니다.", 404);
  }

  const boardShareCode = board.share_code?.trim() ?? "";

  if (!boardShareCode) {
    return jsonError("공유 코드를 찾을 수 없습니다.", 404);
  }

  let shareCode = "";

  try {
    shareCode = await ensureEduShareCode(boardId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "EDU 코드를 생성하지 못했습니다.";
    return jsonError(message, 500);
  }

  async function ensureAtLeastOneWall(targetBoardId: string) {
    let walls = await listWalls(targetBoardId);
    if (walls.length > 0) return walls;

    try {
      await createWall({
        boardId: targetBoardId,
        title: "첫 섹션",
      });
    } catch {
      // ignore here, we will re-check via listWalls
    }

    walls = await listWalls(targetBoardId);
    if (walls.length === 0) {
      throw new Error("ensure_wall_failed");
    }
    return walls;
  }

  try {
    await ensureAtLeastOneWall(boardId);
  } catch {
    return jsonErrorWithRequestId(
      "E_WALL_AUTO_CREATE_FAILED",
      "처음 보드에서는 섹션을 자동으로 준비합니다. 섹션을 만들지 못했어요. 새로고침 후 다시 시도하거나 우측 하단 관리 버튼에서 섹션을 만든 뒤 다시 시도해 주세요.",
      requestId,
      500,
    );
  }

  const teacherOrigin = getTeacherCanonicalOrigin();
  const shortOrigin = getShortPreferredOrigin();
  const entryUrl = new URL(`/edu?code=${encodeURIComponent(shareCode)}`, teacherOrigin).toString();
  const joinShortUrl = new URL(`/s/${encodeURIComponent(shareCode)}`, shortOrigin).toString();
  const courseUrl = entryUrl;

  let createdCount = 0;
  let updatedCount = 0;
  try {
    const ensureResult = await ensureEduLessonLinkCard(
      {
        listWalls,
        createWall,
        reorderWalls,
        listWallCardsForEduLink,
        createCard,
        updateCardExternalAttachments,
      },
      {
        boardId,
        entryUrl,
        authorName,
      },
    );
    createdCount = ensureResult.createdCount;

    if (mode === "practiceTemplate") {
      const templateResult = await ensureEduPracticeTemplateCards(
        {
          listWalls,
          createWall,
          reorderWalls,
          listWallCardsForEduLink,
          createCard,
          updateCardExternalAttachments,
          updateCardText,
        },
        {
          boardId,
          entryUrl,
          authorName,
        },
      );
      createdCount += templateResult.createdCount;
      updatedCount = templateResult.updatedCount;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "입장 링크 카드를 준비하지 못했습니다.";
    return jsonError(message, 500);
  }

  const response: EnsureResponse = {
    ok: true,
    shareCode,
    joinShortUrl,
    courseUrl,
    entryUrl,
    createdCount,
    updatedCount,
  };

  revalidatePath(`/dashboard/boards/${boardId}/class`);
  revalidatePath(`/dashboard/boards/${boardId}/grid`);

  return NextResponse.json(response);
}
