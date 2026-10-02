import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;

  let userId: string;
  try {
    const { user } = await requireUser("/dashboard");
    userId = user.id;
  } catch {
    return jsonError("unauthorized", "인증이 필요합니다.", 401);
  }

  const body = (await request.json()) as { tagIds?: string[] };
  const tagIds = normalizeIds(body.tagIds ?? []);

  const supabase = createSupabaseServerClient();
  const { data: cardRow, error: cardError } = await supabase
    .from("cards")
    .select("id, wall_id, deleted_at, walls!inner(board_id)")
    .eq("id", cardId)
    .maybeSingle();

  if (cardError) {
    return jsonError("card_fetch_failed", "카드를 불러오지 못했습니다.", 400);
  }

  if (!cardRow) {
    return jsonError("not_found", "카드를 찾을 수 없습니다.", 404);
  }

  if (cardRow.deleted_at) {
    return jsonError("deleted", "삭제된 카드에는 태그를 수정할 수 없습니다.", 400);
  }

  const boardId = (cardRow as { walls?: { board_id?: string } }).walls?.board_id;
  if (!boardId) {
    return jsonError("board_not_found", "보드를 찾을 수 없습니다.", 404);
  }

  const { data: roleResult, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  if (roleError) {
    return jsonError("role_error", "권한을 확인하지 못했습니다.", 400);
  }
  const role = normalizeBoardRole(roleResult);
  if (role !== "owner" && role !== "editor") {
    return jsonError("forbidden", "태그를 수정할 권한이 없습니다.", 403);
  }

  if (tagIds.length === 0) {
    // allow clearing tags
  }

  const { data: availableTags, error: tagsError } = await supabase
    .from("tags")
    .select("id")
    .eq("board_id", boardId)
    .in("id", tagIds.length > 0 ? tagIds : [null]);

  if (tagsError) {
    return jsonError("tag_fetch_failed", "태그를 불러오지 못했습니다.", 400);
  }

  const validTagIds = new Set((availableTags ?? []).map((tag) => tag.id));
  const filteredTagIds = tagIds.filter((id) => validTagIds.has(id));

  if (filteredTagIds.length !== tagIds.length) {
    return jsonError("invalid_tag", "해당 보드의 태그만 지정할 수 있습니다.", 400);
  }

  const { data: currentRows, error: currentError } = await supabase
    .from("card_tags")
    .select("tag_id")
    .eq("card_id", cardId);

  if (currentError) {
    return jsonError("fetch_failed", "현재 태그를 불러오지 못했습니다.", 400);
  }

  const existingIds = new Set((currentRows ?? []).map((row) => row.tag_id));
  const nextIds = new Set(filteredTagIds);

  const addIds = Array.from(nextIds).filter((id) => !existingIds.has(id));
  const removeIds = Array.from(existingIds).filter((id) => !nextIds.has(id));

  if (removeIds.length > 0) {
    const { error } = await supabase
      .from("card_tags")
      .delete()
      .eq("card_id", cardId)
      .in("tag_id", removeIds);

    if (error) {
      return jsonError("update_failed", "태그를 삭제하지 못했습니다.", 400);
    }
  }

  if (addIds.length > 0) {
    const insertRows = addIds.map((id) => ({ card_id: cardId, tag_id: id, created_by: userId }));
    const { error } = await supabase.from("card_tags").insert(insertRows);
    if (error) {
      return jsonError("update_failed", "태그를 추가하지 못했습니다.", 400);
    }
  }

  await logAudit({
    boardId,
    action: "card.tags.update",
    targetType: "card",
    targetId: cardId,
    meta: { addCount: addIds.length, removeCount: removeIds.length },
  });

  return NextResponse.json({ ok: true, addCount: addIds.length, removeCount: removeIds.length });
}
