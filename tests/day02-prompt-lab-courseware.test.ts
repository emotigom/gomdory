import test from "node:test";
import assert from "node:assert/strict";
import { DAY02_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("day02 prompt lab coverage", () => {
  const t = DAY02_LESSON_RUNTIME.blocks.map((b) => b.title).join(" ");
  assert.ok(t.includes("질문 품질 비교") && t.includes("프롬프트 조립 실험") && t.includes("개인정보 점검") && t.includes("나의 좋은 질문 공식"));
});
