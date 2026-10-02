import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { bumpBoardAndWallActivityByCardId, shouldBumpActivity } from "@/lib/db/activityBump";

export type CardBoardFileRow = {
  id: string;
  card_id: string;
  board_file_id: string;
  file_id: string | null;
  created_at: string;
  filename: string;
  bytes: number;
  mime: string | null;
  r2_key: string;
};

export async function attachBoardFileToCard(input: {
  cardId: string;
  boardFileId: string;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("card_files").upsert(
    {
      card_id: input.cardId,
      board_file_id: input.boardFileId,
    },
    { onConflict: "card_id,board_file_id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (shouldBumpActivity("attachmentLink")) {
    try {
      await bumpBoardAndWallActivityByCardId({ cardId: input.cardId });
    } catch (bumpError) {
      console.debug("activity_bump_failed", bumpError);
    }
  }
}

export async function listCardBoardFilesByCardIds(cardIds: string[]): Promise<CardBoardFileRow[]> {
  if (cardIds.length === 0) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("card_files")
    .select(
      "id, card_id, board_file_id, created_at, board_file:board_file_id (id, file_id, filename, bytes, mime, r2_key, deleted_at)",
    )
    .in("card_id", cardIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    card_id: string;
    board_file_id: string;
    created_at: string;
      board_file: {
        id: string;
        file_id: string | null;
        filename: string;
        bytes: number;
        mime: string | null;
        r2_key: string;
      deleted_at: string | null;
    } | null;
  }>;

  return rows
    .filter((row) => row.board_file && !row.board_file.deleted_at)
    .map((row) => ({
      id: row.id,
      card_id: row.card_id,
      board_file_id: row.board_file_id,
      file_id: row.board_file?.file_id ?? null,
      created_at: row.created_at,
      filename: row.board_file?.filename ?? "file",
      bytes: row.board_file?.bytes ?? 0,
      mime: row.board_file?.mime ?? null,
      r2_key: row.board_file?.r2_key ?? "",
    }));
}
