import test from "node:test";
import assert from "node:assert/strict";
import { DAY08_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("day08 web screen check coverage", () => {
  const t = DAY08_LESSON_RUNTIME.blocks.map((b) => b.title).join(" ");
  assert.ok(t.includes("좋은 화면 기준 빙고") && t.includes("화면 문제 찾기") && t.includes("접근성/모바일 체크") && t.includes("나의 웹 화면 점검 카드"));
});
