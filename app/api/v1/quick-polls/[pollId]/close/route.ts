import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { closeQuickPoll, sanitizeQuickPoll, type QuickPollState } from "@/lib/data/engagement";
import { upsertBoardLiveSession } from "@/lib/data/liveSession";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  const { pollId } = await params;
  if (!UUID_REGEX.test(pollId)) {
    return jsonError("invalid_poll_id", "퀵 폴 ID가 올바르지 않습니다.");
  }

  try {
    await requireUserApi();
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("board_live_session")
    .select("board_id, snapshot")
    .contains("snapshot", { quickPoll: { id: pollId } })
    .maybeSingle();

  const snapshot = (row as { snapshot?: unknown; board_id?: string } | null)?.snapshot as
    | { quickPoll?: unknown; boardId?: string; ts?: number }
    | undefined;
  const boardId = (row as { board_id?: string } | null)?.board_id ?? snapshot?.boardId;

  if (!snapshot || !boardId) {
    return jsonError("not_found", "퀵 폴을 찾을 수 없어요.", 404);
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403);
  }

  const quickPoll = snapshot.quickPoll as QuickPollState | undefined | null;
  if (!quickPoll || quickPoll.id !== pollId) {
    return jsonError("not_found", "퀵 폴을 찾을 수 없어요.", 404);
  }

  const now = Date.now();
  const closed = closeQuickPoll(quickPoll, now);

  const { snapshot: saved } = await upsertBoardLiveSession(
    boardId,
    { ...snapshot, quickPoll: closed, ts: now },
    { useServiceRole: true },
  );

  return NextResponse.json({ ok: true, data: { quickPoll: sanitizeQuickPoll(saved.quickPoll ?? null) } });
}
