import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { broadcastRealtimeEvent } from "@/lib/realtime/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";
import { buildSoftDeletePayload, SOFT_DELETE_DB_COLUMNS } from "@/lib/db/softDelete";
import {
  buildDashboardCardColorPayload,
  buildDashboardCardHidePayload,
  buildDashboardCardMovePayload,
  buildDashboardCardPinPayload,
  DASHBOARD_CARD_BATCH_DB_COLUMNS,
  dashboardCardBatchSelect,
} from "@/lib/db/dashboardCardBatchPayloads";

type CardUpdatePayload = Database["public"]["Tables"]["cards"]["Update"];

export async function POST(request: Request) {
  const { user } = await requireUser("/dashboard");
  const body = (await request.json()) as {
    boardId?: string;
    cardIds?: string[];
    action?: "move" | "color" | "pin" | "hide" | "delete";
    payload?: Record<string, unknown>;
  };

  if (!body.boardId || !Array.isArray(body.cardIds) || body.cardIds.length === 0 || !body.action) {
    return NextResponse.json({ ok: false, error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const boardId = body.boardId.trim();
  const cardIds = Array.from(new Set(body.cardIds));
  const supabase = createSupabaseAdminClient();

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, owner_id, share_code, share_enabled")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) {
    return NextResponse.json({ ok: false, error: boardError.message }, { status: 400 });
  }

  if (!board || board.owner_id !== user.id) {
    return NextResponse.json({ ok: false, error: "보드를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: walls, error: wallError } = await supabase
    .from("walls")
    .select("id")
    .eq("board_id", boardId);

  if (wallError) {
    return NextResponse.json({ ok: false, error: wallError.message }, { status: 400 });
  }

  const wallRows = (walls ?? []) as Array<{ id: string }>;
  const wallIds = new Set(wallRows.map((wall) => wall.id));
  if (wallIds.size === 0) {
    return NextResponse.json({ ok: false, error: "담벼락이 없습니다." }, { status: 400 });
  }

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select(dashboardCardBatchSelect)
    .in("id", cardIds)
    .in(DASHBOARD_CARD_BATCH_DB_COLUMNS.wallId, Array.from(wallIds));

  if (cardsError) {
    return NextResponse.json({ ok: false, error: cardsError.message }, { status: 400 });
  }

  const cardRows = (cards ?? []) as unknown as Array<{ id: string; wallId: string }>;
  const validIds = cardRows.map((card) => card.id);
  const now = new Date().toISOString();

  if (validIds.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  if (body.action === "delete") {
    const { error } = await supabase
      .from("cards")
      .update(buildSoftDeletePayload({ nowIso: now, deletedBy: user.id }) as CardUpdatePayload)
      .in("id", validIds)
      .is(SOFT_DELETE_DB_COLUMNS.deletedAt, null);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    if (board.share_enabled) {
      await broadcastRealtimeEvent({
        boardId,
        shareCode: board.share_code,
        event: { type: "card:updated", payload: { cardId: validIds[0], wallId: cardRows[0]?.wallId ?? "" } },
      });
    }
    return NextResponse.json({ ok: true, updated: validIds.length });
  }

  if (body.action === "move") {
    const wallId = typeof body.payload?.wallId === "string" ? body.payload.wallId : null;
    if (!wallId || !wallIds.has(wallId)) {
      return NextResponse.json({ ok: false, error: "이동할 담벼락이 올바르지 않습니다." }, { status: 400 });
    }
    const { error } = await supabase
      .from("cards")
      .update(buildDashboardCardMovePayload({ wallId, nowIso: now }) as CardUpdatePayload)
      .in("id", validIds);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    await broadcastRealtimeEvent({
      boardId,
      shareCode: board.share_code,
      event: {
        type: "card:moved",
        payload: {
          cardId: validIds[0],
          fromWallId: cardRows[0]?.wallId ?? "",
          toWallId: wallId,
        },
      },
    });
    return NextResponse.json({ ok: true, updated: validIds.length });
  }

  if (body.action === "color") {
    const cardColorToken =
      typeof body.payload?.cardColorToken === "string" || body.payload?.cardColorToken === null
        ? body.payload.cardColorToken
        : null;
    const { error } = await supabase
      .from("cards")
      .update(buildDashboardCardColorPayload({ cardColorToken: cardColorToken ?? null, nowIso: now }) as CardUpdatePayload)
      .in("id", validIds);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    await broadcastRealtimeEvent({
      boardId,
      shareCode: board.share_code,
      event: {
        type: "card:updated",
        payload: { cardId: validIds[0], wallId: cardRows[0]?.wallId ?? "", cardColorToken: cardColorToken ?? null, updatedAt: now },
      },
    });
    return NextResponse.json({ ok: true, updated: validIds.length });
  }

  if (body.action === "pin") {
    const pinned = Boolean(body.payload?.pinned);
    const { error } = await supabase
      .from("cards")
      .update(buildDashboardCardPinPayload({ pinned, nowIso: now }) as CardUpdatePayload)
      .in("id", validIds);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    await broadcastRealtimeEvent({
      boardId,
      shareCode: board.share_code,
      event: { type: "card:updated", payload: { cardId: validIds[0], wallId: cardRows[0]?.wallId ?? "", isPinned: pinned, updatedAt: now } },
    });
    return NextResponse.json({ ok: true, updated: validIds.length });
  }

  if (body.action === "hide") {
    const hidden = Boolean(body.payload?.hidden);
    const { error } = await supabase
      .from("cards")
      .update(buildDashboardCardHidePayload({ hidden, nowIso: now }) as CardUpdatePayload)
      .in("id", validIds);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    await broadcastRealtimeEvent({
      boardId,
      shareCode: board.share_code,
      event: { type: "card:updated", payload: { cardId: validIds[0], wallId: cardRows[0]?.wallId ?? "", isHidden: hidden, updatedAt: now } },
    });
    return NextResponse.json({ ok: true, updated: validIds.length });
  }

  return NextResponse.json({ ok: false, error: "지원되지 않는 작업입니다." }, { status: 400 });
}
