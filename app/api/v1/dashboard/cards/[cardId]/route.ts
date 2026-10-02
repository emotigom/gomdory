import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/requireUser";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { deleteCard } from "@/lib/data/cards";
import { logAudit } from "@/lib/data/audit";
import { canSoftDelete, getBoardPolicy } from "@/lib/data/boardPolicies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  await requireUser(`/dashboard`);

  const supabase = createSupabaseServerClient();
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, wall_id, deleted_at")
    .eq("id", cardId)
    .maybeSingle();

  if (cardError) {
    return NextResponse.json({ ok: false, error: cardError.message }, { status: 400 });
  }

  if (!card) {
    return NextResponse.json(
      { ok: false, error: "카드를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (card.deleted_at) {
    return NextResponse.json(
      { ok: false, error: "이미 휴지통으로 이동된 카드입니다." },
      { status: 400 },
    );
  }

  const { data: wall, error: wallError } = await supabase
    .from("walls")
    .select("board_id")
    .eq("id", card.wall_id)
    .maybeSingle();

  if (wallError) {
    return NextResponse.json({ ok: false, error: wallError.message }, { status: 400 });
  }

  if (!wall) {
    return NextResponse.json({ ok: false, error: "담벼락 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: wall.board_id });
  const boardRole = normalizeBoardRole(role);

  if (roleError) {
    return NextResponse.json({ ok: false, error: "보드 권한을 확인하지 못했습니다." }, { status: 400 });
  }

  if (boardRole !== "owner" && boardRole !== "editor") {
    return NextResponse.json(
      { ok: false, error: "카드를 삭제할 권한이 없습니다." },
      { status: 403 },
    );
  }

  const policy = await getBoardPolicy(wall?.board_id ?? "", supabase);

  if (!canSoftDelete(boardRole, policy)) {
    await logAudit({
      boardId: wall?.board_id ?? "",
      action: "policy.block",
      targetType: "card",
      targetId: cardId,
      meta: { attemptedAction: "card.soft_delete" },
    });

    return NextResponse.json(
      { ok: false, error: "보드 정책으로 카드 삭제가 차단되었습니다." },
      { status: 403 },
    );
  }

  try {
    await deleteCard(cardId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "삭제 실패";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  if (wall?.board_id) {
    await logAudit({
      boardId: wall.board_id,
      action: "card.soft_delete",
      targetType: "card",
      targetId: cardId,
      meta: { cardId, wallId: card.wall_id },
    });
  }

  return NextResponse.json({ ok: true });
}
