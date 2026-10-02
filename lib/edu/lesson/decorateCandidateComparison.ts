import type { DecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";
import type { DecorateIntentSummary } from "@/lib/edu/lesson/decorateIntentRouter";
import { validateDecoratePlan } from "@/lib/edu/lesson/decoratePlanValidation";
import { evaluateDecorateIntentMatch, isBackgroundStyleIntent, type DecorateStyleIntent } from "@/lib/edu/lesson/decorateStyleIntent";
import { evaluateSemanticDecorateCoherence } from "@/lib/edu/lesson/decorateSemanticCoherence";
import type { DecorateSemanticSectionsResult } from "@/lib/edu/lesson/decorateSemanticSections";

type Source = "server_llm" | "local_llm" | "deterministic";

const STYLE_OPS = new Set(["set_surface_background", "set_surface_tone", "set_text_style", "set_text_emphasis", "set_accent_style", "set_button_style", "set_card_style", "set_section_style"]);

export const computeCandidateScore = (input: {
  plan: DecoratePlanV1;
  source: Source;
  intent: DecorateIntentSummary;
  styleIntent?: DecorateStyleIntent;
  lowImpactHint?: boolean;
  semantic?: Pick<DecorateSemanticSectionsResult, "semanticSections" | "hasHero" | "hasCTA" | "hasCards">;
}) => {
  const validation = validateDecoratePlan({ plan: input.plan, source: input.source, intent: input.intent, styleIntent: input.styleIntent });
  const intentMatch = evaluateDecorateIntentMatch({ styleIntent: input.styleIntent ?? "none", plan: input.plan });
  const isBg = isBackgroundStyleIntent(input.styleIntent ?? "none");
  const opKinds = input.plan.ops.map((op) => op.op);

  const styleIntentMatchScore = intentMatch.intentMatched ? 100 : 28;
  const surfaceCoverageScore = opKinds.some((kind) => ["set_surface_background", "set_surface_tone", "set_section_style"].includes(kind)) ? 16 : 0;
  const accentCoverageScore = opKinds.some((kind) => ["set_button_style", "set_accent_style"].includes(kind)) ? 12 : 0;
  const typographyCoverageScore = opKinds.some((kind) => ["set_text_style", "set_text_emphasis", "emphasize_heading"].includes(kind)) ? 12 : 0;
  const styleOpsCount = opKinds.filter((kind) => STYLE_OPS.has(kind)).length;
  const htmlMutationCount = opKinds.filter((kind) => ["add_callout_box", "add_caption", "insert_media"].includes(kind)).length;
  const contrastSafetyScore = opKinds.some((kind) => kind === "set_text_style" || kind === "set_surface_background" || kind === "set_button_style") ? 92 : 74;
  const htmlMutationPenalty = isBg && intentMatch.htmlOnlyMutation ? 20 : htmlMutationCount > styleOpsCount ? 10 : 0;
  const overMutationPenalty = input.plan.ops.length > 6 ? (input.plan.ops.length - 6) * 3 : 0;
  const targetCoverageScore = Math.min(100, surfaceCoverageScore + accentCoverageScore + typographyCoverageScore + (styleIntentMatchScore >= 100 ? 12 : 0));
  const legibilityScore = Math.max(40, contrastSafetyScore - Math.round(overMutationPenalty / 2));
  const styleCoherenceScore = Math.max(30, 92 - Math.max(0, styleOpsCount - 4) * 8);
  const emphasisPrecisionScore = Math.max(30, 90 - Math.max(0, htmlMutationCount - 1) * 12);
  const saturationPenalty = opKinds.filter((kind) => ["set_accent_style", "set_button_style"].includes(kind)).length > 2 ? 8 : 0;
  const noisyCompositionPenalty = styleOpsCount > 5 ? (styleOpsCount - 5) * 5 : 0;
  const semantic = input.semantic ? evaluateSemanticDecorateCoherence({ plan: input.plan, styleIntent: input.styleIntent ?? "none", semantic: input.semantic }) : null;
  const semanticCoherenceScore = semantic ? Math.round(semantic.score * 100) : 60;
  const semanticPenalty = semantic ? semantic.penalties.length * 4 : 0;

  let score = validation.isSemanticallyUseful ? 72 : validation.repairable ? 55 : 35;
  if (input.source === "server_llm") score += 6;
  if (input.source === "deterministic") score -= 4;
  if (input.lowImpactHint) score -= 12;
  if (input.intent.imageTargets.length > 0 && input.plan.ops.some((op) => op.op === "insert_media")) score += 8;
  score += surfaceCoverageScore + accentCoverageScore + typographyCoverageScore;
  score += styleIntentMatchScore >= 100 ? 8 : -10;
  score -= htmlMutationPenalty + overMutationPenalty + saturationPenalty + noisyCompositionPenalty + semanticPenalty;

  return {
    score: Math.max(0, Math.min(100, score)),
    styleIntentMatchScore,
    surfaceCoverageScore,
    accentCoverageScore,
    typographyCoverageScore,
    contrastSafetyScore,
    htmlMutationPenalty,
    overMutationPenalty,
    targetCoverageScore,
    legibilityScore,
    styleCoherenceScore,
    emphasisPrecisionScore,
    saturationPenalty,
    noisyCompositionPenalty,
    semanticCoherenceScore,
  };
};

export const compareDecorateCandidates = (input: {
  intent: DecorateIntentSummary;
  styleIntent?: DecorateStyleIntent;
  serverPlan?: DecoratePlanV1 | null;
  fallbackPlan: DecoratePlanV1;
  serverLowImpactHint?: boolean;
  semantic?: Pick<DecorateSemanticSectionsResult, "semanticSections" | "hasHero" | "hasCTA" | "hasCards">;
}): {
  chosenSource: Source;
  reason: string;
  serverScore: number;
  fallbackScore: number;
  shouldEnrich: boolean;
  styleIntentMatchScore: number;
  surfaceCoverageScore: number;
  accentCoverageScore: number;
  contrastSafetyScore: number;
  htmlMutationPenalty: number;
  overMutationPenalty: number;
  targetCoverageScore: number;
  legibilityScore: number;
  styleCoherenceScore: number;
  emphasisPrecisionScore: number;
  saturationPenalty: number;
  noisyCompositionPenalty: number;
  semanticCoherenceScore: number;
} => {
  const fallback = computeCandidateScore({ plan: input.fallbackPlan, source: "deterministic", intent: input.intent, styleIntent: input.styleIntent, semantic: input.semantic });
  if (!input.serverPlan) {
    return {
      chosenSource: "deterministic",
      reason: "server_missing",
      serverScore: 0,
      fallbackScore: fallback.score,
      shouldEnrich: false,
      styleIntentMatchScore: fallback.styleIntentMatchScore,
      surfaceCoverageScore: fallback.surfaceCoverageScore,
      accentCoverageScore: fallback.accentCoverageScore,
      contrastSafetyScore: fallback.contrastSafetyScore,
      htmlMutationPenalty: fallback.htmlMutationPenalty,
      overMutationPenalty: fallback.overMutationPenalty,
      targetCoverageScore: fallback.targetCoverageScore,
      legibilityScore: fallback.legibilityScore,
      styleCoherenceScore: fallback.styleCoherenceScore,
      emphasisPrecisionScore: fallback.emphasisPrecisionScore,
      saturationPenalty: fallback.saturationPenalty,
      noisyCompositionPenalty: fallback.noisyCompositionPenalty,
      semanticCoherenceScore: fallback.semanticCoherenceScore,
    };
  }
  const serverValidation = validateDecoratePlan({ plan: input.serverPlan, source: "server_llm", intent: input.intent, styleIntent: input.styleIntent });
  const server = computeCandidateScore({ plan: input.serverPlan, source: "server_llm", intent: input.intent, styleIntent: input.styleIntent, lowImpactHint: input.serverLowImpactHint, semantic: input.semantic });
  const fallbackResult = {
    chosenSource: "deterministic" as const,
    serverScore: server.score,
    fallbackScore: fallback.score,
    shouldEnrich: false,
    styleIntentMatchScore: fallback.styleIntentMatchScore,
    surfaceCoverageScore: fallback.surfaceCoverageScore,
    accentCoverageScore: fallback.accentCoverageScore,
    contrastSafetyScore: fallback.contrastSafetyScore,
    htmlMutationPenalty: fallback.htmlMutationPenalty,
    overMutationPenalty: fallback.overMutationPenalty,
    targetCoverageScore: fallback.targetCoverageScore,
    legibilityScore: fallback.legibilityScore,
    styleCoherenceScore: fallback.styleCoherenceScore,
    emphasisPrecisionScore: fallback.emphasisPrecisionScore,
    saturationPenalty: fallback.saturationPenalty,
    noisyCompositionPenalty: fallback.noisyCompositionPenalty,
    semanticCoherenceScore: fallback.semanticCoherenceScore,
  };
  if (serverValidation.recommendedAction === "reject") return { ...fallbackResult, reason: "server_rejected" };
  if (server.score + 5 < fallback.score) return { ...fallbackResult, reason: "fallback_higher_quality" };
  return {
    chosenSource: "server_llm",
    reason: serverValidation.recommendedAction === "accept_and_enrich" ? "server_repairable_enrich" : "server_preferred",
    serverScore: server.score,
    fallbackScore: fallback.score,
    shouldEnrich: serverValidation.recommendedAction === "accept_and_enrich",
    styleIntentMatchScore: server.styleIntentMatchScore,
    surfaceCoverageScore: server.surfaceCoverageScore,
    accentCoverageScore: server.accentCoverageScore,
    contrastSafetyScore: server.contrastSafetyScore,
    htmlMutationPenalty: server.htmlMutationPenalty,
    overMutationPenalty: server.overMutationPenalty,
    targetCoverageScore: server.targetCoverageScore,
    legibilityScore: server.legibilityScore,
    styleCoherenceScore: server.styleCoherenceScore,
    emphasisPrecisionScore: server.emphasisPrecisionScore,
    saturationPenalty: server.saturationPenalty,
    noisyCompositionPenalty: server.noisyCompositionPenalty,
    semanticCoherenceScore: server.semanticCoherenceScore,
  };
};
