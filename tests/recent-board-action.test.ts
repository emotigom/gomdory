import assert from "node:assert/strict";
import test from "node:test";

import { decideRecentBoardAction } from "@/app/dashboard/recentBoardAction";

test("falls back when lastOpenedBoardId is missing", () => {
  assert.deepEqual(decideRecentBoardAction(null), { type: "fallback", reason: "last_opened_board_id_missing" });
});

test("navigates when lastOpenedBoardId is present", () => {
  assert.deepEqual(decideRecentBoardAction("board-1"), { type: "navigate", boardId: "board-1" });
});
