import "server-only";

import { getBoardShareSettings } from "@/lib/data/boardShareSettings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { TemplateBoardExport } from "@/lib/templates/sanitizeTemplatePayload";
import type { ExternalAttachment } from "@/lib/types/attachments";

export async function exportBoardTemplate(boardId: string): Promise<TemplateBoardExport> {
  const supabase = createSupabaseAdminClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, title, description, board_view_type")
    .eq("id", boardId)
    .maybeSingle();

  if (boardError) {
    throw new Error(boardError.message);
  }

  if (!board) {
    throw new Error("board not found");
  }

  const shareSettings = await getBoardShareSettings(boardId, supabase);

  const { data: walls, error: wallsError } = await supabase
    .from("walls")
    .select("id, title, description, position")
    .eq("board_id", boardId)
    .order("position", { ascending: true });

  if (wallsError) {
    throw new Error(wallsError.message);
  }

  const wallIds = (walls ?? []).map((wall) => wall.id);
  let cards: Array<{
    wall_id?: string | null;
    author_type?: "teacher" | "student" | null;
    text?: string | null;
    external_attachments?: ExternalAttachment[] | null;
  }> = [];

  if (wallIds.length > 0) {
    const { data: cardRows, error: cardError } = await supabase
      .from("cards")
      .select("wall_id, author_type, text, external_attachments")
      .in("wall_id", wallIds)
      .eq("is_hidden", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (cardError) {
      throw new Error(cardError.message);
    }

    cards = (cardRows ?? []).map((card) => ({
      wall_id: card.wall_id,
      author_type: card.author_type as "teacher" | "student" | null,
      text: card.text,
      external_attachments: (card.external_attachments ?? null) as ExternalAttachment[] | null,
    }));
  }

  return {
    board: {
      title: board.title,
      description: board.description,
      board_view_type: board.board_view_type,
      view_defaults: {
        studentDefaultView: shareSettings.studentDefaultView,
      },
    },
    walls: (walls ?? []).map((wall) => ({
      id: wall.id,
      title: wall.title,
      description: wall.description,
      position: wall.position,
    })),
    cards,
  };
}
