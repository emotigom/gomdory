import test from "node:test";
import assert from "node:assert/strict";
import { DAY03_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("day03 verification coverage", () => {
  const t = DAY03_LESSON_RUNTIME.blocks.map((b) => b.title).join(" ");
  assert.ok(t.includes("오류 찾기 카드") && t.includes("검증 렌즈 선택") && t.includes("AI 답변 수리하기") && t.includes("나의 AI 검증 체크리스트"));
});
