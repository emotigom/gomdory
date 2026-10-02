import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WallSectionV2 = {
  id: string;
  board_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export async function listWallSectionsV2(boardId: string): Promise<WallSectionV2[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("wall_sections_v2")
    .select("id, board_id, title, position, created_at, updated_at")
    .eq("board_id", boardId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createWallSectionV2(input: {
  boardId: string;
  title: string;
}): Promise<WallSectionV2> {
  const supabase = createSupabaseServerClient();
  const { data: maxPositionRow, error: maxPositionError } = await supabase
    .from("wall_sections_v2")
    .select("position")
    .eq("board_id", input.boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxPositionError) {
    throw new Error(maxPositionError.message);
  }

  const nextPosition = (maxPositionRow?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("wall_sections_v2")
    .insert({
      board_id: input.boardId,
      title: input.title,
      position: nextPosition,
    })
    .select("id, board_id, title, position, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("섹션을 생성하지 못했습니다.");
  }

  return data as WallSectionV2;
}
