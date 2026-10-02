import assert from "node:assert/strict";
import test from "node:test";

import { buildRevisionSummary } from "@/lib/coding-studio/revisionSummary";
import type { CodingStudioSubmissionSnapshot } from "@/lib/coding-studio/submissionSchema";

function makeSnapshot(submissionId: string, outcome: "attempted" | "completed", goalDistance: number, reachedGoal: boolean): CodingStudioSubmissionSnapshot {
  return {
    submissionSchemaVersion: 1,
    submissionId,
    assignmentId: null,
    lessonId: "goal-move",
    projectSchemaVersion: 1,
    submittedAt: new Date().toISOString(),
    entrySource: "free-practice",
    projectSnapshot: { schemaVersion: 1, projectId: "p", title: "t", lessonId: "goal-move", blocks: [], metadata: { updatedAt: new Date(0).toISOString(), source: "student" } },
    assessment: { tone: "retry", summary: "요약", keyCondition: "조건" },
    evidence: {
      outcome,
      runtime: { reachedGoal, blocked: false, stepCount: 0, finalPosition: { x: 0, z: 0, heading: 0 } },
      structure: { blockCount: 0, irInstructionCount: 0, repeatCount: 0, turnCount: 0, sensorCount: 0 },
      lessonSignal: { focus: "조건" },
      scene: { goalDistance },
    },
    replay: { reviewModeSupported: true, runtimeState: { x: 0, z: 0, heading: 0, stepCount: 0, reachedGoal: false, blocked: false }, sceneId: "goal-move" },
    revision: { previousSubmissionId: null, reworkSourceSubmissionId: null },
  };
}

test("revision summary compares before/after calmly", () => {
  const previous = makeSnapshot("s1", "attempted", 3, false);
  const current = makeSnapshot("s2", "completed", 0, true);
  const summary = buildRevisionSummary({ previous, current, reworkSourceSubmissionId: "s1", linkedGoalLabels: ["반복 구조"] });

  assert.ok(summary);
  assert.equal(summary?.previousSubmissionId, "s1");
  assert.equal(summary?.newSubmissionId, "s2");
  assert.equal(summary?.comparison.changedOutcome, true);
  assert.equal(summary?.comparison.successChanged, true);
  assert.match(summary?.linkedGoalLine ?? "", /반복 구조/);
});
