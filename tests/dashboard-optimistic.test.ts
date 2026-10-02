import assert from "node:assert/strict";
import test from "node:test";

import { applyDashboardMutations } from "@/app/dashboard/useDashboardBoards";
import type { DashboardBoardSummary } from "@/lib/data/boards";

const baseBoards: DashboardBoardSummary[] = [
  { boardId: "board-a", title: "Board A" },
  { boardId: "board-b", title: "Board B" },
];

const baseState = {
  boards: baseBoards,
  pinnedIds: ["board-b"],
};

test("optimistic create adds board at top", () => {
  const derived = applyDashboardMutations(baseState, [
    {
      id: "mutation-create",
      type: "create",
      startedAt: Date.now(),
      rollbackBase: baseState,
      payload: {
        tempId: "temp-1",
        board: { boardId: "temp-1", title: "임시 보드" },
      },
    },
  ]);

  assert.equal(derived.boards[0].boardId, "temp-1");
  assert.equal(derived.boards.length, 3);
});

test("optimistic delete removes board", () => {
  const derived = applyDashboardMutations(baseState, [
    {
      id: "mutation-delete",
      type: "delete",
      startedAt: Date.now(),
      rollbackBase: baseState,
      payload: { boardId: "board-a" },
    },
  ]);

  assert.deepEqual(
    derived.boards.map((board) => board.boardId),
    ["board-b"],
  );
});

test("optimistic pin/unpin updates pinnedIds", () => {
  const pinned = applyDashboardMutations(baseState, [
    {
      id: "mutation-pin",
      type: "pin",
      startedAt: Date.now(),
      rollbackBase: baseState,
      payload: { boardId: "board-a" },
    },
  ]);
  const unpinned = applyDashboardMutations(baseState, [
    {
      id: "mutation-unpin",
      type: "unpin",
      startedAt: Date.now(),
      rollbackBase: baseState,
      payload: { boardId: "board-b" },
    },
  ]);

  assert.equal(pinned.pinnedIds[0], "board-a");
  assert.equal(unpinned.pinnedIds.length, 0);
});

test("rollback restores base snapshot", () => {
  const derived = applyDashboardMutations(baseState, [
    {
      id: "mutation-update",
      type: "update_meta",
      startedAt: Date.now(),
      rollbackBase: baseState,
      payload: { boardId: "board-a", patch: { title: "수정" } },
    },
  ]);
  const rolledBack = applyDashboardMutations(baseState, []);

  assert.equal(derived.boards[0].title, "수정");
  assert.equal(rolledBack.boards[0].title, "Board A");
});
