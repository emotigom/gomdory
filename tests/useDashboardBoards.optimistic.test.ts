import assert from "node:assert/strict";
import test from "node:test";

import {
  applyOptimisticPatches,
  type OptimisticPatch,
} from "@/app/dashboard/useDashboardBoards";
import type { DashboardBoardSummary } from "@/lib/data/boards";

test("optimistic create patch appears at top", () => {
  const serverBoards: DashboardBoardSummary[] = [{ boardId: "board-a", title: "Board A" }];
  const patch: OptimisticPatch = {
    id: "patch-create",
    kind: "create",
    ts: Date.now(),
    board: {
      boardId: "tmp_1",
      title: "임시 보드",
      // @ts-expect-error - optimistic flag for UI only
      __optimistic: true,
    },
  };

  const derived = applyOptimisticPatches(serverBoards, [patch]);

  assert.equal(derived[0].boardId, "tmp_1");
  assert.equal(derived[1].boardId, "board-a");
});

test("optimistic delete patch removes board", () => {
  const serverBoards: DashboardBoardSummary[] = [{ boardId: "board-a", title: "Board A" }];
  const patch: OptimisticPatch = {
    id: "patch-delete",
    kind: "delete",
    ts: Date.now(),
    boardId: "board-a",
  };

  const derived = applyOptimisticPatches(serverBoards, [patch]);

  assert.equal(derived.length, 0);
});

test("rollback restores original board data", () => {
  const serverBoards: DashboardBoardSummary[] = [{ boardId: "board-a", title: "Board A" }];
  const patch: OptimisticPatch = {
    id: "patch-update",
    kind: "update",
    ts: Date.now(),
    boardId: "board-a",
    changes: { title: "수정된 보드" },
  };

  const updated = applyOptimisticPatches(serverBoards, [patch]);
  const rolledBack = applyOptimisticPatches(serverBoards, []);

  assert.equal(updated[0].title, "수정된 보드");
  assert.equal(rolledBack[0].title, "Board A");
});
