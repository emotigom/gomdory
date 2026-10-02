import assert from "node:assert/strict";
import test from "node:test";

import { CODING_STUDIO_CURRICULUM_MAP, resolveCurriculumStageByLessonId } from "@/lib/coding-studio/curriculumMap";
import { buildLearningGoalSummary } from "@/lib/coding-studio/learningGoalSummary";
import { STUDIO_LESSON_PATH } from "@/lib/coding-studio/lessons";
import { CODING_STUDIO_RUBRIC_SCHEMA } from "@/lib/coding-studio/rubricSchema";

test("rubric and lesson path stay aligned for every lesson", () => {
  for (const lesson of STUDIO_LESSON_PATH) {
    const rubric = CODING_STUDIO_RUBRIC_SCHEMA[lesson.id];
    assert.ok(rubric);
    assert.equal(rubric.lessonId, lesson.id);
    assert.equal(rubric.criteria.length > 0, true);
    assert.match(rubric.learningGoal, /[가-힣]/);
  }
});

test("curriculum map covers full lesson path without gaps", () => {
  const mapLessonIds = CODING_STUDIO_CURRICULUM_MAP.flatMap((stage) => stage.lessonIds);
  const lessonIds = STUDIO_LESSON_PATH.map((lesson) => lesson.id);
  assert.deepEqual(mapLessonIds, lessonIds);
  assert.equal(resolveCurriculumStageByLessonId("strategy-tune").stageId, "adaptation");
});

test("learning goal summary emits Korean-first guided strips", () => {
  const summary = buildLearningGoalSummary("sensor-branch");
  assert.match(summary.currentPractice, /관찰 포인트/);
  assert.match(summary.refineFocus, /다시 다듬을 부분/);
  assert.match(summary.nextBridge, /다음에 이어서 해볼 것/);
});
