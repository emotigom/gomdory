import assert from "node:assert/strict";
import test from "node:test";

import { splitLessonCards, type LessonCard } from "@/app/edu/lesson/lessonListOrdering";

test("splitLessonCards keeps lessons 1-4 first and isolates free mode", () => {
  const cards: LessonCard[] = [
    { id: 0, title: "자유모드 · 빈 페이지" },
    { id: 4, title: "4교시: 작품 전시" },
    { id: 2, title: "2교시: 관심사 탐구" },
    { id: 1, title: "1교시: 자기소개" },
    { id: 3, title: "3교시: 퀴즈/미니게임" },
  ];

  const { coreLessons, freeMode } = splitLessonCards(cards);

  assert.deepEqual(
    coreLessons.map((lesson) => lesson.id),
    [1, 2, 3, 4],
  );
  assert.equal(freeMode?.id, 0);
});

test("splitLessonCards returns null when free mode is missing", () => {
  const cards: LessonCard[] = [
    { id: 4, title: "4교시: 작품 전시" },
    { id: 2, title: "2교시: 관심사 탐구" },
  ];

  const { coreLessons, freeMode } = splitLessonCards(cards);

  assert.deepEqual(
    coreLessons.map((lesson) => lesson.id),
    [2, 4],
  );
  assert.equal(freeMode, null);
});

test("splitLessonCards preserves known lessons first and appends unknown lessons in stable order", () => {
  const cards: LessonCard[] = [
    { id: 7, title: "7교시" },
    { id: 3, title: "3교시" },
    { id: 9, title: "9교시" },
    { id: 2, title: "2교시" },
  ];

  const { coreLessons } = splitLessonCards(cards);

  assert.deepEqual(
    coreLessons.map((lesson) => lesson.id),
    [2, 3, 7, 9],
  );
});

test("splitLessonCards skips duplicate ids after first appearance", () => {
  const cards: LessonCard[] = [
    { id: 2, title: "2교시 A" },
    { id: 2, title: "2교시 B" },
    { id: 1, title: "1교시" },
  ];

  const { coreLessons } = splitLessonCards(cards);

  assert.deepEqual(
    coreLessons.map((lesson) => ({ id: lesson.id, title: lesson.title })),
    [
      { id: 1, title: "1교시" },
      { id: 2, title: "2교시 A" },
    ],
  );
});

test("splitLessonCards applies safe fallback title when title is missing or blank", () => {
  const cards: LessonCard[] = [
    { id: 0, title: "   " },
    { id: 4, title: "" },
    { id: 6, title: null },
  ];

  const { coreLessons, freeMode } = splitLessonCards(cards);

  assert.equal(freeMode?.title, "자유모드 · 빈 페이지");
  assert.deepEqual(
    coreLessons.map((lesson) => lesson.title),
    ["4교시", "6교시"],
  );
});
