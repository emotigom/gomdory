import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTeacherCardMoveOptimistic,
  isNoopTeacherCardMove,
} from "@/lib/board/teacherCardMoveOptimistic";

type TestCard = { id: string; position: number | null; text: string };

const entries = [
  {
    wall: { id: "wall-a" },
    cards: [
      { id: "card-a", position: 0, text: "A" },
      { id: "card-b", position: 1, text: "B" },
      { id: "card-c", position: 2, text: "C" },
    ],
  },
  {
    wall: { id: "wall-b" },
    cards: [
      { id: "card-d", position: 0, text: "D" },
      { id: "card-e", position: 1, text: "E" },
    ],
  },
  {
    wall: { id: "wall-empty" },
    cards: [] as TestCard[],
  },
];

test("same-section optimistic move reorders and normalizes positions", () => {
  const result = applyTeacherCardMoveOptimistic({
    entries,
    cardId: "card-c",
    targetWallId: "wall-a",
    targetPosition: 0,
  });

  assert.equal(result.changed, true);
  assert.equal(result.fromWallId, "wall-a");
  assert.equal(result.fromPosition, 2);
  assert.deepEqual(
    result.entries[0]?.cards.map((card) => `${card.id}:${card.position}`),
    ["card-c:0", "card-a:1", "card-b:2"],
  );
});

test("cross-section optimistic move updates source and target positions", () => {
  const result = applyTeacherCardMoveOptimistic({
    entries,
    cardId: "card-b",
    targetWallId: "wall-b",
    targetPosition: 1,
  });

  assert.deepEqual(
    result.entries[0]?.cards.map((card) => `${card.id}:${card.position}`),
    ["card-a:0", "card-c:1"],
  );
  assert.deepEqual(
    result.entries[1]?.cards.map((card) => `${card.id}:${card.position}`),
    ["card-d:0", "card-b:1", "card-e:2"],
  );
});

test("empty-section optimistic move inserts at position zero", () => {
  const result = applyTeacherCardMoveOptimistic({
    entries,
    cardId: "card-a",
    targetWallId: "wall-empty",
    targetPosition: 0,
  });

  assert.deepEqual(
    result.entries[2]?.cards.map((card) => `${card.id}:${card.position}`),
    ["card-a:0"],
  );
});

test("optimistic move does not mutate the source snapshot and detects no-op drops", () => {
  const before = structuredClone(entries);
  const result = applyTeacherCardMoveOptimistic({
    entries,
    cardId: "card-a",
    targetWallId: "wall-b",
    targetPosition: 10,
  });

  assert.equal(result.changed, true);
  assert.deepEqual(entries, before);
  assert.deepEqual(
    result.entries[1]?.cards.map((card) => `${card.id}:${card.position}`),
    ["card-d:0", "card-e:1", "card-a:2"],
  );
  assert.equal(
    isNoopTeacherCardMove({
      sourceWallId: "wall-a",
      sourcePosition: 1,
      targetWallId: "wall-a",
      targetPosition: 1,
    }),
    true,
  );
  assert.equal(
    isNoopTeacherCardMove({
      sourceWallId: "wall-a",
      sourcePosition: 1,
      targetWallId: "wall-a",
      targetPosition: 2,
    }),
    false,
  );
});
