import test from "node:test";
import assert from "node:assert/strict";
import { DAY12_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("day12 source/copyright/image safety coverage", () => {
  assert.ok(DAY12_LESSON_RUNTIME.totalMinutes >= 40 && DAY12_LESSON_RUNTIME.totalMinutes <= 50);
  const text = DAY12_LESSON_RUNTIME.blocks.map((b) => `${b.title} ${b.studentInstructions}`).join(" ");
  for (const token of ["출처", "이미지", "AI 생성 이미지", "출처 표시 문장", "안전 사용 카드"]) assert.ok(text.includes(token));
});
