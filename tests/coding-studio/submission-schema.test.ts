import assert from "node:assert/strict";
import test from "node:test";

import { parseCodingStudioSubmissionSnapshot } from "@/lib/coding-studio/submissionSchema";

test("submission schema parser accepts current version snapshot", () => {
  const parsed = parseCodingStudioSubmissionSnapshot({
    submissionSchemaVersion: 1,
    submissionId: "s1",
    assignmentId: null,
    lessonId: "goal-move",
    projectSchemaVersion: 1,
    submittedAt: new Date(0).toISOString(),
    entrySource: "free-practice",
    projectSnapshot: { schemaVersion: 1, projectId: "p", title: "t", lessonId: "goal-move", blocks: [], metadata: { updatedAt: new Date(0).toISOString(), source: "student" } },
    assessment: { tone: "retry", summary: "요약", keyCondition: "조건" },
    evidence: {
      outcome: "attempted",
      runtime: { reachedGoal: false, blocked: false, stepCount: 1, finalPosition: { x: 0, z: 0, heading: 0 } },
      structure: { blockCount: 1, irInstructionCount: 1, repeatCount: 0, turnCount: 0, sensorCount: 0 },
      lessonSignal: { focus: "초점" },
      scene: { goalDistance: 1 },
    },
    replay: { reviewModeSupported: true, runtimeState: { x: 0, z: 0, heading: 0, stepCount: 1, reachedGoal: false, blocked: false }, sceneId: "goal-move" },
    revision: { previousSubmissionId: null, reworkSourceSubmissionId: null },
  });

  assert.ok(parsed);
  assert.equal(parsed?.submissionSchemaVersion, 1);
  assert.equal(parsed?.revision.previousSubmissionId, null);
});

test("submission schema parser migrates legacy payload", () => {
  const parsed = parseCodingStudioSubmissionSnapshot({
    submissionId: "legacy-1",
    lessonId: "goal-move",
    submittedAt: new Date(0).toISOString(),
    projectSnapshot: { schemaVersion: 1, projectId: "p", title: "t", lessonId: "goal-move", blocks: [], metadata: { updatedAt: new Date(0).toISOString(), source: "student" } },
  });

  assert.ok(parsed);
  assert.equal(parsed?.submissionSchemaVersion, 1);
  assert.equal(parsed?.entrySource, "free-practice");
  assert.equal(parsed?.revision.reworkSourceSubmissionId, null);
});
