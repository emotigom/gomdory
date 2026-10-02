import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBoardByShareCode, type ShareBoard } from "@/lib/data/share";
import { ValidationError, validateStudentText } from "@/lib/safety/validateStudentText";

export type ShareWallSectionV2 = {
  id: string;
  board_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type WallV2CardContent = {
  type: "text";
  text: string;
  reasons?: string[];
};

export type ShareWallCardV2 = {
  id: string;
  section_id: string;
  author_id: string | null;
  position: number;
  content: WallV2CardContent;
  created_at: string;
  updated_at: string;
};

export type WallV2CardCursor = {
  position: number;
  id: string;
};

export type WallV2CardPagedResult = {
  items: ShareWallCardV2[];
  nextCursor: string | null;
};

export function encodeWallV2CardCursor(cursor: WallV2CardCursor | null): string | null {
  if (!cursor) return null;
  return `${cursor.position}|${cursor.id}`;
}

export function decodeWallV2CardCursor(value?: string | null): WallV2CardCursor | null {
  if (!value) return null;

  try {
    const [positionValue, id] = value.split("|");
    const position = Number(positionValue);
    if (!id || Number.isNaN(position)) return null;
    return { position, id };
  } catch (error) {
    console.error("Failed to decode wall v2 cursor", error);
    return null;
  }
}

export async function listSectionsV2ForShare(boardId: string): Promise<ShareWallSectionV2[]> {
  const supabase = createSupabaseAdminClient();
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

export async function listSectionsV2ForShareCode(
  code: string,
): Promise<{ board: ShareBoard; sections: ShareWallSectionV2[] } | null> {
  const board = await getBoardByShareCode(code);

  if (!board) {
    return null;
  }

  const sections = await listSectionsV2ForShare(board.id);
  return { board, sections };
}

export async function listSectionCardsV2ForShare(options: {
  sectionId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<WallV2CardPagedResult> {
  const supabase = createSupabaseAdminClient();
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 200);
  const cursor = decodeWallV2CardCursor(options.cursor);

  let query = supabase
    .from("wall_cards_v2")
    .select("id, section_id, author_id, position, content, created_at, updated_at")
    .eq("section_id", options.sectionId);

  if (cursor) {
    const encodedId = encodeURIComponent(cursor.id);
    query = query.or(
      `position.gt.${cursor.position},and(position.eq.${cursor.position},id.gt.${encodedId})`,
    );
  }

  const { data, error } = await query
    .order("position", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit + 1);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ShareWallCardV2[];
  const items = rows.slice(0, limit);
  const lastItem = items[items.length - 1];
  const nextCursor = rows.length > limit && lastItem
    ? encodeWallV2CardCursor({ position: lastItem.position, id: lastItem.id })
    : null;

  return { items, nextCursor };
}

export async function createStudentCardV2(input: {
  sectionId: string;
  content: WallV2CardContent;
  authorId?: string | null;
}): Promise<ShareWallCardV2> {
  if (!input.content || input.content.type !== "text" || typeof input.content.text !== "string") {
    throw new Error("내용을 입력해주세요.");
  }

  let validatedText = "";
  let reasons: string[] = [];
  try {
    const validated = validateStudentText(input.content.text, {
      maxLength: 500,
      minLength: 1,
      maxLines: 8,
    });
    validatedText = validated.text;
    reasons = validated.reasons;
  } catch (error) {
    if (error instanceof ValidationError && error.code === "too_long") {
      throw new Error("카드 내용은 500자 이내로 입력해주세요.");
    }
    throw new Error("내용을 입력해주세요.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: section, error: sectionError } = await supabase
    .from("wall_sections_v2")
    .select("id")
    .eq("id", input.sectionId)
    .maybeSingle();

  if (sectionError) {
    throw new Error(sectionError.message);
  }

  if (!section) {
    throw new Error("섹션을 찾을 수 없습니다.");
  }

  const { data: maxPositionRow, error: maxPositionError } = await supabase
    .from("wall_cards_v2")
    .select("position")
    .eq("section_id", input.sectionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();

  if (maxPositionError) {
    throw new Error(maxPositionError.message);
  }

  const nextPosition = (maxPositionRow?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("wall_cards_v2")
    .insert({
      section_id: input.sectionId,
      author_id: input.authorId ?? null,
      position: nextPosition,
      content: {
        type: "text",
        text: validatedText,
        reasons,
      },
    })
    .select("id, section_id, author_id, position, content, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("카드를 추가하지 못했습니다.");
  }

  return data as ShareWallCardV2;
}
