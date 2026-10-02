import test from "node:test";
import assert from "node:assert/strict";

import { buildAiLearningSpineTeacherSummary } from "@/lib/edu/courseware/aiLearningSpine/aiLearningSpineSummary";

test("teacher summary helper is conservative for partial evidence", () => {
  const summary = buildAiLearningSpineTeacherSummary([
    {
      lessonNumber: 1,
      publishScope: "class_only",
      verificationState: { "l1-privacy": true, "l1-accessibility": false },
      selectedChipIds: ["l1-easy"],
      evidence: { promptSummary: "done" },
    },
    {
      lessonNumber: 2,
      publishScope: "school_share",
      verificationState: {},
      selectedChipIds: [],
    },
  ]);

  assert.equal(summary.totalDrafts, 2);
  assert.equal(summary.promptChipEngagementRate, 50);
  assert.equal(summary.verificationCompletionRate, 50);
  assert.equal(summary.evidenceCompletionRate, 50);
  assert.equal(summary.privacyGapCount, 1);
  assert.equal(summary.accessibilityGapCount, 2);
  assert.equal(summary.rubricReadiness.technical_reliability, 1);
});
