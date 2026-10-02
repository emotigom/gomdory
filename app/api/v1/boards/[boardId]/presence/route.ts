import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { enableSharing, isValidShareCode, normalizeShareCode } from "@/lib/data/share";
import { buildAnonymousName, getPresenceSummary, resetParticipants } from "@/lib/data/presence";
import { goneResponse } from "@/lib/http/gone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

const ACTIVE_WITHIN_SECONDS = 90;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function resolveShareCode(boardId: string, shareCodeParam: string | null) {
  if (shareCodeParam) {
    const normalized = normalizeShareCode(shareCodeParam);
    if (!isValidShareCode(normalized)) {
      throw new Error("invalid_share_code");
    }
    return normalized;
  }

  const supabase = createSupabaseServerClient();
  const { data: board, error } = await supabase
    .from("boards")
    .select("id, share_code, share_enabled")
    .eq("id", boardId)
    .single();

  if (error) {
    throw new Error("board_not_found");
  }

  if (board?.share_enabled && board.share_code) {
    return board.share_code;
  }

  const ensured = await enableSharing(boardId);
  return ensured.share_code ?? "";
}

async function requireBoardAccess(boardId: string) {
  try {
    await requireUserApi();
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403);
  }

  return null;
}

async function ensurePresenceEnabled(boardId: string) {
  const supabase = createSupabaseServerClient();
  const { data: board, error } = await supabase
    .from("boards")
    .select("tools_enabled")
    .eq("id", boardId)
    .maybeSingle();

  if (error) {
    return jsonError("board_lookup_failed", "보드 정보를 확인하지 못했습니다.", 502);
  }

  if (!hasToolEnabled(board?.tools_enabled ?? null, "presence")) {
    return goneResponse();
  }

  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const authError = await requireBoardAccess(boardId);
  if (authError) return authError;
  const toolError = await ensurePresenceEnabled(boardId);
  if (toolError) return toolError;

  const url = new URL(request.url);
  const activeWithinSecondsParam = Number(url.searchParams.get("activeWithinSeconds"));
  const activeWithinSeconds = Number.isFinite(activeWithinSecondsParam)
    ? Math.max(10, Math.min(activeWithinSecondsParam, 600))
    : ACTIVE_WITHIN_SECONDS;

  try {
    const shareCode = await resolveShareCode(boardId, url.searchParams.get("shareCode"));

    const summary = await getPresenceSummary({
      boardId,
      shareCode,
      activeWithinSeconds,
    });

    const activeList = summary.active.map((entry) => ({
      name: entry.displayName ?? buildAnonymousName(entry.fingerprint),
      lastSeenAt: entry.lastSeenAt,
    }));

    const activeTop = activeList.slice(0, 3).map((entry) => entry.name);

    return NextResponse.json({
      ok: true,
      activeCount: summary.activeCount,
      activeTop,
      activeList,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "출석 정보를 불러오지 못했습니다.";
    if (message === "invalid_share_code") {
      return jsonError("invalid_share_code", "공유 코드가 올바르지 않습니다.");
    }
    if (message === "board_not_found") {
      return jsonError("board_not_found", "보드를 찾을 수 없습니다.", 404);
    }
    return jsonError("presence_failed", message, 502);
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

  const authError = await requireBoardAccess(boardId);
  if (authError) return authError;
  const toolError = await ensurePresenceEnabled(boardId);
  if (toolError) return toolError;

  const url = new URL(request.url);

  try {
    const shareCode = await resolveShareCode(boardId, url.searchParams.get("shareCode"));
    await resetParticipants({ boardId, shareCode });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "출석 정보를 초기화하지 못했습니다.";
    if (message === "invalid_share_code") {
      return jsonError("invalid_share_code", "공유 코드가 올바르지 않습니다.");
    }
    if (message === "board_not_found") {
      return jsonError("board_not_found", "보드를 찾을 수 없습니다.", 404);
    }
    return jsonError("presence_failed", message, 502);
  }
}
