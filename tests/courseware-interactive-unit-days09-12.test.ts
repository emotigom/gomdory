import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DAY09_LESSON_RUNTIME, DAY10_LESSON_RUNTIME, DAY11_LESSON_RUNTIME, DAY12_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

const studio = fs.readFileSync("app/edu/lesson/_components/studio/OpeningUnitLessonStudios.tsx", "utf8");

for (const runtime of [DAY09_LESSON_RUNTIME, DAY10_LESSON_RUNTIME, DAY11_LESSON_RUNTIME, DAY12_LESSON_RUNTIME]) {
  test(`${runtime.lessonId} premium/no-login contract`, () => {
    assert.ok(runtime.totalMinutes >= 40 && runtime.totalMinutes <= 50);
    assert.ok(runtime.blocks.every((b) => /[가-힣]/.test(b.studentInstructions)));
    assert.ok(runtime.blocks.every((b) => b.supportsNoLogin));
    assert.ok(runtime.blocks.every((b) => b.fallbackAvailable));
  });
}

test("day09-12 studio markers and no legacy code studio strings", () => {
  assert.ok(studio.includes('data-courseware-runtime="interactive-lesson-studio-v1"'));
  assert.ok(studio.includes('data-lesson-volume="45-minute"'));
  assert.ok(studio.includes("Day09LessonStudio"));
  assert.ok(studio.includes("Day12LessonStudio"));
  for (const legacy of ["HTML textarea", "CSS textarea", "JS textarea"]) assert.equal(studio.includes(legacy), false);
});
