import test from "node:test";
import assert from "node:assert/strict";
import { DAY09_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("day09 data organization runtime coverage", () => {
  assert.ok(DAY09_LESSON_RUNTIME.totalMinutes >= 40 && DAY09_LESSON_RUNTIME.totalMinutes <= 50);
  const text = DAY09_LESSON_RUNTIME.blocks.map((b) => `${b.title} ${b.studentInstructions}`).join(" ");
  for (const token of ["자료 카드", "개인정보", "분류", "표", "나의 자료 정리 카드"]) assert.ok(text.includes(token));
  assert.ok(DAY09_LESSON_RUNTIME.blocks.every((b) => b.supportsNoLogin && b.fallbackAvailable));
});
