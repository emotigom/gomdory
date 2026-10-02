import { NextResponse } from "next/server";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { withOps } from "@/lib/ops/withOps";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ApprovalPayload = {
  cardIds?: string[];
};

function respondError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function ensureBoardAccess(boardId: string) {
  let userId: string | null = null;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
  } catch {
    return {
      ok: false as const,
      response: respondError("unauthorized", "인증이 필요합니다.", 401),
      userId,
    };
  }

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !canEditBoard(boardRole)) {
    return {
      ok: false as const,
      response: respondError("forbidden", "보드 접근 권한이 없습니다.", 403),
      userId,
    };
  }

  return { ok: true as const, userId };
}

async function handlePost(
  request: Request,
  { params }: { params: Promise<{ boardId: string; requestId: string }> },
  ops: { requestId: string },
) {
  const { boardId, requestId } = await params;
  if (!UUID_REGEX.test(boardId) || !UUID_REGEX.test(requestId)) {
    return respondError("invalid_request", "요청 값이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId);
  if (!access.ok) return access.response;

  let payload: ApprovalPayload = {};
  try {
    payload = (await request.json()) as ApprovalPayload;
  } catch {
    payload = {};
  }

  const cardIds = Array.isArray(payload.cardIds)
    ? payload.cardIds.filter((id) => typeof id === "string" && UUID_REGEX.test(id))
    : [];

  const admin = createSupabaseAdminClient();
  const { data: ownershipRequest, error: requestError } = await admin
    .from("ownership_requests")
    .select("id, student_name, new_client_id, status")
    .eq("id", requestId)
    .eq("board_id", boardId)
    .maybeSingle();

  if (requestError || !ownershipRequest) {
    return respondError("not_found", "요청을 찾을 수 없습니다.", 404);
  }

  if (ownershipRequest.status !== "pending") {
    return respondError("already_processed", "이미 처리된 요청입니다.", 409);
  }

  let cardsQuery = admin
    .from("cards")
    .select("id, walls!inner(board_id)")
    .eq("walls.board_id", boardId);

  if (cardIds.length > 0) {
    cardsQuery = cardsQuery.in("id", cardIds);
  } else {
    cardsQuery = cardsQuery
      .eq("author_type", "student")
      .eq("author_name", ownershipRequest.student_name)
      .or(`author_client_id.is.null,author_client_id.neq.${ownershipRequest.new_client_id}`);
  }

  const { data: cards, error: cardsError } = await cardsQuery;

  if (cardsError) {
    return respondError("cards_failed", "카드를 확인하지 못했습니다.", 500);
  }

  const cardRows = (cards ?? []) as Array<{ id: string }>;
  const cardIdsToUpdate = cardRows.map((card) => card.id);
  let updatedCardCount = 0;

  if (cardIdsToUpdate.length > 0) {
    const { data: updatedCards, error: updateError } = await admin
      .from("cards")
      .update({ author_client_id: ownershipRequest.new_client_id })
      .in("id", cardIdsToUpdate)
      .select("id");

    if (updateError) {
      return respondError("update_failed", "카드 소유권을 업데이트하지 못했습니다.", 500);
    }

    updatedCardCount = updatedCards?.length ?? 0;
  }

  const { error: approveError } = await admin
    .from("ownership_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by_user_id: access.userId,
      approved_card_count: updatedCardCount,
    })
    .eq("id", requestId);

  if (approveError) {
    return respondError("update_failed", "요청 상태를 업데이트하지 못했습니다.", 500);
  }

  void recordOpsEvent({
    level: "info",
    kind: "auth",
    request_id: ops.requestId,
    route: new URL(request.url).pathname,
    status: 200,
    meta: {
      action: "ownership_request_approved",
      boardId,
      requestId,
      studentName: ownershipRequest.student_name,
      newClientId: ownershipRequest.new_client_id,
      updatedCardCount,
      selectedCardCount: cardIds.length || null,
    },
  });

  return {
    updatedCardCount,
  };
}

export const POST = withOps(handlePost, { log: true, errorCode: "unknown" });
