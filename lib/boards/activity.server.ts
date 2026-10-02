import "server-only";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import type { BoardActivityAction, BoardActivityItem } from "@/lib/boards/activity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BOARD_ACTIVITY_ACTIONS: BoardActivityAction[] = [
  "card_created",
  "card_updated",
  "card_attachment_added",
  "card_link_added",
];

function parseBoardActivityAction(action: unknown): BoardActivityAction | null {
  return typeof action === "string" && BOARD_ACTIVITY_ACTIONS.includes(action as BoardActivityAction)
    ? (action as BoardActivityAction)
    : null;
}

function readCardId(row: { target_id?: unknown; meta?: unknown }): string | null {
  if (typeof row.target_id === "string" && row.target_id.length > 0) {
    return row.target_id;
  }
  if (row.meta && typeof row.meta === "object") {
    const maybeCardId = (row.meta as { cardId?: unknown }).cardId;
    if (typeof maybeCardId === "string" && maybeCardId.length > 0) {
      return maybeCardId;
    }
  }
  return null;
}

export async function listBoardRecentActivity(boardId: string, limit = 10): Promise<BoardActivityItem[]> {
  const safeLimit = Math.max(1, Math.min(limit, 10));
  const supabase = createSupabaseServerClient();
  const { data: roleData, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  if (roleError || !normalizeBoardRole(roleData)) {
    return [];
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("audit_events")
    .select("id, created_at, action, target_type, target_id, meta")
    .contains("meta", { boardId })
    .in("action", BOARD_ACTIVITY_ACTIONS)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !data) {
    return [];
  }

  return data
    .map((row) => {
      const action = parseBoardActivityAction(row.action);
      if (!action) return null;
      return {
        id: row.id,
        createdAt: row.created_at,
        action,
        cardId: readCardId(row),
      } satisfies BoardActivityItem;
    })
    .filter((item): item is BoardActivityItem => item !== null);
}
