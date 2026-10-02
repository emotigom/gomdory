import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const studio = fs.readFileSync("app/edu/lesson/_components/studio/OpeningUnitLessonStudios.tsx", "utf8");

test("day02-day04 premium runtime and asset markers", () => {
  assert.ok(studio.includes('data-courseware-runtime="interactive-lesson-studio-v1"'));
  assert.ok(studio.includes('data-courseware-assets={isOpeningUnit ? "assets-gomdory-opening-unit-v1" : undefined}'));
  assert.ok(studio.includes('runtime.lessonId === "day-2"'));
  assert.ok(studio.includes('runtime.lessonId === "day-3"'));
  assert.ok(studio.includes('runtime.lessonId === "day-4"'));
  assert.ok(studio.includes('data-lesson-volume="45-minute"'));
});

test("opening unit excludes legacy textarea prototype strings", () => {
  for (const t of ["수업 스튜디오", "HTML textarea", "CSS textarea", "JS textarea", "로컬 저장", "코드 복사"]) {
    assert.equal(studio.includes(t), false);
  }
});

test("opening unit uses assets domain and not models domain", () => {
  assert.ok(studio.includes("DAY01_AI_ROLE_ASSETS"));
  assert.equal(studio.includes("models.gomdory.com"), false);
});
