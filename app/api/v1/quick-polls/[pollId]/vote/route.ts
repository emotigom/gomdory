import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  applyQuickPollVote,
  ensureAnonId,
  sanitizeQuickPoll,
  type QuickPollState,
} from "@/lib/data/engagement";
import { upsertBoardLiveSession } from "@/lib/data/liveSession";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pollId: string }> },
) {
  const { pollId } = await params;
  if (!UUID_REGEX.test(pollId)) {
    return jsonError("invalid_poll_id", "퀵 폴 ID가 올바르지 않습니다.");
  }

  const payload = (await request.json().catch(() => null)) as { optionIndex?: unknown } | null;
  const optionIndex = Number(payload?.optionIndex);
  if (!Number.isInteger(optionIndex)) {
    return jsonError("invalid_option", "선택지를 선택해주세요.");
  }

  const cookieStore = await cookies();
  const anonSeed = cookieStore.get("__gomdory_anon")?.value;
  const anonId = ensureAnonId(anonSeed);
  const now = Date.now();

  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
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

  const quickPoll = snapshot.quickPoll as QuickPollState | undefined | null;
  if (!quickPoll || quickPoll.id !== pollId) {
    return jsonError("not_found", "퀵 폴을 찾을 수 없어요.", 404);
  }

  try {
    const { poll, ignored } = applyQuickPollVote(quickPoll, optionIndex, anonId, now);

    const { snapshot: saved } = await upsertBoardLiveSession(
      boardId,
      { ...snapshot, quickPoll: poll, ts: now },
      { useServiceRole: true },
    );

    const response = NextResponse.json({
      ok: true,
      data: { quickPoll: sanitizeQuickPoll(saved.quickPoll ?? null), ignored },
    });

    if (anonId !== anonSeed) {
      response.cookies.set("__gomdory_anon", anonId, {
        httpOnly: false,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "투표에 실패했어요.";
    return jsonError("vote_failed", message, 400);
  }
}
