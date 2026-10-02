import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { validateStudentText, ValidationError } from "@/lib/safety/validateStudentText";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";
import { normalizeHttpUrl, upsertCardUrlAttachment } from "@/lib/cards/urlAttachment";
import { buildShareCardPatchPayload, buildStudentCardSoftDeletePayload } from "@/lib/db/shareCardPayloads";
import { logAudit } from "@/lib/data/audit";
import { AUDIT_ACTIONS } from "@/lib/data/auditActions";
import { recordAuditEvent } from "@/lib/data/auditEvents";
import { shareCardOwnershipSelect } from "@/lib/db/shareQueries";
import { bumpBoardAndWallActivity, shouldBumpActivity } from "@/lib/db/activityBump";
import { getPublicShareWriteGuard, resolvePublicShareBoard } from "@/lib/share/public/access";

type OwnershipBody = {
  clientId?: string;
  text?: string;
  content?: string;
  body?: string;
  url?: string;
};

type CardUpdatePayload = Database["public"]["Tables"]["cards"]["Update"];

function hasExternalAttachments(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

async function loadCardFileSummary(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  cardId: string,
) {
  const { data, error } = await supabase
    .from("card_files")
    .select("boardFile:board_file_id(mime, deletedAt:deleted_at)")
    .eq("card_id", cardId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    boardFile: { mime: string | null; deletedAt: string | null } | null;
  }>;
  const activeFiles = rows.filter((row) => row.boardFile && !row.boardFile.deletedAt);
  return {
    hasFiles: activeFiles.length > 0,
    hasImage: activeFiles.some((row) => row.boardFile?.mime?.startsWith("image/")),
  };
}

async function loadStudentCardForShare(params: {
  cardId: string;
  boardId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cards")
    .select(shareCardOwnershipSelect)
    .eq("id", params.cardId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as
    | {
        id: string;
        text: string;
        authorType: string | null;
        authorClientId: string | null;
        externalAttachments: unknown;
        deletedAt: string | null;
        wallId: string;
        walls: { boardId: string } | null;
      }
    | null;

  if (!row || !row.walls || row.walls.boardId !== params.boardId || row.deletedAt) {
    return null;
  }

  if (row.authorType !== "student") {
    return null;
  }

  return { supabase, row };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string; cardId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  try {
    const { code, cardId } = await params;
    const body = (await request.json().catch(() => ({}))) as OwnershipBody;

    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!clientId) {
      return jsonErrorWithRequestId("VALIDATION_ERROR", "clientId is required", requestId, 400);
    }

    const { board } = await resolvePublicShareBoard(code);
    if (!board) {
      return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
    }

    const writeGuard = getPublicShareWriteGuard(board);
    if (!writeGuard.ok) {
      return jsonErrorWithRequestId(writeGuard.code, writeGuard.message, requestId, writeGuard.status);
    }

    const loaded = await loadStudentCardForShare({ cardId, boardId: board.id });
    if (!loaded) {
      return jsonErrorWithRequestId("CARD_NOT_FOUND", "카드를 찾을 수 없습니다.", requestId, 404);
    }

    const { supabase, row } = loaded;

    if (!row.authorClientId || row.authorClientId !== clientId) {
      return jsonErrorWithRequestId("FORBIDDEN", "허용되지 않은 요청입니다.", requestId, 403);
    }

    const rawText = typeof body.text === "string"
      ? body.text
      : typeof body.content === "string"
        ? body.content
        : typeof body.body === "string"
          ? body.body
          : "";
    const rawTrimmed = rawText.trim();
    let nextText = "";
    if (rawTrimmed.length === 0) {
      const fileSummary = await loadCardFileSummary(supabase, row.id);
      if (!fileSummary.hasFiles && !hasExternalAttachments(row.externalAttachments)) {
        return jsonErrorWithRequestId("VALIDATION_ERROR", "내용을 입력해 주세요.", requestId, 400);
      }
      nextText = fileSummary.hasImage ? "사진을 올렸어요!" : "자료를 올렸어요.";
    } else {
      try {
        nextText = validateStudentText(rawText, { maxLength: 500, minLength: 1, maxLines: 8, maskUrls: false }).text;
      } catch (error) {
        if (error instanceof ValidationError && error.code === "too_long") {
          return jsonErrorWithRequestId("VALIDATION_ERROR", "카드 내용은 500자 이내로 입력해주세요.", requestId, 400);
        }
        return jsonErrorWithRequestId("VALIDATION_ERROR", "내용을 입력해주세요.", requestId, 400);
      }
    }

    const rawUrl = typeof body.url === "string" ? body.url : "";
    const trimmedUrl = rawUrl.trim();
    const normalizedUrl = trimmedUrl ? normalizeHttpUrl(trimmedUrl) : null;
    if (trimmedUrl.length > 0 && !normalizedUrl) {
      return jsonErrorWithRequestId(
        "VALIDATION_ERROR",
        "URL은 http:// 또는 https://로 시작해야 합니다.",
        requestId,
        400,
      );
    }

    const nextExternalAttachments = upsertCardUrlAttachment(
      row.externalAttachments,
      normalizedUrl,
    );

    const { error: updateError } = await supabase
      .from("cards")
      .update(
        buildShareCardPatchPayload(
          nextText,
          nextExternalAttachments.length > 0 ? nextExternalAttachments : null,
        ) as CardUpdatePayload,
      )
      .eq("id", row.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (shouldBumpActivity(normalizedUrl ? "cardUpdateUrl" : "cardUpdateText")) {
      try {
        await bumpBoardAndWallActivity({ boardId: board.id, wallId: row.wallId });
      } catch (bumpError) {
        console.debug("activity_bump_failed", bumpError);
      }
    }

    void logAudit({
      boardId: board.id,
      action: AUDIT_ACTIONS.cardUpdated,
      targetType: "card",
      targetId: row.id,
      meta: {
        textLen: nextText.length,
      },
    });
    void recordAuditEvent({
      action: AUDIT_ACTIONS.cardUpdated,
      targetType: "card",
      targetId: row.id,
      meta: { boardId: board.id, cardId: row.id },
    });

    if (normalizedUrl) {
      void logAudit({
        boardId: board.id,
        action: AUDIT_ACTIONS.cardLinkAdded,
        targetType: "card",
        targetId: row.id,
        meta: { cardId: row.id },
      });
      void recordAuditEvent({
        action: AUDIT_ACTIONS.cardLinkAdded,
        targetType: "card",
        targetId: row.id,
        meta: { boardId: board.id, cardId: row.id },
      });
    }

    return jsonOkWithRequestId({ text: nextText }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonErrorWithRequestId("UPDATE_FAILED", message, requestId, 400);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string; cardId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  try {
    const { code, cardId } = await params;
    const body = (await request.json().catch(() => ({}))) as OwnershipBody;

    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!clientId) {
      return jsonErrorWithRequestId("VALIDATION_ERROR", "clientId is required", requestId, 400);
    }

    const { board } = await resolvePublicShareBoard(code);
    if (!board) {
      return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
    }

    const writeGuard = getPublicShareWriteGuard(board);
    if (!writeGuard.ok) {
      return jsonErrorWithRequestId(writeGuard.code, writeGuard.message, requestId, writeGuard.status);
    }

    const loaded = await loadStudentCardForShare({ cardId, boardId: board.id });
    if (!loaded) {
      return jsonErrorWithRequestId("CARD_NOT_FOUND", "카드를 찾을 수 없습니다.", requestId, 404);
    }

    const { supabase, row } = loaded;

    if (!row.authorClientId || row.authorClientId !== clientId) {
      return jsonErrorWithRequestId("FORBIDDEN", "허용되지 않은 요청입니다.", requestId, 403);
    }

    const now = new Date().toISOString();
    const { error: deleteError } = await supabase
      .from("cards")
      .update(buildStudentCardSoftDeletePayload(now) as CardUpdatePayload)
      .eq("id", row.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    void logAudit({
      boardId: board.id,
      action: AUDIT_ACTIONS.cardUpdated,
      targetType: "card",
      targetId: row.id,
      meta: {
        deleted: true,
      },
    });
    void recordAuditEvent({
      action: AUDIT_ACTIONS.cardUpdated,
      targetType: "card",
      targetId: row.id,
      meta: { boardId: board.id, cardId: row.id, deleted: true },
    });

    return jsonOkWithRequestId({}, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonErrorWithRequestId("DELETE_FAILED", message, requestId, 400);
  }
}
