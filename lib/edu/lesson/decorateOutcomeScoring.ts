export type DecorateOutcomeBucket = "excellent" | "good" | "acceptable" | "weak" | "failed";
export type DecorateOutcomeFollowup = "none" | "tune_intent_rules" | "tune_server_prompt" | "tune_fallback_rules" | "tune_apply_guard";

export type DecorateOutcomeScoreInput = {
  previewQuality: number;
  lowImpactPreview: boolean;
  usedFallback: boolean;
  usedEnrich: boolean;
  applySucceeded: boolean;
  applyBlocked: boolean;
  consistencyClass: "consistent" | "recovered" | "mismatch" | "blocked";
  staleRisk: "low" | "medium" | "high";
  undoFailed?: boolean;
};

export type DecorateOutcomeScore = {
  score: number;
  bucket: DecorateOutcomeBucket;
  factors: {
    previewQuality: number;
    lowImpactPenalty: number;
    fallbackPenalty: number;
    enrichBonus: number;
    applySuccessBonus: number;
    consistencyPenalty: number;
    stalePenalty: number;
    undoPenalty: number;
  };
  recommendedFollowup: DecorateOutcomeFollowup;
};

export const scoreDecorateOutcome = (input: DecorateOutcomeScoreInput): DecorateOutcomeScore => {
  const previewQuality = Math.max(0, Math.min(1, input.previewQuality));
  const lowImpactPenalty = input.lowImpactPreview ? 16 : 0;
  const fallbackPenalty = input.usedFallback ? 8 : 0;
  const enrichBonus = input.usedEnrich ? 6 : 0;
  const applySuccessBonus = input.applySucceeded ? 18 : 0;
  const consistencyPenalty = input.consistencyClass === "blocked" ? 30 : input.consistencyClass === "mismatch" ? 18 : input.consistencyClass === "recovered" ? 8 : 0;
  const stalePenalty = input.staleRisk === "high" ? 18 : input.staleRisk === "medium" ? 8 : 0;
  const undoPenalty = input.undoFailed ? 8 : 0;

  const rawScore = 40 + previewQuality * 42 + enrichBonus + applySuccessBonus - lowImpactPenalty - fallbackPenalty - consistencyPenalty - stalePenalty - undoPenalty;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const bucket: DecorateOutcomeBucket =
    input.applyBlocked || score < 30 ? "failed" : score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "acceptable" : "weak";

  let recommendedFollowup: DecorateOutcomeFollowup = "none";
  if (input.applyBlocked || input.consistencyClass === "blocked") recommendedFollowup = "tune_apply_guard";
  else if (input.usedFallback && bucket !== "good" && bucket !== "excellent") recommendedFollowup = "tune_server_prompt";
  else if (input.lowImpactPreview && !input.usedEnrich) recommendedFollowup = "tune_fallback_rules";
  else if (input.consistencyClass === "mismatch") recommendedFollowup = "tune_intent_rules";

  return {
    score,
    bucket,
    factors: { previewQuality, lowImpactPenalty, fallbackPenalty, enrichBonus, applySuccessBonus, consistencyPenalty, stalePenalty, undoPenalty },
    recommendedFollowup,
  };
};
