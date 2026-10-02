import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
import { isSameCardMoveMutation } from "@/lib/board/cardMoveMutation";
import {
  buildNormalizedCardMove,
  compareCardPositionRows,
  type CardPositionMoveRow,
} from "@/lib/board/cardPositionMove";
import { isValidCardMoveBoundary } from "@/lib/board/cardMoveValidation";
import { loadCardForUpload } from "@/lib/data/cards";
import { recordAuditEvent } from "@/lib/data/auditEvents";
import { buildCardMoveMutationInsertPayload, cardMoveMutationSelect } from "@/lib/db/cardMoveMutationPayloads";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isQ2B7FixtureAuthorized, q2B7CanOperate, q2B7MoveCard } from "@/lib/q2/browser/teacherOperationFixture";

type MoveBody = {
  wallId?: string;
  boardId?: string;
  clientMutationId?: string;
  position?: number;
};

function isMissingCardPositionColumnError(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    /cards\.position|position column|column .*position|could not find.*position/i.test(message)
  );
}

async function loadActiveCardsForWalls(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  wallIds: string[],
) {
  const { data, error } = await supabase
    .from("cards")
    .select("id, wall_id, position, created_at")
    .in("wall_id", Array.from(new Set(wallIds)))
    .is("deleted_at", null);

  if (error) throw error;
  return ((data ?? []) as CardPositionMoveRow[]).sort(compareCardPositionRows);
}

async function persistCardOrder(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  cards: CardPositionMoveRow[],
  wallId: string,
  nowIso: string,
) {
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const { data, error } = await supabase
      .from("cards")
      .update(toSnakeKeys({ wallId, position: index, updatedAt: nowIso }))
      .eq("id", card.id)
      .is("deleted_at", null)
      .select("id");

    if (error) throw error;
    if (!data?.length) throw new Error("카드 순서를 업데이트하지 못했습니다.");
  }
}

async function moveCardAndNormalizePositions(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  cardId: string;
  fromWallId: string;
  targetWallId: string;
  position: number | null;
}) {
  const nowIso = new Date().toISOString();
  const rows = await loadActiveCardsForWalls(input.supabase, [input.fromWallId, input.targetWallId]);
  const normalized = buildNormalizedCardMove({
    rows,
    cardId: input.cardId,
    fromWallId: input.fromWallId,
    targetWallId: input.targetWallId,
    position: input.position,
  });

  for (const wallOrder of normalized) {
    await persistCardOrder(input.supabase, wallOrder.cards, wallOrder.wallId, nowIso);
  }
}

