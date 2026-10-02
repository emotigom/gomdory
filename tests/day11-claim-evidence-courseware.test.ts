import test from "node:test";
import assert from "node:assert/strict";
import { DAY11_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("day11 claim-evidence coverage", () => {
  assert.ok(DAY11_LESSON_RUNTIME.totalMinutes >= 40 && DAY11_LESSON_RUNTIME.totalMinutes <= 50);
  const text = DAY11_LESSON_RUNTIME.blocks.map((b) => `${b.title} ${b.studentInstructions}`).join(" ");
  for (const token of ["주장/근거", "약한 주장", "근거 카드", "핵심 메시지", "나의 주장과 근거 카드"]) assert.ok(text.includes(token));
});
