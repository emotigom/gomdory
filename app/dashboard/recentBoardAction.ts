export type RecentBoardAction =
  | { type: "navigate"; boardId: string }
  | { type: "fallback"; reason: "last_opened_board_id_missing" };

export function decideRecentBoardAction(lastOpenedBoardId: string | null): RecentBoardAction {
  if (!lastOpenedBoardId) {
    return { type: "fallback", reason: "last_opened_board_id_missing" };
  }

  return { type: "navigate", boardId: lastOpenedBoardId };
}
