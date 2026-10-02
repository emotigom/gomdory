import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNormalizedCardMove,
  clampTargetCardPosition,
  type CardPositionMoveRow,
} from "@/lib/board/cardPositionMove";

const rows: CardPositionMoveRow[] = [
  { id: "a", wall_id: "w1", position: 0, created_at: "2026-01-01T00:00:00.000Z" },
  { id: "b", wall_id: "w1", position: 1, created_at: "2026-01-01T00:00:01.000Z" },
  { id: "c", wall_id: "w1", position: 2, created_at: "2026-01-01T00:00:02.000Z" },
  { id: "d", wall_id: "w2", position: 0, created_at: "2026-01-01T00:00:03.000Z" },
  { id: "e", wall_id: "w2", position: 1, created_at: "2026-01-01T00:00:04.000Z" },
];

function orderFor(wallId: string, cards: CardPositionMoveRow[] = rows) {
  return buildNormalizedCardMove({
    rows: cards,
    cardId: "b",
    fromWallId: "w1",
    targetWallId: wallId,
    position: null,
  });
}

test("same-section reorder can move to the front, back, or between cards", () => {
  assert.deepEqual(
    buildNormalizedCardMove({ rows, cardId: "c", fromWallId: "w1", targetWallId: "w1", position: 0 })[0]?.cards.map((card) => card.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    buildNormalizedCardMove({ rows, cardId: "a", fromWallId: "w1", targetWallId: "w1", position: 2 })[0]?.cards.map((card) => card.id),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    buildNormalizedCardMove({ rows, cardId: "c", fromWallId: "w1", targetWallId: "w1", position: 1 })[0]?.cards.map((card) => card.id),
    ["a", "c", "b"],
  );
});

test("cross-section move updates source and target wall order at front, back, or between cards", () => {
  const front = buildNormalizedCardMove({ rows, cardId: "b", fromWallId: "w1", targetWallId: "w2", position: 0 });
  assert.deepEqual(front[0]?.cards.map((card) => card.id), ["a", "c"]);
  assert.deepEqual(front[1]?.cards.map((card) => card.id), ["b", "d", "e"]);
  assert.equal(front[1]?.cards[0]?.wall_id, "w2");

  assert.deepEqual(orderFor("w2")[1]?.cards.map((card) => card.id), ["d", "e", "b"]);
  assert.deepEqual(
    buildNormalizedCardMove({ rows, cardId: "b", fromWallId: "w1", targetWallId: "w2", position: 1 })[1]?.cards.map((card) => card.id),
    ["d", "b", "e"],
  );
});

test("empty-section move inserts the card at position zero", () => {
  const result = buildNormalizedCardMove({
    rows: rows.filter((card) => card.wall_id !== "w3"),
    cardId: "b",
    fromWallId: "w1",
    targetWallId: "w3",
    position: 8,
  });

  assert.deepEqual(result[1]?.cards.map((card) => `${card.id}:${card.wall_id}`), ["b:w3"]);
});

test("target position is clamped and missing moving card fails without mutating input rows", () => {
  assert.equal(clampTargetCardPosition(-10, 2), 0);
  assert.equal(clampTargetCardPosition(10, 2), 2);
  assert.equal(clampTargetCardPosition(1.8, 2), 1);
  assert.equal(clampTargetCardPosition(null, 2), 2);

  const before = structuredClone(rows);
  assert.throws(() => buildNormalizedCardMove({
    rows,
    cardId: "missing",
    fromWallId: "w1",
    targetWallId: "w2",
    position: 0,
  }), /card_move_failed/);
  assert.deepEqual(rows, before);
});
