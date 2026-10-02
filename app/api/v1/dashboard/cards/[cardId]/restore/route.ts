import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { logAudit } from "@/lib/data/audit";
import { restoreCard } from "@/lib/data/cards";
import { canManageTrash, getBoardPolicy } from "@/lib/data/boardPolicies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  await requireUser("/dashboard");

  const supabase = createSupabaseServerClient();
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, wall_id, deleted_at")
    .eq("id", cardId)
    .maybeSingle();

  if (cardError) {
    return jsonError(cardError.message, 400);
  }

  if (!card) {
    return jsonError("카드를 찾을 수 없습니다.", 404);
  }

  if (!card.deleted_at) {
    return jsonError("이미 복구된 카드입니다.", 400);
  }

  const { data: wall, error: wallError } = await supabase
    .from("walls")
    .select("board_id")
    .eq("id", card.wall_id)
    .maybeSingle();

  if (wallError) {
    return jsonError(wallError.message, 400);
  }

  if (!wall) {
    return jsonError("담벼락 정보를 찾을 수 없습니다.", 404);
  }

  const { data: role, error: roleError } = await supabase.rpc("board_role", {
    bid: wall.board_id,
  });
  const boardRole = normalizeBoardRole(role);

  if (roleError) {
    return jsonError("권한을 확인하지 못했습니다.", 400);
  }

  if (boardRole !== "owner" && boardRole !== "editor") {
    return jsonError("복구할 권한이 없습니다.", 403);
  }

  const policy = await getBoardPolicy(wall.board_id, supabase);

  if (!canManageTrash(boardRole, policy)) {
    await logAudit({
      boardId: wall.board_id,
      action: "policy.block",
      targetType: "trash",
      targetId: cardId,
      meta: { attemptedAction: "card.restore" },
    });

    return jsonError("보드 정책으로 복구가 차단되었습니다.", 403);
  }

  try {
    await restoreCard(cardId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "복구에 실패했습니다.";
    return jsonError(message, 400);
  }

  await logAudit({
    boardId: wall.board_id,
    action: "card.restore",
    targetType: "card",
    targetId: cardId,
    meta: { cardId, wallId: card.wall_id },
  });

  return NextResponse.json({ ok: true });
}
