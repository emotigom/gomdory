import assert from "node:assert/strict";
import test from "node:test";

import { buildDecorateTuningSignal } from "@/lib/edu/lesson/decorateObservability";

test("tuning signal maps apply blocked to apply_guard_tuning", () => {
  const signal = buildDecorateTuningSignal({
    requestId: "req-1",
    intent: {
      primaryIntent: "emphasis",
      secondaryIntents: [],
      colors: [],
      tone: [],
      emphasisTargets: ["cta"],
      imageTargets: [],
      rewriteTargets: [],
      confidence: 0.9,
      isAmbiguous: false,
    },
    source: "server_llm",
    qualityScore: 0.8,
    lowImpactPreview: false,
    usedFallback: false,
    usedAutoEnrich: false,
    usedRecoveryDecision: false,
    applySucceeded: false,
    applyBlocked: true,
    blockedReason: "pending_stale_due_to_snapshot_change",
    invalidationReason: "pending_stale_due_to_snapshot_change",
  });
  assert.equal(signal.recommendedTuningBucket, "apply_guard_tuning");
});