async function moveCardWithoutPosition(input: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  cardId: string;
  targetWallId: string;
}) {
  const { error } = await input.supabase
    .from("cards")
    .update(toSnakeKeys({ wallId: input.targetWallId, updatedAt: new Date().toISOString() }))
    .eq("id", input.cardId)
    .is("deleted_at", null);

  if (error) throw error;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  const { cardId } = await params;
  if (isQ2B7FixtureAuthorized(request.headers.get("x-q2-browser-fixture-authorized"))) { const body = await request.json().catch(() => null) as MoveBody | null; if (!q2B7CanOperate(request.headers)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }); if (!body?.wallId || !body.clientMutationId) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 }); const result = q2B7MoveCard(cardId, body.wallId); return result ? NextResponse.json({ ok: true, card: { id: result.card.id, wallId: result.card.wall_id, position: result.card.position }, fixtureDataVersion: result.stateVersion }) : NextResponse.json({ ok: false, error: "not_found" }, { status: 404 }); }
  const { user } = await requireUser("/dashboard");

  const body = (await request.json()) as MoveBody;

  if (typeof body.wallId !== "string" || body.wallId.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "wallId 값이 필요합니다." }, { status: 400 });
  }

  const normalizedWallId = body.wallId.trim();
  const requestedBoardId = typeof body.boardId === "string" ? body.boardId.trim() : "";
  const clientMutationId = typeof body.clientMutationId === "string" ? body.clientMutationId.trim() : "";
  const position = typeof body.position === "number" && Number.isFinite(body.position) ? body.position : null;

  if (typeof body.clientMutationId !== "string" || body.clientMutationId.trim().length === 0) {
    return NextResponse.json({ ok: false, error: "clientMutationId 값이 필요합니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const cardLookup = await loadCardForUpload({ supabase, cardId });
  const normalizedBoardId = cardLookup?.boardId ?? requestedBoardId;
  const boardOwnerId = cardLookup?.boardOwnerId ?? null;
  const isOwner = boardOwnerId === user.id;
  let decision: "owner_fast_path" | "editable_role" | "forbidden" = "forbidden";
  let forbiddenReason: "card_not_found" | "board_role_denied" = "card_not_found";

  if (!cardLookup) {
    return NextResponse.json({ ok: false, error: "카드를 찾을 수 없습니다." }, { status: 404 });
  }

  if (isOwner) {
    decision = "owner_fast_path";
  } else {
    const { data: roleResult, error: roleError } = await supabase.rpc("board_role", { bid: cardLookup.boardId });
    if (roleError) {
      return NextResponse.json({ ok: false, error: roleError.message }, { status: 400 });
    }
    const role = normalizeBoardRole(roleResult);
    if (canEditBoard(role)) {
      decision = "editable_role";
    } else {
      forbiddenReason = "board_role_denied";
      console.info("[dashboard.cards.move] forbidden", {
        requestId,
        route: "dashboard-cards-move",
        cardId,
        wallIdPresent: true,
        boardIdPresent: Boolean(cardLookup.boardId),
        authUserIdPresent: Boolean(user.id),
        boardOwnerIdPresent: Boolean(boardOwnerId),
        boardOwnerIdEqualsAuthUserId: isOwner,
        decision,
        forbiddenReason,
      });
      return NextResponse.json({ ok: false, error: "카드를 이동할 권한이 없습니다." }, { status: 403 });
    }
  }

  const { data: targetWall, error: targetWallError } = await supabase
    .from("walls")
    .select("id, board_id")
    .eq("id", normalizedWallId)
    .maybeSingle();

  if (targetWallError) {
    return NextResponse.json({ ok: false, error: targetWallError.message }, { status: 400 });
  }

  const cardBoardId = cardLookup.boardId;
  const targetWallBoardId = (targetWall as { board_id?: string } | null)?.board_id ?? null;

  if (!isValidCardMoveBoundary({ requestedBoardId: normalizedBoardId, cardBoardId, targetWallBoardId })) {
    return NextResponse.json({ ok: false, error: "카드 또는 섹션 경계가 올바르지 않습니다." }, { status: 404 });
  }

  const fromWallId = cardLookup.wallId;

  const moveMutationPayload = buildCardMoveMutationInsertPayload({
    scope: "dashboard",
    actorId: user.id,
    boardId: normalizedBoardId,
    cardId,
    targetWallId: normalizedWallId,
    clientMutationId,
  });

  const { data: insertedMutation, error: insertMutationError } = await supabase
    .from("card_move_mutations" as never)
    .insert(moveMutationPayload as never)
    .select(cardMoveMutationSelect)
    .maybeSingle();

  if (insertMutationError && insertMutationError.code !== "23505") {
    return NextResponse.json({ ok: false, error: insertMutationError.message }, { status: 400 });
  }

  if (!insertedMutation) {
    const { data: existingMutation, error: existingMutationError } = await supabase
      .from("card_move_mutations" as never)
      .select(cardMoveMutationSelect)
      .eq("scope", "dashboard")
      .eq("actor_id", user.id)
      .eq("client_mutation_id", clientMutationId)
      .maybeSingle();

    if (existingMutationError) {
      return NextResponse.json({ ok: false, error: existingMutationError.message }, { status: 400 });
    }

    if (
      existingMutation
      && isSameCardMoveMutation(existingMutation, {
        boardId: normalizedBoardId,
        cardId,
        targetWallId: normalizedWallId,
      })
    ) {
      void recordAuditEvent({
        action: "card_move_fail_open",
        targetType: "card",
        targetId: cardId,
        actorUserId: user.id,
        requestId,
        meta: {
          actor: user.id,
          surface: "dashboard",
          fromWallId,
          toWallId: normalizedWallId,
          position,
          duplicated: true,
        },
      });
      return NextResponse.json({ ok: true, duplicated: true });
    }

    return NextResponse.json({ ok: false, error: "동일 mutationId로 다른 카드 이동 요청은 허용되지 않습니다." }, { status: 409 });
  }

  try {
    await moveCardAndNormalizePositions({
      supabase,
      cardId,
      fromWallId,
      targetWallId: normalizedWallId,
      position,
    });
  } catch (error) {
    if (isMissingCardPositionColumnError(error as { code?: string; message?: string })) {
      try {
        await moveCardWithoutPosition({
          supabase,
          cardId,
          targetWallId: normalizedWallId,
        });
      } catch (fallbackError) {
        const message = fallbackError instanceof Error ? fallbackError.message : "카드 이동 실패";
        return NextResponse.json({ ok: false, error: message }, { status: 400 });
      }
    } else {
      const message = error instanceof Error ? error.message : "카드 이동 실패";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  }

  revalidatePath(`/dashboard/boards/${normalizedBoardId}`);
  revalidatePath(`/dashboard/boards/${normalizedBoardId}/grid`);
  revalidatePath(`/dashboard/boards/${normalizedBoardId}/walls/${normalizedWallId}`);

  void recordAuditEvent({
    action: "card_move_fail_open",
    targetType: "card",
    targetId: cardId,
    actorUserId: user.id,
    requestId,
    meta: {
      actor: user.id,
      surface: "dashboard",
      fromWallId,
      toWallId: normalizedWallId,
      position,
      duplicated: false,
    },
  });

  return NextResponse.json({ ok: true });
}
