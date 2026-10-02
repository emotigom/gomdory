import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { isSameCardMoveMutation } from "@/lib/board/cardMoveMutation";
import {
  buildNormalizedCardMove,
  compareCardPositionRows,
  type CardPositionMoveRow,
} from "@/lib/board/cardPositionMove";
import { isValidCardMoveBoundary } from "@/lib/board/cardMoveValidation";
import { recordAuditEvent } from "@/lib/data/auditEvents";
import { isMissingCardPositionColumnError } from "@/lib/data/cards";
import { getBoardByShareCode, normalizeShareCode } from "@/lib/data/share";
import { buildCardMoveMutationInsertPayload, cardMoveMutationSelect } from "@/lib/db/cardMoveMutationPayloads";
import { buildShareCardMovePayload } from "@/lib/db/shareCardPayloads";
import { shareWallSelect } from "@/lib/db/shareQueries";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";
import { getPublicShareWriteGuard, resolvePublicShareBoard } from "@/lib/share/public/access";

type MoveBody = {
  clientId?: string;
  wallId?: string;
  clientMutationId?: string;
  position?: number;
};

type MoveDeps = {
  getBoardByShareCodeFn?: typeof getBoardByShareCode;
  createSupabaseAdminClientFn?: typeof createSupabaseAdminClient;
};

type CardUpdatePayload = Database["public"]["Tables"]["cards"]["Update"];

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
      .update(toSnakeKeys({ wallId, position: index, updatedAt: nowIso }) as CardUpdatePayload)
      .eq("id", card.id)
      .is("deleted_at", null)
      .select("id");

    if (error) throw error;
    if (!data?.length) throw new Error("card_order_update_failed");
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string; cardId: string }> },
  deps?: MoveDeps,
) {
  const requestId = getOrCreateRequestId(request);
  try {
    const { code, cardId } = await params;
    const body = (await request.json().catch(() => null)) as MoveBody | null;
    const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
    const wallId = typeof body?.wallId === "string" ? body.wallId.trim() : "";
    const clientMutationId = typeof body?.clientMutationId === "string" ? body.clientMutationId.trim() : "";
    const position = typeof body?.position === "number" && Number.isFinite(body.position) ? body.position : null;

    if (!clientId || !wallId || !clientMutationId) {
      return jsonErrorWithRequestId("VALIDATION_ERROR", "clientId, wallId and clientMutationId are required", requestId, 400);
    }

    const board = deps?.getBoardByShareCodeFn
      ? await deps.getBoardByShareCodeFn(normalizeShareCode(code))
      : (await resolvePublicShareBoard(code)).board;
    if (!board) {
      return jsonErrorWithRequestId("BOARD_NOT_FOUND", "공유 보드를 찾을 수 없습니다.", requestId, 404);
    }

    const writeGuard = getPublicShareWriteGuard(board);
    if (!writeGuard.ok) {
      return jsonErrorWithRequestId(writeGuard.code, writeGuard.message, requestId, writeGuard.status);
    }

    const createAdminClient = deps?.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
    const supabase = createAdminClient();

    const { data: wall, error: wallError } = await supabase
      .from("walls")
      .select(shareWallSelect)
      .eq("id", wallId)
      .maybeSingle();

    if (wallError) {
      throw new Error(wallError.message);
    }

    const typedWall = wall as { id: string; boardId: string } | null;

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, authorClientId:author_client_id, authorType:author_type, wallId:wall_id, walls:wall_id(boardId:board_id)")
      .eq("id", cardId)
      .is("deleted_at", null)
      .maybeSingle();

    if (cardError) {
      throw new Error(cardError.message);
    }

    const typedCard = card as {
      id: string;
      authorClientId: string | null;
      authorType: string | null;
      wallId: string;
      walls: { boardId: string } | null;
    } | null;

    if (!isValidCardMoveBoundary({
      requestedBoardId: board.id,
      cardBoardId: typedCard?.walls?.boardId ?? null,
      targetWallBoardId: typedWall?.boardId ?? null,
    })) {
      if (!typedWall || typedWall.boardId !== board.id) {
        return jsonErrorWithRequestId("WALL_NOT_FOUND", "섹션을 찾을 수 없습니다.", requestId, 404);
      }
      return jsonErrorWithRequestId("CARD_NOT_FOUND", "카드를 찾을 수 없습니다.", requestId, 404);
    }

    if (!typedCard) {
      return jsonErrorWithRequestId("CARD_NOT_FOUND", "카드를 찾을 수 없습니다.", requestId, 404);
    }

    if (typedCard.authorType !== "student" || typedCard.authorClientId !== clientId) {
      return jsonErrorWithRequestId("FORBIDDEN", "허용되지 않은 요청입니다.", requestId, 403);
    }

    const moveMutationPayload = buildCardMoveMutationInsertPayload({
      scope: "share",
      actorId: clientId,
      boardId: board.id,
      cardId: typedCard.id,
      targetWallId: wallId,
      clientMutationId,
    });

    const { data: insertedMutation, error: insertMutationError } = await supabase
      .from("card_move_mutations" as never)
      .insert(moveMutationPayload as never)
      .select(cardMoveMutationSelect)
      .maybeSingle();

    if (insertMutationError && insertMutationError.code !== "23505") {
      throw new Error(insertMutationError.message);
    }

    if (!insertedMutation) {
      const { data: existingMutation, error: existingMutationError } = await supabase
        .from("card_move_mutations" as never)
        .select(cardMoveMutationSelect)
        .eq("scope", "share")
        .eq("actor_id", clientId)
        .eq("client_mutation_id", clientMutationId)
        .maybeSingle();

      if (existingMutationError) {
        throw new Error(existingMutationError.message);
      }

      if (
        existingMutation
        && isSameCardMoveMutation(existingMutation, {
          boardId: board.id,
          cardId: typedCard.id,
          targetWallId: wallId,
        })
      ) {
        void recordAuditEvent({
          action: "card_move_fail_open",
          targetType: "card",
          targetId: typedCard.id,
          actorAnonId: clientId,
          requestId,
          meta: {
            actor: clientId,
            surface: "share",
            fromWallId: typedCard.wallId,
            toWallId: wallId,
            position,
            duplicated: true,
          },
        });
        return jsonOkWithRequestId({ cardId: typedCard.id, wallId, duplicated: true }, requestId);
      }

      return jsonErrorWithRequestId("MUTATION_ID_CONFLICT", "동일 mutationId로 다른 이동 요청은 허용되지 않습니다.", requestId, 409);
    }

    try {
      await moveCardAndNormalizePositions({
        supabase,
        cardId: typedCard.id,
        fromWallId: typedCard.wallId,
        targetWallId: wallId,
        position,
      });
    } catch (error) {
      if (!isMissingCardPositionColumnError(error as { code?: string; message?: string })) {
        throw error;
      }
      const { error: updateError } = await supabase
        .from("cards")
        .update(buildShareCardMovePayload(wallId, new Date().toISOString()) as CardUpdatePayload)
        .eq("id", typedCard.id)
        .is("deleted_at", null);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    void recordAuditEvent({
      action: "card_move_fail_open",
      targetType: "card",
      targetId: typedCard.id,
      actorAnonId: clientId,
      requestId,
      meta: {
        actor: clientId,
        surface: "share",
        fromWallId: typedCard.wallId,
        toWallId: wallId,
        position,
        duplicated: false,
      },
    });

    return jsonOkWithRequestId({ cardId: typedCard.id, wallId }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "카드 이동에 실패했습니다.";
    return jsonErrorWithRequestId("MOVE_FAILED", message, requestId, 400);
  }
}
