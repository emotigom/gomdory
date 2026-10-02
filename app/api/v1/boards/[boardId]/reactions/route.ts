import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { applyReaction, ensureAnonId } from "@/lib/data/engagement";
import { upsertBoardLiveSession } from "@/lib/data/liveSession";
import { goneResponse } from "@/lib/http/gone";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMOJI_ALLOWLIST = new Set(["👍", "😀", "😮", "🙋", "⭐", "👏", "❤️", "🔥"]);

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

  const payload = (await request.json().catch(() => null)) as { emoji?: unknown } | null;
  const emoji = typeof payload?.emoji === "string" ? payload.emoji : null;

  if (!emoji || !EMOJI_ALLOWLIST.has(emoji)) {
    return jsonError("invalid_emoji", "지원하지 않는 반응입니다.");
  }

  const cookieStore = await cookies();
  const anonSeed = cookieStore.get("__gomdory_anon")?.value;
  const anonId = ensureAnonId(anonSeed);
  const now = Date.now();

  try {
    const supabase = createSupabaseAdminClient();
    const { data: boardData, error: boardError } = await supabase
      .from("boards")
      .select("tools_enabled")
      .eq("id", boardId)
      .maybeSingle();
    const board = boardData as { tools_enabled?: unknown } | null;

    if (boardError) {
      return jsonError("board_lookup_failed", "보드 정보를 확인하지 못했습니다.", 502);
    }

    if (!hasToolEnabled(board?.tools_enabled ?? null, "reactions")) {
      return goneResponse();
    }

    const { data: row } = await supabase
      .from("board_live_session")
      .select("snapshot")
      .eq("board_id", boardId)
      .maybeSingle();

    const existing = (row as { snapshot?: unknown } | null)?.snapshot ?? { boardId, ts: now };
    const { next, rateLimited } = applyReaction(existing, emoji, anonId, now);

    if (rateLimited) {
      return jsonError("rate_limited", "조금만 천천히 눌러주세요.", 429);
    }

    const { snapshot } = await upsertBoardLiveSession(
      boardId,
      { ...next, ts: now },
      { useServiceRole: true },
    );

    const response = NextResponse.json({ ok: true, data: { reactions: snapshot.reactions } });
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
    const message = error instanceof Error ? error.message : "반응을 남기지 못했어요.";
    return jsonError("reaction_failed", message, 500);
  }
}
