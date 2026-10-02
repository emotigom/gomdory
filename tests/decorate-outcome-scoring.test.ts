import assert from "node:assert/strict";
import test from "node:test";

import { scoreDecorateOutcome } from "@/lib/edu/lesson/decorateOutcomeScoring";

test("preview high + apply success => good/excellent", () => {
  const result = scoreDecorateOutcome({
    previewQuality: 0.92,
    lowImpactPreview: false,
    usedFallback: false,
    usedEnrich: true,
    applySucceeded: true,
    applyBlocked: false,
    consistencyClass: "consistent",
    staleRisk: "low",
  });
  assert.ok(result.score >= 80);
  assert.ok(result.bucket === "excellent" || result.bucket === "good");
});

test("apply blocked => failed bucket", () => {
  const result = scoreDecorateOutcome({
    previewQuality: 0.7,
    lowImpactPreview: false,
    usedFallback: false,
    usedEnrich: false,
    applySucceeded: false,
    applyBlocked: true,
    consistencyClass: "blocked",
    staleRisk: "high",
  });
  assert.equal(result.bucket, "failed");
  assert.equal(result.recommendedFollowup, "tune_apply_guard");
});
