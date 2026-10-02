import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeBoardRole, type BoardRole } from "@/lib/auth/boardRoles";
import type { CardTag } from "./cards";

export type BoardTag = CardTag & { cardCount?: number };

export async function getBoardRole(boardId: string): Promise<BoardRole | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("board_role", { bid: boardId });

  if (error) {
    return null;
  }

  return normalizeBoardRole(data);
}

export async function listBoardTags(
  boardId: string,
  options?: { withCounts?: boolean },
): Promise<BoardTag[]> {
  const supabase = createSupabaseServerClient();
  const { data: tags, error } = await supabase
    .from("tags")
    .select("id, name, color, created_at")
    .eq("board_id", boardId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = tags ?? [];
  if (!options?.withCounts || rows.length === 0) {
    return rows as BoardTag[];
  }

  const tagIds = rows.map((tag) => tag.id);
  const { data: cardTagRows, error: countsError } = await supabase
    .from("card_tags")
    .select("tag_id, cards!inner(deleted_at)")
    .in("tag_id", tagIds)
    .is("cards.deleted_at", null);

  if (countsError) {
    throw new Error(countsError.message);
  }

  const counts = (cardTagRows ?? []).reduce<Record<string, number>>((acc, row) => {
    const tagId = (row as { tag_id: string | null }).tag_id;
    if (!tagId) return acc;
    acc[tagId] = (acc[tagId] ?? 0) + 1;
    return acc;
  }, {});

  return rows.map((tag) => ({
    ...(tag as CardTag),
    cardCount: counts[tag.id] ?? 0,
  }));
}
