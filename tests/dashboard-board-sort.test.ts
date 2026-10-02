import assert from "node:assert/strict";
import test from "node:test";

import { sortBoardsForDashboard } from "@/lib/dashboard/sortBoardsForDashboard";

test("pins last opened board to the top when present", () => {
  const sorted = sortBoardsForDashboard(
    [
      { id: "b", createdAt: "2026-01-01T00:00:00.000Z", lastUpdatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "a", createdAt: "2026-01-02T00:00:00.000Z", lastUpdatedAt: "2026-01-02T00:00:00.000Z" },
    ],
    "b",
    [],
  );

  assert.deepEqual(
    sorted.map((board) => board.id),
    ["b", "a"],
  );
});

test("places pinned boards after last opened and before unpinned", () => {
  const sorted = sortBoardsForDashboard(
    [
      { id: "last", createdAt: "2026-01-01T00:00:00.000Z", lastUpdatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "pinned-older", createdAt: "2026-01-01T00:00:00.000Z", lastUpdatedAt: "2026-01-02T00:00:00.000Z" },
      { id: "pinned-newer", createdAt: "2026-01-01T00:00:00.000Z", lastUpdatedAt: "2026-01-03T00:00:00.000Z" },
      { id: "other", createdAt: "2026-01-10T00:00:00.000Z", lastUpdatedAt: "2026-01-10T00:00:00.000Z" },
    ],
    "last",
    ["pinned-older", "pinned-newer"],
  );

  assert.deepEqual(sorted.map((board) => board.id), ["last", "pinned-newer", "pinned-older", "other"]);
});

test("sorts by lastUpdatedAt desc and falls back to createdAt desc", () => {
  const sorted = sortBoardsForDashboard(
    [
      { id: "a", createdAt: "2026-01-01T00:00:00.000Z", lastUpdatedAt: null },
      { id: "b", createdAt: "2026-01-03T00:00:00.000Z", lastUpdatedAt: "2026-01-02T00:00:00.000Z" },
      { id: "c", createdAt: "2026-01-02T00:00:00.000Z", lastUpdatedAt: "2026-01-04T00:00:00.000Z" },
    ],
    null,
    [],
  );

  assert.deepEqual(
    sorted.map((board) => board.id),
    ["c", "b", "a"],
  );
});

test("uses id asc as stable tie-breaker", () => {
  const sorted = sortBoardsForDashboard(
    [
      { id: "z", createdAt: "2026-01-01T00:00:00.000Z", lastUpdatedAt: "2026-01-02T00:00:00.000Z" },
      { id: "a", createdAt: "2026-01-01T00:00:00.000Z", lastUpdatedAt: "2026-01-02T00:00:00.000Z" },
      { id: "m", createdAt: "2026-01-01T00:00:00.000Z", lastUpdatedAt: "2026-01-02T00:00:00.000Z" },
    ],
    null,
    [],
  );

  assert.deepEqual(
    sorted.map((board) => board.id),
    ["a", "m", "z"],
  );
});
