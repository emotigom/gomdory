import assert from "node:assert/strict";
import test from "node:test";

import {
  TEACHER_CARD_DRAG_ACTIVATION_DELAY_MS,
  TEACHER_CARD_DRAG_AUTO_SCROLL_EDGE_PX,
  TEACHER_CARD_DRAG_MOVE_TOLERANCE_PX,
  calculateTeacherCardAutoScrollDelta,
  calculateTeacherCardDropPosition,
  isCardDragBlockedTarget,
  isTeacherCardDragPointerCandidate,
  type TeacherCardDragWallRect,
} from "@/lib/board/teacherCardDrag";

function targetMatching(selectorToken: string | null): EventTarget {
  return {
    closest(selector: string) {
      return selectorToken && selector.includes(selectorToken) ? {} : null;
    },
  } as unknown as EventTarget;
}

const walls: TeacherCardDragWallRect[] = [
  {
    wallId: "wall-a",
    rect: { left: 0, top: 0, right: 300, bottom: 800 },
    cards: [
      { cardId: "card-a", rect: { left: 16, top: 20, right: 284, bottom: 120 } },
      { cardId: "card-b", rect: { left: 16, top: 140, right: 284, bottom: 240 } },
      { cardId: "card-c", rect: { left: 16, top: 260, right: 284, bottom: 360 } },
    ],
  },
  {
    wallId: "wall-b",
    rect: { left: 320, top: 0, right: 620, bottom: 800 },
    cards: [
      { cardId: "card-d", rect: { left: 336, top: 40, right: 604, bottom: 140 } },
      { cardId: "card-e", rect: { left: 336, top: 160, right: 604, bottom: 260 } },
    ],
  },
  {
    wallId: "wall-empty",
    rect: { left: 640, top: 0, right: 940, bottom: 800 },
    cards: [],
  },
];

test("interactive card targets block drag start", () => {
  for (const selector of [
    "button",
    "a",
    "input",
    "textarea",
    "select",
    '[contenteditable="true"]',
    "[data-no-card-drag]",
  ]) {
    assert.equal(isCardDragBlockedTarget(targetMatching(selector)), true, selector);
  }

  assert.equal(isCardDragBlockedTarget(targetMatching(null)), false);
  assert.equal(isCardDragBlockedTarget(null), false);
});

test("only the left mouse button can become a long-press drag candidate", () => {
  assert.equal(TEACHER_CARD_DRAG_ACTIVATION_DELAY_MS, 220);
  assert.equal(TEACHER_CARD_DRAG_MOVE_TOLERANCE_PX, 6);

  assert.equal(
    isTeacherCardDragPointerCandidate({
      pointerType: "mouse",
      button: 0,
      target: targetMatching(null),
    }),
    true,
  );
  assert.equal(
    isTeacherCardDragPointerCandidate({
      pointerType: "mouse",
      button: 2,
      target: targetMatching(null),
    }),
    false,
  );
  assert.equal(
    isTeacherCardDragPointerCandidate({
      pointerType: "mouse",
      button: 1,
      target: targetMatching(null),
    }),
    false,
  );
  assert.equal(
    isTeacherCardDragPointerCandidate({
      pointerType: "touch",
      button: 0,
      target: targetMatching(null),
    }),
    false,
  );
  assert.equal(
    isTeacherCardDragPointerCandidate({
      pointerType: "mouse",
      button: 0,
      target: targetMatching("button"),
    }),
    false,
  );
});

test("same-wall drop position can resolve the first slot", () => {
  assert.deepEqual(
    calculateTeacherCardDropPosition({
      pointer: { x: 100, y: 25 },
      walls,
      draggingCardId: "card-c",
      currentWallId: "wall-a",
      currentPosition: 2,
    }),
    { wallId: "wall-a", position: 0 },
  );
});

test("same-wall drop position can resolve between cards", () => {
  assert.deepEqual(
    calculateTeacherCardDropPosition({
      pointer: { x: 100, y: 130 },
      walls,
      draggingCardId: "card-c",
      currentWallId: "wall-a",
      currentPosition: 2,
    }),
    { wallId: "wall-a", position: 1 },
  );
});

