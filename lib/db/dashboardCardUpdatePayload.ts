import "server-only";

export const UPDATED_AT_COLUMN = "updated_at";

export const DASHBOARD_CARD_UPDATE_SELECT =
  "id, wallId:wall_id, text, authorName:author_name, createdAt:created_at, isHidden:is_hidden, isPinned:is_pinned, isFeatured:is_featured, cardColorToken:card_color_token" as const;

export const DASHBOARD_CARD_WALL_SELECT = "boardId:board_id" as const;

export const DASHBOARD_BOARD_SHARE_SELECT = "shareCode:share_code, shareEnabled:share_enabled" as const;

export function buildDashboardCardUpdatePayload(input: { text: string; nowIso: string }): Record<string, unknown> {
  const payload: Record<string, unknown> = { text: input.text };
  payload[UPDATED_AT_COLUMN] = input.nowIso;
  return payload;
}
