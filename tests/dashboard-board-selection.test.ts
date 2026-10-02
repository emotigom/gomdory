import assert from "node:assert/strict";
import test from "node:test";

import {
  computeSelectedBoardIds,
  isBulkDeleteConfirmationValid,
  toggleBoardSelection,
} from "@/lib/dashboard/boardSelection";

test("toggleBoardSelection adds and removes board id", () => {
  assert.deepEqual(toggleBoardSelection([], "board-1"), ["board-1"]);
  assert.deepEqual(toggleBoardSelection(["board-1", "board-2"], "board-1"), ["board-2"]);
});

test("computeSelectedBoardIds keeps only selectable ids", () => {
  assert.deepEqual(
    computeSelectedBoardIds(["board-1", "board-2", "board-3"], ["board-2", "board-4"]),
    ["board-2"],
  );
});

test("isBulkDeleteConfirmationValid requires explicit token for multiple boards", () => {
  assert.equal(isBulkDeleteConfirmationValid("", 1), true);
  assert.equal(isBulkDeleteConfirmationValid("삭제", 3), true);
  assert.equal(isBulkDeleteConfirmationValid(" delete ", 3), false);
});
