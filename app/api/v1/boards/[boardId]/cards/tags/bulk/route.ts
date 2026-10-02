import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ApiError = { ok: false; code: string; message: string };

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json<ApiError>({ ok: false, code, message }, { status });
}

function normalizeIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((value) => typeof value === "string").map((id) => id.trim()))).filter(
    Boolean,
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const { boardId } = await params;

  let userId: string;
  let role: string | null = null;
  try {
    const { user } = await requireUserApi();
    userId = user.id;
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("board_role", { bid: boardId });
    if (error) {
      return jsonError("role_error", "권한을 확인하지 못했습니다.", 400);
    }
    role = normalizeBoardRole(data);
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  if (role !== "owner" && role !== "editor") {
    return jsonError("forbidden", "태그를 수정할 권한이 없습니다.", 403);
  }

  const body = (await request.json()) as {
    cardIds?: string[];
    addTagIds?: string[];
    removeTagIds?: string[];
  };
  const cardIds = normalizeIds(body.cardIds ?? []);
  const addTagIds = normalizeIds(body.addTagIds ?? []);
  const removeTagIds = normalizeIds(body.removeTagIds ?? []);

  if (cardIds.length === 0) {
    return jsonError("invalid_cards", "카드를 선택해주세요.");
  }

  if (addTagIds.length === 0 && removeTagIds.length === 0) {
    return jsonError("invalid_tags", "추가하거나 제거할 태그를 선택해주세요.");
  }

  const supabase = createSupabaseServerClient();
  const { data: availableTags, error: tagsError } = await supabase
    .from("tags")
    .select("id")
    .eq("board_id", boardId)
    .in("id", [...addTagIds, ...removeTagIds]);

  if (tagsError) {
    return jsonError("tag_fetch_failed", "태그를 불러오지 못했습니다.", 400);
  }

  const validTagSet = new Set((availableTags ?? []).map((tag) => tag.id));
  if (addTagIds.some((id) => !validTagSet.has(id)) || removeTagIds.some((id) => !validTagSet.has(id))) {
    return jsonError("invalid_tag", "해당 보드의 태그만 사용할 수 있습니다.", 400);
  }

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, wall_id, deleted_at, walls!inner(board_id)")
    .in("id", cardIds)
    .eq("walls.board_id", boardId)
    .is("deleted_at", null);

  if (cardsError) {
    return jsonError("card_fetch_failed", "카드를 불러오지 못했습니다.", 400);
  }

  const validCardIds = (cards ?? []).map((card) => card.id);
  if (validCardIds.length === 0) {
    return jsonError("invalid_cards", "카드를 찾을 수 없습니다.", 404);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("card_tags")
    .select("card_id, tag_id")
    .in("card_id", validCardIds);

  if (existingError) {
    return jsonError("fetch_failed", "현재 태그를 불러오지 못했습니다.", 400);
  }

  const existingSet = new Set((existingRows ?? []).map((row) => `${row.card_id}:${row.tag_id}`));
  const removeSet = new Set(removeTagIds);

  const addRows: Array<{ card_id: string; tag_id: string; created_by: string }> = [];
  for (const cardId of validCardIds) {
    for (const tagId of addTagIds) {
      const key = `${cardId}:${tagId}`;
      if (existingSet.has(key)) continue;
      addRows.push({ card_id: cardId, tag_id: tagId, created_by: userId });
    }
  }

  if (removeTagIds.length > 0) {
    const { error } = await supabase
      .from("card_tags")
      .delete()
      .in("card_id", validCardIds)
      .in("tag_id", Array.from(removeSet));

    if (error) {
      return jsonError("update_failed", "태그를 제거하지 못했습니다.", 400);
    }
  }

  if (addRows.length > 0) {
    const { error } = await supabase.from("card_tags").insert(addRows);
    if (error) {
      return jsonError("update_failed", "태그를 추가하지 못했습니다.", 400);
    }
  }

  await logAudit({
    boardId,
    action: "card.tags.bulk_update",
    targetType: "card",
    targetId: null,
    meta: { cardCount: validCardIds.length, addCount: addRows.length, removeCount: removeTagIds.length },
  });

  return NextResponse.json({
    ok: true,
    cardCount: validCardIds.length,
    addCount: addRows.length,
    removeCount: removeTagIds.length,
  });
}
