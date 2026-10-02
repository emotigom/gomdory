import test from "node:test";
import assert from "node:assert/strict";
import { DAY04_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("day04 planning coverage", () => {
  const t = DAY04_LESSON_RUNTIME.blocks.map((b) => b.title).join(" ");
  assert.ok(t.includes("주제/대상/목적 선택") && t.includes("내용 설계 보드") && t.includes("AI에게 맡길 일 vs 내가 판단할 일") && t.includes("안전 공개 범위"));
});
