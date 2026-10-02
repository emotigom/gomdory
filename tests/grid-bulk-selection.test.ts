import assert from "node:assert/strict";
import test from "node:test";

import {
  initialGridSelectionState,
  popOneDeepUndo,
  pushOneDeepUndo,
  reduceGridSelection,
  type BulkUndoEntry,
} from "@/lib/board/gridBulkSelection";

test("reduceGridSelection clears selection and turns mode off on ESC", () => {
  const next = reduceGridSelection(
    {
      selectionMode: true,
      selectedCardIds: new Set(["card-1", "card-2"]),
    },
    { type: "esc" },
  );

  assert.equal(next.selectionMode, false);
  assert.deepEqual(Array.from(next.selectedCardIds), []);
});

test("one-deep undo stack keeps only latest action", () => {
  const first: BulkUndoEntry = {
    kind: "move",
    cardIds: ["card-1"],
    fromWallIdByCardId: { "card-1": "wall-a" },
    toWallId: "wall-b",
  };
  const second: BulkUndoEntry = {
    kind: "delete",
    cardIds: ["card-2", "card-3"],
  };

  const withFirst = pushOneDeepUndo(null, first);
  const withSecond = pushOneDeepUndo(withFirst, second);

  assert.deepEqual(withSecond, second);

  const popped = popOneDeepUndo(withSecond);
  assert.deepEqual(popped.entry, second);
  assert.equal(popped.next, null);
});

test("toggle mode off clears selected cards", () => {
  const selected = reduceGridSelection(initialGridSelectionState, { type: "toggle_card", cardId: "card-1" });
  const cleared = reduceGridSelection(selected, { type: "toggle_mode" });

  assert.equal(cleared.selectionMode, false);
  assert.deepEqual(Array.from(cleared.selectedCardIds), []);
});
