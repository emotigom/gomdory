import test from "node:test";
import assert from "node:assert/strict";
import { DAY05_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("day05 problem finding coverage", () => {
  const t = DAY05_LESSON_RUNTIME.blocks.map((b) => b.title).join(" ");
  assert.ok(t.includes("문제 발견 빙고") && t.includes("문제 vs 불평 분류") && t.includes("개인정보 안전 점검") && t.includes("나의 문제 발견 카드"));
  assert.ok(DAY05_LESSON_RUNTIME.totalMinutes >= 40 && DAY05_LESSON_RUNTIME.totalMinutes <= 50);
});
