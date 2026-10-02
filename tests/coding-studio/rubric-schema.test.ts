import assert from "node:assert/strict";
import test from "node:test";

import {
  CODING_STUDIO_RUBRIC_CRITERIA,
  getRubricCriteriaForLesson,
  parseCodingStudioRubricCriterion,
  resolveLessonRubricTargets,
} from "@/lib/coding-studio/rubricSchema";

test("rubric schema parses current criterion and supports legacy migration", () => {
  const parsedCurrent = parseCodingStudioRubricCriterion(CODING_STUDIO_RUBRIC_CRITERIA[0]);
  assert.ok(parsedCurrent);
  assert.equal(parsedCurrent?.rubricSchemaVersion, 1);

  const parsedLegacy = parseCodingStudioRubricCriterion({
    criterionId: "movement-distance",
    lessonId: "goal-move",
  });
  assert.ok(parsedLegacy);
  assert.equal(parsedLegacy?.lessonIds[0], "goal-move");
});

test("lesson rubric resolution keeps targets compact", () => {
  const criteria = getRubricCriteriaForLesson("loop-turn");
  assert.equal(criteria.length >= 2, true);

  const targets = resolveLessonRubricTargets("sensor-avoid");
  assert.ok(targets.primary);
  assert.ok(targets.secondary);
});
