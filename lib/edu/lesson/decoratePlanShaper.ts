import type { DecorateIntentSummary } from "@/lib/edu/lesson/decorateIntentRouter";
import type { DecorateHistoryContext } from "@/lib/edu/lesson/decorateHistoryContext";

export type DecoratePageSignals = {
  recentUserEditRegionKinds?: string[];
  imageSlotsAvailable?: number;
};

export type DecoratePlanShaping = {
  shapedIntent: DecorateIntentSummary;
  targetBias: string[];
  avoidRegions: string[];
  recommendedStrength: "subtle" | "balanced" | "strong";
  stabilityPreference: "high" | "medium" | "low";
  shapingReasons: string[];
};

const unique = (values: string[]) => [...new Set(values)];

export const shapeDecoratePlan = (input: {
  intent: DecorateIntentSummary;
  history?: DecorateHistoryContext | null;
  pageSignals?: DecoratePageSignals;
  allowUserEditConflictOverride?: boolean;
}): DecoratePlanShaping => {
  const history = input.history;
  const reasons: string[] = [];
  const targetBias: string[] = [];
  const avoidRegions = unique([...(history?.avoidRegionKinds ?? []), ...(input.pageSignals?.recentUserEditRegionKinds ?? [])]);

  let shapedIntent: DecorateIntentSummary = { ...input.intent };
  if (history && history.historyConfidence >= 0.4) {
    if (history.recentToneBias.length > 0 && shapedIntent.tone.length === 0) {
      shapedIntent = { ...shapedIntent, tone: history.recentToneBias.slice(0, 2) };
      reasons.push("carry_recent_tone_bias");
      targetBias.push("tone_continuity");
    }
    if (history.recentColorBias.length > 0 && shapedIntent.colors.length === 0) {
      shapedIntent = { ...shapedIntent, colors: history.recentColorBias.slice(0, 2) };
      reasons.push("carry_recent_color_bias");
      targetBias.push("color_continuity");
    }
    if (history.recentEmphasisBias.length > 0 && shapedIntent.emphasisTargets.length === 0) {
      shapedIntent = { ...shapedIntent, emphasisTargets: history.recentEmphasisBias.slice(0, 2) };
      reasons.push("carry_recent_emphasis_bias");
    }
    if (history.preferStableTargets) {
      reasons.push("prefer_stable_targets");
      targetBias.push("stable_targets");
    }
  }

  if (history?.avoidConflictWithRecentUserEdit && !input.allowUserEditConflictOverride && avoidRegions.length > 0) {
    reasons.push("avoid_recent_user_edit_conflict");
    targetBias.push("avoid_recent_user_edit_regions");
  }

  if ((input.pageSignals?.imageSlotsAvailable ?? 0) > 0 && shapedIntent.primaryIntent === "image_replace") {
    reasons.push("image_slot_grounding_boost");
    targetBias.push("image_grounding");
  }

  const recommendedStrength: DecoratePlanShaping["recommendedStrength"] = history?.avoidRepeatingWeakChanges
    ? "strong"
    : history?.avoidConflictWithRecentUserEdit
      ? "subtle"
      : "balanced";

  const stabilityPreference: DecoratePlanShaping["stabilityPreference"] = history?.preferStableTargets
    ? "high"
    : history?.historyConfidence && history.historyConfidence >= 0.55
      ? "medium"
      : "low";

  return {
    shapedIntent,
    targetBias: unique(targetBias),
    avoidRegions,
    recommendedStrength,
    stabilityPreference,
    shapingReasons: unique(reasons),
  };
};
