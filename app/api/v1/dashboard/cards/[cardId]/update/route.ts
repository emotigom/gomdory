import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import {
  buildDashboardCardUpdatePayload,
  DASHBOARD_BOARD_SHARE_SELECT,
  DASHBOARD_CARD_UPDATE_SELECT,
  DASHBOARD_CARD_WALL_SELECT,
} from "@/lib/db/dashboardCardUpdatePayload";
import { broadcastRealtimeEvent } from "@/lib/realtime/server";
import { logAudit } from "@/lib/data/audit";
import { AUDIT_ACTIONS } from "@/lib/data/auditActions";
import { recordAuditEvent } from "@/lib/data/auditEvents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bumpBoardAndWallActivity, shouldBumpActivity } from "@/lib/db/activityBump";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  const { user } = await requireUser("/dashboard");

  const body = (await request.json()) as { text?: string };

  if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "텍스트가 필요합니다." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const text = body.text.trim();

  const { data, error } = await supabase
    .from("cards")
    .update(buildDashboardCardUpdatePayload({ text, nowIso: now }))
    .eq("id", cardId)
    .eq("owner_id", user.id)
    .select(DASHBOARD_CARD_UPDATE_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "카드를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: wall } = await supabase
    .from("walls")
    .select(DASHBOARD_CARD_WALL_SELECT)
    .eq("id", data.wallId)
    .maybeSingle();

  const boardId = wall?.boardId ?? data.wallId;

  if (wall?.boardId && shouldBumpActivity("cardUpdateText")) {
    try {
      await bumpBoardAndWallActivity({ boardId: wall.boardId, wallId: data.wallId, nowIso: now });
    } catch (bumpError) {
      console.debug("activity_bump_failed", bumpError);
    }
  }
  const { data: board } = await supabase
    .from("boards")
    .select(DASHBOARD_BOARD_SHARE_SELECT)
    .eq("id", boardId)
    .maybeSingle();

  void logAudit({
    boardId,
    action: AUDIT_ACTIONS.cardUpdated,
    targetType: "card",
    targetId: data.id,
    meta: {
      textLen: data.text.length,
      wallId: data.wallId,
    },
  });

  void recordAuditEvent({
    action: AUDIT_ACTIONS.cardUpdated,
    targetType: "card",
    targetId: data.id,
    meta: {
      boardId,
      cardId: data.id,
    },
  });

  await broadcastRealtimeEvent({
    boardId,
    shareCode: board?.shareEnabled ? board.shareCode : null,
    event: { type: "card:updated", payload: { cardId: data.id, wallId: data.wallId, updatedAt: now } },
  });

  return NextResponse.json({
    ok: true,
    card: {
      id: data.id,
      wallId: data.wallId,
      text: data.text,
      authorName: data.authorName,
      createdAt: data.createdAt,
      isHidden: data.isHidden,
      isPinned: data.isPinned,
      isFeatured: data.isFeatured,
      cardColorToken: data.cardColorToken,
    },
  });
}
