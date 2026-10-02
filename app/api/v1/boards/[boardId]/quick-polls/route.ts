import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { openQuickPoll, sanitizeQuickPoll } from "@/lib/data/engagement";
import { upsertBoardLiveSession } from "@/lib/data/liveSession";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
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

  const payload = (await request.json().catch(() => null)) as
    | { question?: unknown; options?: unknown; durationSec?: unknown }
    | null;

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("board_live_session")
    .select("snapshot")
    .eq("board_id", boardId)
    .maybeSingle();

  const snapshot = (row as { snapshot?: unknown } | null)?.snapshot ?? { boardId, ts: Date.now() };
  const now = Date.now();

  try {
    const quickPoll = openQuickPoll(
      snapshot,
      {
        question: payload?.question,
        options: payload?.options,
        durationSec: typeof payload?.durationSec === "number" ? payload.durationSec : 10,
      },
      now,
    );

    const { snapshot: saved } = await upsertBoardLiveSession(
      boardId,
      { ...snapshot, quickPoll, ts: now },
      { useServiceRole: true },
    );

    return NextResponse.json({ ok: true, data: { quickPoll: sanitizeQuickPoll(saved.quickPoll ?? null) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "퀵 폴을 시작하지 못했습니다.";
    return jsonError("quick_poll_failed", message, 400);
  }
}
