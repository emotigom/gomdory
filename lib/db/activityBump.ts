import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";
import { dbCols } from "@/lib/standards/dbCols";

const BOARDS_TABLE = "boards";
const WALLS_TABLE = "walls";

const BOARD_ID_COLUMN = "id";
const WALL_ID_COLUMN = "id";
const CARD_ID_COLUMN = "id";

const BOARD_ACTIVITY_COLUMN = "class_updated_at";
const WALL_ACTIVITY_COLUMN = "updated_at";

const WALL_BOARD_ID_ALIAS_SELECT = `boardId:${dbCols.walls.boardId}`;
const CARD_ACTIVITY_LOOKUP_SELECT = "wallId:wall_id, walls!inner(boardId:board_id)";

type BoardUpdatePayload = Database["public"]["Tables"]["boards"]["Update"];
type WallUpdatePayload = Database["public"]["Tables"]["walls"]["Update"];

export type ActivityActionType =
  | "cardCreate"
  | "cardUpdateText"
  | "cardUpdateUrl"
  | "cardUpdateColor"
  | "cardUpdateStatus"
  | "attachmentLink"
  | "attachmentUnlink";

export function shouldBumpActivity(actionType: ActivityActionType): boolean {
  return actionType.length > 0;
}

export function buildActivityBumpPayload(column: string, nowIso: string): Record<string, string> {
  const payload: Record<string, string> = {};
  payload[column] = nowIso;
  return payload;
}

export async function bumpWallActivity(input: {
  wallId: string;
  nowIso?: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const { error } = await supabase
    .from(WALLS_TABLE)
    .update(buildActivityBumpPayload(WALL_ACTIVITY_COLUMN, nowIso) as WallUpdatePayload)
    .eq(WALL_ID_COLUMN, input.wallId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function bumpBoardActivity(input: {
  boardId: string;
  nowIso?: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const { error } = await supabase
    .from(BOARDS_TABLE)
    .update(buildActivityBumpPayload(BOARD_ACTIVITY_COLUMN, nowIso) as BoardUpdatePayload)
    .eq(BOARD_ID_COLUMN, input.boardId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getBoardIdByWallId(wallId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(WALLS_TABLE)
    .select(WALL_BOARD_ID_ALIAS_SELECT)
    .eq(WALL_ID_COLUMN, wallId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as { boardId: string } | null;
  return row?.boardId ?? null;
}

export async function getBoardAndWallIdsByCardId(cardId: string): Promise<{ boardId: string; wallId: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cards")
    .select(CARD_ACTIVITY_LOOKUP_SELECT)
    .eq(CARD_ID_COLUMN, cardId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as { wallId: string; walls: { boardId: string } | null } | null;
  if (!row?.wallId || !row.walls?.boardId) {
    return null;
  }

  return { boardId: row.walls.boardId, wallId: row.wallId };
}

export async function bumpBoardAndWallActivity(input: {
  boardId: string;
  wallId: string;
  nowIso?: string;
}): Promise<void> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  await Promise.all([
    bumpBoardActivity({ boardId: input.boardId, nowIso }),
    bumpWallActivity({ wallId: input.wallId, nowIso }),
  ]);
}

export async function bumpBoardAndWallActivityByWallId(input: { wallId: string; nowIso?: string }): Promise<void> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const boardId = await getBoardIdByWallId(input.wallId);
  if (!boardId) {
    return;
  }

  await bumpBoardAndWallActivity({ boardId, wallId: input.wallId, nowIso });
}

export async function bumpBoardAndWallActivityByCardId(input: { cardId: string; nowIso?: string }): Promise<void> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const ids = await getBoardAndWallIdsByCardId(input.cardId);
  if (!ids) {
    return;
  }

  await bumpBoardAndWallActivity({ boardId: ids.boardId, wallId: ids.wallId, nowIso });
}
