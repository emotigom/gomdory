import assert from "node:assert/strict";
import test from "node:test";

import { shapeDecoratePlan } from "@/lib/edu/lesson/decoratePlanShaper";

test("applies tone/color/target bias and avoids recent user-edit conflict", () => {
  const shaped = shapeDecoratePlan({
    intent: {
      primaryIntent: "ambiguous",
      secondaryIntents: [],
      colors: [],
      tone: [],
      emphasisTargets: [],
      imageTargets: [],
      rewriteTargets: [],
      confidence: 0.4,
      isAmbiguous: true,
    },
    history: {
      recentIntentBias: ["tone"],
      recentToneBias: ["soft"],
      recentColorBias: ["pink"],
      recentEmphasisBias: ["cta"],
      avoidRepeatingWeakChanges: false,
      avoidConflictWithRecentUserEdit: true,
      avoidRegionKinds: ["title", "button"],
      preferStableTargets: true,
      historyConfidence: 0.8,
    },
    pageSignals: { recentUserEditRegionKinds: ["button"], imageSlotsAvailable: 1 },
    allowUserEditConflictOverride: false,
  });
  assert.ok(shaped.shapedIntent.tone.includes("soft"));
  assert.ok(shaped.shapedIntent.colors.includes("pink"));
  assert.ok(shaped.avoidRegions.includes("button"));
  assert.ok(shaped.shapingReasons.includes("avoid_recent_user_edit_conflict"));
});
