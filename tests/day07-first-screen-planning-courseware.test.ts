import test from "node:test";
import assert from "node:assert/strict";
import { DAY07_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("day07 first screen planning coverage", () => {
  const t = DAY07_LESSON_RUNTIME.blocks.map((b) => b.title).join(" ");
  assert.ok(t.includes("화면 요소 카드 선택") && t.includes("정보 우선순위 정하기") && t.includes("CTA 문장 만들기") && t.includes("나의 첫 화면 설계 카드"));
});
