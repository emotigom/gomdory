import test from "node:test";
import assert from "node:assert/strict";

import { canReorderShareCard, moveCardAcrossWalls } from "@/lib/board/cardReorder";

test("owner/share creator permission helper", () => {
  assert.equal(canReorderShareCard("client-a", "client-a"), true);
  assert.equal(canReorderShareCard("client-a", "client-b"), false);
  assert.equal(canReorderShareCard(null, "client-a"), false);
});

test("same-wall reorder moves the card to the requested position", () => {
  const result = moveCardAcrossWalls({
    entries: [
      { wall: { id: "w1" }, cards: [{ id: "c1" }, { id: "c2" }, { id: "c3" }] },
    ],
    cardId: "c1",
    toWallId: "w1",
    toIndex: 2,
  });
  assert.equal(result.changed, true);
  assert.deepEqual(result.entries[0]?.cards.map((card) => card.id), ["c2", "c3", "c1"]);
});

test("cross-wall move inserts at target index and returns changed=true", () => {
  const result = moveCardAcrossWalls({
    entries: [
      { wall: { id: "w1" }, cards: [{ id: "c1" }, { id: "c2" }] },
      { wall: { id: "w2" }, cards: [{ id: "c3" }] },
    ],
    cardId: "c2",
    toWallId: "w2",
    toIndex: 1,
  });
  assert.equal(result.changed, true);
  assert.deepEqual(result.entries[0]?.cards.map((card) => card.id), ["c1"]);
  assert.deepEqual(result.entries[1]?.cards.map((card) => card.id), ["c3", "c2"]);
});


test("rapid reorder sequence converges to expected final state", () => {
  let entries = [
    { wall: { id: "w1" }, cards: [{ id: "c1" }, { id: "c2" }, { id: "c3" }] },
    { wall: { id: "w2" }, cards: [{ id: "c4" }] },
  ];

  const sequence: Array<{ cardId: string; toWallId: string; toIndex: number }> = [
    { cardId: "c1", toWallId: "w2", toIndex: 0 },
    { cardId: "c4", toWallId: "w1", toIndex: 1 },
    { cardId: "c2", toWallId: "w2", toIndex: 1 },
    { cardId: "c1", toWallId: "w1", toIndex: 2 },
  ];

  for (const step of sequence) {
    const moved = moveCardAcrossWalls({ entries, ...step });
    entries = moved.entries;
  }

  assert.deepEqual(entries[0]?.cards.map((card) => card.id), ["c4", "c3", "c1"]);
  assert.deepEqual(entries[1]?.cards.map((card) => card.id), ["c2"]);
});
