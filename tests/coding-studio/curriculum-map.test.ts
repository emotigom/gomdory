import assert from "node:assert/strict";
import test from "node:test";

import { CODING_STUDIO_CURRICULUM_MAP, resolveCurriculumContinuityLine } from "@/lib/coding-studio/curriculumMap";

test("curriculum map keeps staged flow aligned with lesson path", () => {
  assert.equal(CODING_STUDIO_CURRICULUM_MAP.length, 4);
  assert.deepEqual(CODING_STUDIO_CURRICULUM_MAP.map((stage) => stage.stageId), ["orientation", "control", "adaptation", "readiness"]);
  assert.deepEqual(CODING_STUDIO_CURRICULUM_MAP[1].lessonIds, ["repeat-route"]);
});

test("continuity line links rubric, revision, and next lesson bridge copy", () => {
  const line = resolveCurriculumContinuityLine("repeat-route");
  assert.match(line, /반복/);
  assert.match(line, /감지|조건 분기/);
  assert.match(line, /다음/);
});

test("continuity line generation is deterministic and pure", () => {
  const first = resolveCurriculumContinuityLine("sensor-branch");
  const second = resolveCurriculumContinuityLine("sensor-branch");
  assert.equal(first, second);
  assert.doesNotThrow(() => resolveCurriculumContinuityLine("goal-move"));
});
