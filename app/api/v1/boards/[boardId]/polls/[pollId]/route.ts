import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { closePoll, openPoll, PollError } from "@/lib/data/polls";
import { goneResponse } from "@/lib/http/gone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string; pollId: string }> },
) {
  const { boardId, pollId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  if (!UUID_REGEX.test(pollId)) {
    return jsonError("invalid_poll_id", "투표 ID 형식이 올바르지 않습니다.");
  }

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

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("tools_enabled")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) {
    return jsonError("board_lookup_failed", "보드 정보를 확인하지 못했습니다.", 502);
  }

  if (!hasToolEnabled(board?.tools_enabled ?? null, "polls")) {
    return goneResponse();
  }

  const payload = (await request.json().catch(() => null)) as { action?: string; endsAt?: number | null } | null;
  const action = payload?.action;

  try {
    if (action === "open") {
      await openPoll(pollId, payload?.endsAt ?? null, boardId);
      return NextResponse.json({ ok: true });
    }
    if (action === "close") {
      await closePoll(pollId, boardId);
      return NextResponse.json({ ok: true });
    }
    return jsonError("invalid_action", "유효한 동작이 필요합니다.", 400);
  } catch (error) {
    if (error instanceof PollError) {
      return jsonError(error.code, error.message, error.status);
    }
    const message = error instanceof Error ? error.message : "투표를 업데이트하지 못했습니다.";
    return jsonError("poll_failed", message, 400);
  }
}
