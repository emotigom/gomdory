import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeLastOpenedBoardId,
  resolveLastOpenedBoardIdFromPrefs,
} from "@/lib/dashboard/lastOpenedBoard";

test("normalizeLastOpenedBoardId returns trimmed string or null", () => {
  assert.equal(normalizeLastOpenedBoardId(" board-1 "), "board-1");
  assert.equal(normalizeLastOpenedBoardId(""), null);
  assert.equal(normalizeLastOpenedBoardId("   "), null);
  assert.equal(normalizeLastOpenedBoardId(undefined), null);
});

test("resolveLastOpenedBoardIdFromPrefs reads camelCase key only", () => {
  assert.equal(resolveLastOpenedBoardIdFromPrefs({ lastOpenedBoardId: "abc" }), "abc");
  assert.equal(resolveLastOpenedBoardIdFromPrefs({ last_opened_board_id: "abc" }), null);
  assert.equal(resolveLastOpenedBoardIdFromPrefs(null), null);
});
