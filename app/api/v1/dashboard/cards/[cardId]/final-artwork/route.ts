import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
import { logAudit } from "@/lib/data/audit";
import { FINAL_ARTWORK_TAG_COLOR, FINAL_ARTWORK_TAG_NAME } from "@/lib/board/finalArtwork";
import { toSnakeKeys } from "@/lib/standards/fields";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isQ2B7FixtureAuthorized, q2B7CanOperate, q2B7SetFinalArtwork } from "@/lib/q2/browser/teacherOperationFixture";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  if (isQ2B7FixtureAuthorized(request.headers.get("x-q2-browser-fixture-authorized"))) { const body = await request.json().catch(() => null) as { final?: boolean } | null; if (!q2B7CanOperate(request.headers)) return NextResponse.json({ error: "forbidden" }, { status: 403 }); if (typeof body?.final !== "boolean") return NextResponse.json({ error: "invalid" }, { status: 400 }); const result = q2B7SetFinalArtwork(cardId, body.final); return result ? NextResponse.json({ ok: true, final: body.final, card: { id: result.card.id, wallId: result.card.wall_id, position: result.card.position, isFinalArtwork: result.card.tags.some((tag) => tag.name === "최종 작품") }, fixtureDataVersion: result.stateVersion }) : NextResponse.json({ error: "not_found" }, { status: 404 }); }
  let userId: string;
  try {
    const { user } = await requireUser("/dashboard");
    userId = user.id;
  } catch {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { final?: unknown } | null;
  if (typeof body?.final !== "boolean") {
    return NextResponse.json({ error: "최종 작품 상태가 올바르지 않습니다." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, author_type, deleted_at, walls!inner(board_id)")
    .eq("id", cardId)
    .maybeSingle();
  if (cardError || !card) {
    return NextResponse.json({ error: "카드를 찾을 수 없습니다." }, { status: 404 });
  }
  if (card.deleted_at || card.author_type !== "student") {
    return NextResponse.json({ error: "학생이 작성한 카드만 최종 작품으로 표시할 수 있습니다." }, { status: 400 });
  }

  const boardId = (card as { walls?: { board_id?: string | null } | null }).walls?.board_id;
  if (!boardId) {
    return NextResponse.json({ error: "보드를 찾을 수 없습니다." }, { status: 404 });
  }
  const { data: roleResult, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const role = normalizeBoardRole(roleResult);
  if (roleError || (role !== "owner" && role !== "editor")) {
    return NextResponse.json({ error: "최종 작품 상태를 변경할 권한이 없습니다." }, { status: 403 });
  }

  let { data: tag, error: tagError } = await supabase
    .from("tags")
    .select("id")
    .eq("board_id", boardId)
    .ilike("name", FINAL_ARTWORK_TAG_NAME)
    .maybeSingle();
  if (!tag && !tagError && body.final) {
    const created = await supabase
      .from("tags")
      .insert(toSnakeKeys({ boardId, name: FINAL_ARTWORK_TAG_NAME, color: FINAL_ARTWORK_TAG_COLOR, createdBy: userId }))
      .select("id")
      .single();
    tag = created.data;
    tagError = created.error;
  }
  if (tagError || (!tag && body.final)) {
    return NextResponse.json({ error: "최종 작품 상태를 저장하지 못했습니다." }, { status: 400 });
  }

  if (tag) {
    const mutation = body.final
      ? supabase.from("card_tags").upsert(toSnakeKeys({ cardId, tagId: tag.id, createdBy: userId }))
      : supabase.from("card_tags").delete().eq("card_id", cardId).eq("tag_id", tag.id);
    const { error } = await mutation;
    if (error) {
      return NextResponse.json({ error: "최종 작품 상태를 저장하지 못했습니다." }, { status: 400 });
    }
  }

  // 학생별 최종 작품 1개 제한은 후속 기능에서 다룹니다.
  await logAudit({
    boardId,
    action: body.final ? "card.final_artwork.set" : "card.final_artwork.unset",
    targetType: "card",
    targetId: cardId,
    meta: { final: body.final },
  });
  return NextResponse.json({ ok: true, final: body.final });
}
