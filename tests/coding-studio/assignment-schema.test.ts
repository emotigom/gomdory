import assert from "node:assert/strict";
import test from "node:test";

import { migrateLegacyAssignment, parseCodingStudioAssignment } from "@/lib/coding-studio/assignmentSchema";

test("assignment schema parser keeps typed lesson playlist and recommended start", () => {
  const parsed = parseCodingStudioAssignment({
    schemaVersion: 1,
    assignmentId: "intro-core-3",
    title: "오늘의 실습 경로",
    subtitle: "입문 1~3",
    lessonIds: ["goal-move", "turn-pivot", "repeat-route"],
    recommendedStartLessonId: "turn-pivot",
    source: "mock",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });

  assert.equal(parsed?.assignmentId, "intro-core-3");
  assert.deepEqual(parsed?.lessonIds, ["goal-move", "turn-pivot", "repeat-route"]);
  assert.equal(parsed?.recommendedStartLessonId, "turn-pivot");
});

test("legacy assignment payload migrates into v1 schema", () => {
  const migrated = migrateLegacyAssignment({
    id: "legacy-path",
    title: "레거시 경로",
    subtitle: "마이그레이션",
    lessonIds: ["goal-move", "unknown"],
    source: "local",
  });

  assert.equal(migrated?.schemaVersion, 1);
  assert.deepEqual(migrated?.lessonIds, ["goal-move"]);
  assert.equal(migrated?.recommendedStartLessonId, "goal-move");
});
