import assert from "node:assert/strict";
import test from "node:test";

import { buildDecorateServerPayload } from "@/lib/edu/lesson/decorateServerPayload";
import { shapeDecoratePlan } from "@/lib/edu/lesson/decoratePlanShaper";

test("server payload includes compact intent + safe constraints", () => {
  const built = buildDecorateServerPayload({
    prompt: "CTA 버튼 더 눈에 띄게",
    snapshotVersion: "v1",
    changedNodesCount: 2,
    intentSummary: {
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
    lowImpactRisk: true,
    shapedPlan: shapeDecoratePlan({
      intent: {
        primaryIntent: "emphasis",
        secondaryIntents: [],
        colors: [],
        tone: ["cute"],
        emphasisTargets: ["cta"],
        imageTargets: [],
        rewriteTargets: [],
        confidence: 0.9,
        isAmbiguous: false,
      },
      history: {
        recentIntentBias: ["emphasis"],
        recentToneBias: ["cute"],
        recentColorBias: [],
        recentEmphasisBias: ["cta"],
        avoidRepeatingWeakChanges: false,
        avoidConflictWithRecentUserEdit: false,
        avoidRegionKinds: [],
        preferStableTargets: true,
        historyConfidence: 0.8,
      },
    }),
    historyConfidence: 0.8,
  });
  assert.equal(built.payload.safeConstraints.previewFirst, true);
  assert.equal(built.payload.intentCompact?.primaryIntent, "emphasis");
  assert.ok(built.includedHintKinds.includes("safe_constraints"));
  assert.ok((built.payload.intentCompact?.majorStyleHints.length ?? 0) >= 1);
  assert.ok(built.includedHintKinds.includes("shaped_context"));
  assert.equal(built.payload.shapedContext?.stabilityPreference, "high");
});
