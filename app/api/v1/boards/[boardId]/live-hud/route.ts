import { NextResponse } from "next/server";

import { sanitizeQuickPoll } from "@/lib/data/engagement";
import { getBoardLiveSession } from "@/lib/data/liveSession";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  try {
    const session = await getBoardLiveSession(boardId);
    if (!session) {
      return jsonError("not_found", "라이브 데이터를 찾을 수 없습니다.", 404);
    }

    const now = Date.now();
    const windowMs = (session.snapshot.reactions?.windowSeconds ?? 60) * 1000;
    const recent = (session.snapshot.reactions?.recent ?? []).filter((item) => now - item.at <= windowMs);
    const counts: Record<string, number> = {};
    for (const item of recent) {
      counts[item.emoji] = (counts[item.emoji] ?? 0) + 1;
    }

    const quickPoll = sanitizeQuickPoll(session.snapshot.quickPoll ?? null);

    return NextResponse.json({
      ok: true,
      data: {
        reactions: { counts, updatedAt: session.snapshot.reactions?.updatedAt ?? null },
        quickPoll,
        spotlight: session.snapshot.spotlight ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "라이브 HUD를 불러오지 못했습니다.";
    return jsonError("live_hud_failed", message, 502);
  }
}
