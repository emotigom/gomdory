import type { DecorateIntentSummary } from "@/lib/edu/lesson/decorateIntentRouter";
import type { SlotMapSummary } from "@/lib/edu/lesson/slotMap";
import type { DecoratePlanShaping } from "@/lib/edu/lesson/decoratePlanShaper";

export type DecorateServerPayload = {
  prompt: string;
  snapshotVersion: string;
  slotFingerprint?: string;
  slotHints?: SlotMapSummary;
  changedNodesCount: number;
  intentSummary?: DecorateIntentSummary;
  intentCompact?: {
    primaryIntent: DecorateIntentSummary["primaryIntent"];
    confidence: number;
    ambiguous: boolean;
    colors: string[];
    tone: string[];
    emphasis: string[];
    imageTargets: string[];
    rewriteTargets: string[];
    majorStyleHints: string[];
  };
  previewQualityHints?: {
    lowImpactRisk: boolean;
    priorQualityScore: number | null;
  };
  shapedContext?: {
    primaryIntent: DecorateIntentSummary["primaryIntent"];
    secondaryIntents: DecorateIntentSummary["secondaryIntents"];
    targetBias: string[];
    avoidRegions: string[];
    recommendedStrength: DecoratePlanShaping["recommendedStrength"];
    stabilityPreference: DecoratePlanShaping["stabilityPreference"];
    historyConfidence: number;
  };
  safeConstraints: {
    doNotModifyTemplateBase: boolean;
    deterministicSafeApplyPreferred: boolean;
    previewFirst: boolean;
  };
};

export const buildDecorateServerPayload = (input: {
  prompt: string;
  snapshotVersion: string;
  slotFingerprint?: string;
  slotHints?: SlotMapSummary;
  changedNodesCount?: number;
  intentSummary?: DecorateIntentSummary;
  shapedPlan?: DecoratePlanShaping;
  historyConfidence?: number;
  priorQualityScore?: number | null;
  lowImpactRisk?: boolean;
}): { payload: DecorateServerPayload; includedHintKinds: string[] } => {
  const includedHintKinds: string[] = [];
  if (input.intentSummary) includedHintKinds.push("intent_compact");
  if (typeof input.priorQualityScore === "number" || input.lowImpactRisk) includedHintKinds.push("preview_quality_hints");
  if (input.shapedPlan) includedHintKinds.push("shaped_context");
  includedHintKinds.push("safe_constraints");

  return {
    payload: {
      prompt: input.prompt,
      snapshotVersion: input.snapshotVersion,
      slotFingerprint: input.slotFingerprint,
      slotHints: input.slotHints,
      changedNodesCount: Math.max(0, input.changedNodesCount ?? 0),
      intentSummary: input.intentSummary,
      intentCompact: input.intentSummary
        ? {
            primaryIntent: input.intentSummary.primaryIntent,
            confidence: input.intentSummary.confidence,
            ambiguous: input.intentSummary.isAmbiguous,
            colors: input.intentSummary.colors.slice(0, 4),
            tone: input.intentSummary.tone.slice(0, 4),
            emphasis: input.intentSummary.emphasisTargets.slice(0, 4),
            imageTargets: input.intentSummary.imageTargets.slice(0, 4),
            rewriteTargets: input.intentSummary.rewriteTargets.slice(0, 4),
            majorStyleHints: [
              input.intentSummary.colors.length > 0 ? "background_or_accent_color" : null,
              input.intentSummary.emphasisTargets.length > 0 ? "button_or_headline_emphasis" : null,
              input.intentSummary.imageTargets.length > 0 ? "image_slot_change" : null,
              input.intentSummary.tone.length > 0 ? "tone_cleanup" : null,
            ].filter((value): value is string => Boolean(value)).slice(0, 2),
          }
        : undefined,
      previewQualityHints:
        typeof input.priorQualityScore === "number" || input.lowImpactRisk
          ? { lowImpactRisk: Boolean(input.lowImpactRisk), priorQualityScore: input.priorQualityScore ?? null }
          : undefined,
      shapedContext: input.shapedPlan
        ? {
            primaryIntent: input.shapedPlan.shapedIntent.primaryIntent,
            secondaryIntents: input.shapedPlan.shapedIntent.secondaryIntents.slice(0, 3),
            targetBias: input.shapedPlan.targetBias.slice(0, 4),
            avoidRegions: input.shapedPlan.avoidRegions.slice(0, 4),
            recommendedStrength: input.shapedPlan.recommendedStrength,
            stabilityPreference: input.shapedPlan.stabilityPreference,
            historyConfidence: Number((input.historyConfidence ?? 0).toFixed(2)),
          }
        : undefined,
      safeConstraints: {
        doNotModifyTemplateBase: true,
        deterministicSafeApplyPreferred: true,
        previewFirst: true,
      },
    },
    includedHintKinds,
  };
};
