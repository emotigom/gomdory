import type { DecorateIntentSummary } from "@/lib/edu/lesson/decorateIntentRouter";

export type DecoratePromptClass = "color_only" | "tone_only" | "emphasis_only" | "image_only" | "mixed" | "vague";

export const classifyDecoratePromptClass = (intent: DecorateIntentSummary): DecoratePromptClass => {
  const active = [intent.colors.length > 0, intent.tone.length > 0, intent.emphasisTargets.length > 0, intent.imageTargets.length > 0].filter(Boolean).length;
  if (intent.isAmbiguous || active === 0) return "vague";
  if (active >= 2) return "mixed";
  if (intent.colors.length > 0) return "color_only";
  if (intent.tone.length > 0) return "tone_only";
  if (intent.emphasisTargets.length > 0) return "emphasis_only";
  return "image_only";
};

export const bucketConfidence = (confidence: number) => {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.55) return "medium";
  return "low";
};

export const bucketQuality = (qualityScore: number) => {
  if (qualityScore >= 0.75) return "high";
  if (qualityScore >= 0.45) return "medium";
  return "low";
};

export const recommendDecorateTuningBucket = (input: {
  promptClass: DecoratePromptClass;
  qualityScore: number;
  applyBlocked: boolean;
  lowImpactPreview: boolean;
}) => {
  if (input.applyBlocked) return "apply_guard_tuning";
  if (input.lowImpactPreview || input.qualityScore < 0.4) return "reduce_noop";
  if (input.promptClass === "color_only") return "improve_color_intent";
  if (input.promptClass === "tone_only") return "improve_tone_mapping";
  if (input.promptClass === "emphasis_only") return "improve_emphasis_rules";
  if (input.promptClass === "image_only") return "improve_image_slot_detection";
  return "reduce_latency";
};

export const buildDecorateDebugSummary = (input: {
  requestId: string;
  promptLen: number;
  promptHash: string;
  intent: Pick<DecorateIntentSummary, "primaryIntent" | "confidence" | "isAmbiguous">;
  source: string | null;
  fallbackReason: string | null;
  qualityScore: number | null;
  lowImpact: boolean;
  enriched: boolean;
  decision: string | null;
  pending: boolean;
  baseSnapshotVersion: string | null;
  baseHtmlHash: string | null;
}) => ({
  requestId: input.requestId,
  promptLen: input.promptLen,
  promptHash: input.promptHash,
  primaryIntent: input.intent.primaryIntent,
  confidence: input.intent.confidence,
  ambiguous: input.intent.isAmbiguous,
  source: input.source,
  fallbackReason: input.fallbackReason,
  qualityScore: input.qualityScore,
  lowImpact: input.lowImpact,
  enriched: input.enriched,
  decision: input.decision,
  pendingState: input.pending ? "pending_preview" : "none",
  snapshot: input.baseSnapshotVersion ? input.baseSnapshotVersion.slice(0, 18) : null,
  htmlHash: input.baseHtmlHash ? input.baseHtmlHash.slice(0, 8) : null,
});

export const buildDecorateTuningSignal = (input: {
  requestId: string;
  intent: DecorateIntentSummary;
  source: string;
  qualityScore: number;
  lowImpactPreview: boolean;
  usedFallback: boolean;
  usedAutoEnrich: boolean;
  usedRecoveryDecision: boolean;
  applySucceeded: boolean;
  applyBlocked: boolean;
  blockedReason: string | null;
  invalidationReason: string | null;
}) => {
  const promptClass = classifyDecoratePromptClass(input.intent);
  return {
    requestId: input.requestId,
    primaryIntent: input.intent.primaryIntent,
    confidenceBucket: bucketConfidence(input.intent.confidence),
    ambiguous: input.intent.isAmbiguous,
    source: input.source,
    qualityBucket: bucketQuality(input.qualityScore),
    usedFallback: input.usedFallback,
    usedAutoEnrich: input.usedAutoEnrich,
    usedRecoveryDecision: input.usedRecoveryDecision,
    applySucceeded: input.applySucceeded,
    applyBlocked: input.applyBlocked,
    blockedReason: input.blockedReason,
    invalidationReason: input.invalidationReason,
    nearNoOp: input.lowImpactPreview,
    promptClass,
    recommendedTuningBucket: recommendDecorateTuningBucket({
      promptClass,
      qualityScore: input.qualityScore,
      applyBlocked: input.applyBlocked,
      lowImpactPreview: input.lowImpactPreview,
    }),
  };
};
