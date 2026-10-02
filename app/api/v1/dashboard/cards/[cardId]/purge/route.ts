import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { logAudit } from "@/lib/data/audit";
import { purgeCard } from "@/lib/data/cards";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function DELETE(
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
    return jsonError("휴지통에 있는 카드만 영구 삭제할 수 있습니다.", 400);
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

  if (boardRole !== "owner") {
    return jsonError("영구 삭제는 보드 소유자만 가능합니다.", 403);
  }

  try {
    await purgeCard(cardId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "영구 삭제에 실패했습니다.";
    return jsonError(message, 400);
  }

  await logAudit({
    boardId: wall.board_id,
    action: "card.purge",
    targetType: "card",
    targetId: cardId,
    meta: { cardId, wallId: card.wall_id },
  });

  return NextResponse.json({ ok: true });
}
