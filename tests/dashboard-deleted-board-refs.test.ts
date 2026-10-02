import assert from "node:assert/strict";
import test from "node:test";

import { filterDeletedBoardReferences } from "@/lib/dashboard/filterDeletedBoardRefs";

test("removes deleted lastOpenedBoardId and pinned board references", () => {
  const result = filterDeletedBoardReferences({
    boardIds: ["b1", "b3"],
    lastOpenedBoardId: "b2",
    pinnedBoardIds: ["b1", "b2", "b3"],
  });

  assert.equal(result.lastOpenedBoardId, null);
  assert.deepEqual(result.pinnedBoardIds, ["b1", "b3"]);
  assert.equal(result.changed, true);
});

test("preserves references when all board ids are active", () => {
  const result = filterDeletedBoardReferences({
    boardIds: ["b1", "b2"],
    lastOpenedBoardId: "b1",
    pinnedBoardIds: ["b2"],
  });

  assert.equal(result.lastOpenedBoardId, "b1");
  assert.deepEqual(result.pinnedBoardIds, ["b2"]);
  assert.equal(result.changed, false);
});
