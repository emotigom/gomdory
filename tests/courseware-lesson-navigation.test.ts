import test from "node:test";
import assert from "node:assert/strict";
import { getLessonRuntimeById } from "@/lib/edu/courseware/lessonRuntime/lessonRuntimeCatalog";

test("courseware lesson navigation supports day1-12", () => {
  for (const id of ["day-1", "day-2", "day-3", "day-4", "day-5", "day-6", "day-7", "day-8", "day-9", "day-10", "day-11", "day-12"]) assert.equal(getLessonRuntimeById(id)?.lessonId, id);
});

test("courseware lesson navigation unknown fallback", () => {
  assert.equal(getLessonRuntimeById("day-55"), null);
});
