import test from "node:test";
import assert from "node:assert/strict";
import { DAY01_LESSON_RUNTIME, DAY02_LESSON_RUNTIME, DAY03_LESSON_RUNTIME, DAY04_LESSON_RUNTIME, DAY05_LESSON_RUNTIME, DAY06_LESSON_RUNTIME, DAY07_LESSON_RUNTIME, DAY08_LESSON_RUNTIME, DAY09_LESSON_RUNTIME, DAY10_LESSON_RUNTIME, DAY11_LESSON_RUNTIME, DAY12_LESSON_RUNTIME, getLessonRuntimeById } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

const all = [DAY01_LESSON_RUNTIME, DAY02_LESSON_RUNTIME, DAY03_LESSON_RUNTIME, DAY04_LESSON_RUNTIME, DAY05_LESSON_RUNTIME, DAY06_LESSON_RUNTIME, DAY07_LESSON_RUNTIME, DAY08_LESSON_RUNTIME, DAY09_LESSON_RUNTIME, DAY10_LESSON_RUNTIME, DAY11_LESSON_RUNTIME, DAY12_LESSON_RUNTIME];

test("courseware interactive runtime lookup", () => {
  assert.equal(getLessonRuntimeById("day-1")?.lessonId, "day-1");
  assert.equal(getLessonRuntimeById("day-12")?.lessonId, "day-12");
  assert.equal(getLessonRuntimeById("day-999"), null);
});

test("courseware interactive runtime contract", () => {
  for (const runtime of all) {
    assert.ok(runtime.totalMinutes >= 40 && runtime.totalMinutes <= 50);
    assert.ok(runtime.phases.length >= 5);
    assert.ok(runtime.blocks.some((b) => b.kind === "teacher_guide"));
    assert.ok(runtime.blocks.some((b) => b.kind === "exit_ticket"));
    assert.ok(runtime.blocks.every((b) => b.supportsNoLogin));
    assert.ok(runtime.blocks.every((b) => b.fallbackAvailable));
    assert.ok(runtime.blocks.every((b) => /[가-힣]/.test(b.studentInstructions)));
  }
});
