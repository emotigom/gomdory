import assert from "node:assert/strict";
import test from "node:test";

import { buildDecorateDebugSummary, buildDecorateTuningSignal } from "@/lib/edu/lesson/decorateObservability";

test("debug summary builder redacts prompt into hash/len", () => {
  const summary = buildDecorateDebugSummary({
    requestId: "req-1",
    promptLen: 14,
    promptHash: "a1b2c3d4",
    intent: { primaryIntent: "color", confidence: 0.82, isAmbiguous: false },
    source: "server_llm",
    fallbackReason: null,
    qualityScore: 0.71,
    lowImpact: false,
    enriched: false,
    decision: "accept_preview",
    pending: true,
    baseSnapshotVersion: "snapshot-version-long",
    baseHtmlHash: "deadbeefcafebabe",
  });
  assert.equal(summary.promptLen, 14);
  assert.equal(summary.promptHash, "a1b2c3d4");
  assert.equal(summary.pendingState, "pending_preview");
  assert.equal(summary.htmlHash, "deadbeef");
});

test("adaptive tuning signal emission shape", () => {
  const signal = buildDecorateTuningSignal({
    requestId: "req-2",
    intent: {
      primaryIntent: "ambiguous",
      secondaryIntents: [],
      colors: [],
      tone: [],
      emphasisTargets: [],
      imageTargets: [],
      rewriteTargets: [],
      confidence: 0.31,
      isAmbiguous: true,
    },
    source: "deterministic",
    qualityScore: 0.22,
    lowImpactPreview: true,
    usedFallback: true,
    usedAutoEnrich: false,
    usedRecoveryDecision: true,
    applySucceeded: false,
    applyBlocked: true,
    blockedReason: "pending_stale_due_to_user_edit",
    invalidationReason: "pending_stale_due_to_user_edit",
  });
  assert.equal(signal.confidenceBucket, "low");
  assert.equal(signal.qualityBucket, "low");
  assert.equal(signal.promptClass, "vague");
  assert.equal(signal.recommendedTuningBucket, "apply_guard_tuning");
});
