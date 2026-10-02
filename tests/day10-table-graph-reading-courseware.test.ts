import test from "node:test";
import assert from "node:assert/strict";
import { DAY10_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("day10 table and graph reading coverage", () => {
  assert.ok(DAY10_LESSON_RUNTIME.totalMinutes >= 40 && DAY10_LESSON_RUNTIME.totalMinutes <= 50);
  const text = DAY10_LESSON_RUNTIME.blocks.map((b) => `${b.title} ${b.studentInstructions}`).join(" ");
  for (const token of ["표 읽기", "그래프", "과장", "시각화 설명", "나의 데이터 설명 카드"]) assert.ok(text.includes(token));
});