test("same-wall drop position can resolve the last slot", () => {
  assert.deepEqual(
    calculateTeacherCardDropPosition({
      pointer: { x: 100, y: 760 },
      walls,
      draggingCardId: "card-a",
      currentWallId: "wall-a",
      currentPosition: 0,
    }),
    { wallId: "wall-a", position: 2 },
  );
});

test("pointer inside another wall resolves that wall position", () => {
  assert.deepEqual(
    calculateTeacherCardDropPosition({
      pointer: { x: 500, y: 150 },
      walls,
      draggingCardId: "card-a",
      currentWallId: "wall-a",
      currentPosition: 0,
    }),
    { wallId: "wall-b", position: 1 },
  );
});

test("empty wall resolves position zero", () => {
  assert.deepEqual(
    calculateTeacherCardDropPosition({
      pointer: { x: 700, y: 300 },
      walls,
      draggingCardId: "card-a",
      currentWallId: "wall-a",
      currentPosition: 0,
    }),
    { wallId: "wall-empty", position: 0 },
  );
});

test("dragging card is excluded from position calculation", () => {
  assert.deepEqual(
    calculateTeacherCardDropPosition({
      pointer: { x: 100, y: 250 },
      walls,
      draggingCardId: "card-b",
      currentWallId: "wall-a",
      currentPosition: 1,
    }),
    { wallId: "wall-a", position: 1 },
  );
});

test("pointer outside every wall keeps the current wall and position", () => {
  assert.deepEqual(
    calculateTeacherCardDropPosition({
      pointer: { x: -200, y: -100 },
      walls,
      draggingCardId: "card-b",
      currentWallId: "wall-a",
      currentPosition: 1,
    }),
    { wallId: "wall-a", position: 1 },
  );
});

test("auto-scroll helper returns negative horizontal speed in the left edge zone", () => {
  const delta = calculateTeacherCardAutoScrollDelta({
    pointer: { x: 104, y: 300 },
    boardRect: { left: 100, right: 700, top: 0, bottom: 800 },
    columnRect: null,
  });

  assert.equal(TEACHER_CARD_DRAG_AUTO_SCROLL_EDGE_PX, 72);
  assert.ok(delta.x < 0);
  assert.equal(delta.y, 0);
});

test("auto-scroll helper returns positive horizontal speed in the right edge zone", () => {
  const delta = calculateTeacherCardAutoScrollDelta({
    pointer: { x: 696, y: 300 },
    boardRect: { left: 100, right: 700, top: 0, bottom: 800 },
    columnRect: null,
  });

  assert.ok(delta.x > 0);
  assert.equal(delta.y, 0);
});

test("auto-scroll helper returns negative vertical speed in the column top edge zone", () => {
  const delta = calculateTeacherCardAutoScrollDelta({
    pointer: { x: 300, y: 204 },
    boardRect: null,
    columnRect: { left: 100, right: 420, top: 200, bottom: 800 },
  });

  assert.equal(delta.x, 0);
  assert.ok(delta.y < 0);
});

test("auto-scroll helper returns positive vertical speed in the column bottom edge zone", () => {
  const delta = calculateTeacherCardAutoScrollDelta({
    pointer: { x: 300, y: 796 },
    boardRect: null,
    columnRect: { left: 100, right: 420, top: 200, bottom: 800 },
  });

  assert.equal(delta.x, 0);
  assert.ok(delta.y > 0);
});

test("auto-scroll helper returns zero outside edge zones", () => {
  assert.deepEqual(
    calculateTeacherCardAutoScrollDelta({
      pointer: { x: 400, y: 500 },
      boardRect: { left: 100, right: 700, top: 0, bottom: 800 },
      columnRect: { left: 100, right: 420, top: 200, bottom: 800 },
    }),
    { x: 0, y: 0 },
  );
});
