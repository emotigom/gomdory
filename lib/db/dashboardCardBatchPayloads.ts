import { toSnakeKeys } from "@/lib/standards/fields";

export const DASHBOARD_CARD_BATCH_DB_COLUMNS = {
  wallId: "wall_id",
} as const;

export const dashboardCardBatchSelect = `id, wallId:${DASHBOARD_CARD_BATCH_DB_COLUMNS.wallId}`;

export function buildDashboardCardMovePayload(input: { wallId: string; nowIso: string }): Record<string, unknown> {
  return toSnakeKeys({ wallId: input.wallId, updatedAt: input.nowIso });
}

export function buildDashboardCardColorPayload(input: {
  cardColorToken: string | null;
  nowIso: string;
}): Record<string, unknown> {
  return toSnakeKeys({ cardColorToken: input.cardColorToken, updatedAt: input.nowIso });
}

export function buildDashboardCardPinPayload(input: { pinned: boolean; nowIso: string }): Record<string, unknown> {
  return toSnakeKeys({ isPinned: input.pinned, pinnedAt: input.pinned ? input.nowIso : null, updatedAt: input.nowIso });
}

export function buildDashboardCardHidePayload(input: { hidden: boolean; nowIso: string }): Record<string, unknown> {
  return toSnakeKeys({ isHidden: input.hidden, hiddenAt: input.hidden ? input.nowIso : null, updatedAt: input.nowIso });
}
