import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import {
  convertQuestionToCard,
  getPinnedForBoard,
  listQuestionsForBoard,
  updateQuestion,
  type QuestionStatus,
} from "@/lib/data/questions";
import { upsertBoardLiveSession } from "@/lib/data/liveSession";
import { goneResponse } from "@/lib/http/gone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_STATUSES: QuestionStatus[] = [
  "queued",
  "approved",
  "pinned",
  "archived",
  "deleted",
];

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function ensureBoardAccess(boardId: string) {
  try {
    await requireUserApi();
  } catch {
    return { ok: false as const, response: jsonError("unauthorized", "인증이 필요합니다.", 401) };
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return { ok: false as const, response: jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403) };
  }

  return { ok: true as const };
}

async function ensureQuestionsEnabled(boardId: string) {
  const supabase = createSupabaseServerClient();
  const { data: board, error } = await supabase
    .from("boards")
    .select("tools_enabled")
    .eq("id", boardId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, response: jsonError("board_lookup_failed", "보드 정보를 확인하지 못했습니다.", 502) };
  }

  if (!hasToolEnabled(board?.tools_enabled ?? null, "questions")) {
    return { ok: false as const, response: goneResponse() };
  }

  return { ok: true as const };
}

function resolvePatch(input: { status?: QuestionStatus; pinned?: boolean }) {
  const patch: { status?: QuestionStatus; pinned?: boolean } = {};

  if (input.status && ALLOWED_STATUSES.includes(input.status)) {
    patch.status = input.status;
  }

  if (typeof input.pinned === "boolean") {
    patch.pinned = input.pinned;
  }

  if (patch.status === "pinned" && typeof patch.pinned !== "boolean") {
    patch.pinned = true;
  }

  if (patch.pinned === true && !patch.status) {
    patch.status = "pinned";
  }

  if (patch.status && ["archived", "deleted", "approved"].includes(patch.status)) {
    patch.pinned = false;
  }

  return patch;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId);
  if (!access.ok) return access.response;
  const tool = await ensureQuestionsEnabled(boardId);
  if (!tool.ok) return tool.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const limit = url.searchParams.get("limit");
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const parsedLimit = limit ? Number(limit) : undefined;

  if (status && !ALLOWED_STATUSES.includes(status as QuestionStatus)) {
    return jsonError("invalid_status", "상태 값이 올바르지 않습니다.");
  }

  try {
    const result = await listQuestionsForBoard(boardId, {
      status: status as QuestionStatus | undefined,
      limit: Number.isFinite(parsedLimit) ? Math.min(50, Math.max(1, parsedLimit ?? 0)) : undefined,
      cursor,
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "질문을 불러오지 못했습니다.";
    return jsonError("read_failed", message, 502);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId);
  if (!access.ok) return access.response;
  const tool = await ensureQuestionsEnabled(boardId);
  if (!tool.ok) return tool.response;

  const payload = (await request.json().catch(() => null)) as
    | {
        id?: string;
        status?: QuestionStatus;
        pinned?: boolean;
        action?: string;
        questionId?: string;
        target?: "board" | "wall";
      }
    | null;

  if (payload?.action === "to_card") {
    if (!payload.questionId || !UUID_REGEX.test(payload.questionId)) {
      return jsonError("invalid_id", "질문 ID가 올바르지 않습니다.");
    }

    try {
      const result = await convertQuestionToCard(boardId, payload.questionId, {
        target: payload.target ?? "board",
      });
      return NextResponse.json({ ok: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "카드로 저장하지 못했습니다.";
      return jsonError("convert_failed", message, 502);
    }
  }

  if (!payload?.id || !UUID_REGEX.test(payload.id)) {
    return jsonError("invalid_id", "질문 ID가 올바르지 않습니다.");
  }

  const patch = resolvePatch({ status: payload.status, pinned: payload.pinned });

  if (!patch.status && typeof patch.pinned !== "boolean") {
    return jsonError("invalid_payload", "업데이트할 값이 없습니다.");
  }

  let currentPinnedId: string | null = null;
  const shouldUpdatePinned = typeof patch.pinned === "boolean";

  if (shouldUpdatePinned && patch.pinned === false) {
    const currentPinned = await getPinnedForBoard(boardId);
    currentPinnedId = currentPinned?.id ?? null;
  }

  try {
    const updated = await updateQuestion(boardId, payload.id, patch);

    if (shouldUpdatePinned) {
      const pinnedQuestionId = patch.pinned ? updated.id : currentPinnedId === updated.id ? null : undefined;

      if (pinnedQuestionId !== undefined) {
        await upsertBoardLiveSession(boardId, {
          pinnedQuestionId,
          pinnedQuestionUpdatedAt: Date.now(),
          ts: Date.now(),
        });
      }
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "질문을 업데이트하지 못했습니다.";
    return jsonError("update_failed", message, 502);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId);
  if (!access.ok) return access.response;
  const tool = await ensureQuestionsEnabled(boardId);
  if (!tool.ok) return tool.response;

  const payload = (await request.json().catch(() => null)) as { id?: string } | null;

  if (!payload?.id || !UUID_REGEX.test(payload.id)) {
    return jsonError("invalid_id", "질문 ID가 올바르지 않습니다.");
  }

  try {
    const currentPinned = await getPinnedForBoard(boardId);
    const updated = await updateQuestion(boardId, payload.id, { status: "deleted", pinned: false });

    if (currentPinned?.id === updated.id) {
      await upsertBoardLiveSession(boardId, {
        pinnedQuestionId: null,
        pinnedQuestionUpdatedAt: Date.now(),
        ts: Date.now(),
      });
    }
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "질문을 삭제하지 못했습니다.";
    return jsonError("delete_failed", message, 502);
  }
}
