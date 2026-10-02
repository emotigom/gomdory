import test from "node:test";
import assert from "node:assert/strict";
import { DAY05_LESSON_RUNTIME, DAY06_LESSON_RUNTIME, DAY07_LESSON_RUNTIME, DAY08_LESSON_RUNTIME } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

const unit = [DAY05_LESSON_RUNTIME, DAY06_LESSON_RUNTIME, DAY07_LESSON_RUNTIME, DAY08_LESSON_RUNTIME];

test("day05-08 runtime unit contract", () => {
  for (const runtime of unit) {
    assert.ok(runtime.totalMinutes >= 40 && runtime.totalMinutes <= 50);
    assert.ok(runtime.blocks.every((b) => b.supportsNoLogin));
    assert.ok(runtime.blocks.every((b) => b.fallbackAvailable));
    assert.ok(runtime.blocks.some((b) => b.privacyLevel === "privacy_notice_required"));
    assert.ok(runtime.blocks.every((b) => /[가-힣]/.test(b.studentInstructions)));
  }
});
