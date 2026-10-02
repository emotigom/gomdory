import assert from "node:assert/strict";
import test from "node:test";

import { selectionReducer, type SelectionState } from "@/app/dashboard/boards/[boardId]/class/selectionReducer";

const baseState = (): SelectionState => ({ selectedIds: new Set<string>(), lastSelectedId: null });

test("selectionReducer supports shift range selection", () => {
  let state = baseState();
  const itemIds = ["a", "b", "c", "d"];

  state = selectionReducer(state, { type: "toggle", id: "b", itemIds });
  state = selectionReducer(state, { type: "toggle", id: "d", itemIds, range: true, rangeIds: itemIds });

  assert.deepEqual(Array.from(state.selectedIds).sort(), ["b", "c", "d"]);
  assert.equal(state.lastSelectedId, "d");
});

test("selectionReducer supports additive ctrl/cmd toggle", () => {
  let state = baseState();
  const itemIds = ["a", "b", "c"];

  state = selectionReducer(state, { type: "toggle", id: "a", itemIds });
  state = selectionReducer(state, { type: "toggle", id: "c", itemIds, additive: true });

  assert.deepEqual(Array.from(state.selectedIds).sort(), ["a", "c"]);
});
