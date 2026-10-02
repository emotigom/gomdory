import test from "node:test";
import assert from "node:assert/strict";
import { DAY06_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("day06 minimal survey coverage", () => {
  const t = DAY06_LESSON_RUNTIME.blocks.map((b) => b.title).join(" ");
  assert.ok(t.includes("위험 질문 찾기") && t.includes("최소수집 필터") && t.includes("나의 최소수집 설문 초안"));
  assert.ok(DAY06_LESSON_RUNTIME.blocks.every((b) => b.supportsNoLogin));
});
