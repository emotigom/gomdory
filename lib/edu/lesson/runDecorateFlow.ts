import { type DecoratePlanV1, validateDecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";
import { executeDecoratePlan } from "@/lib/edu/lesson/executeDecoratePlan";
import {
  generateDecoratePlanJson,
  withDecorateGenerateJsonContext,
} from "@/lib/edu/lesson/internal/decorateGenerateJson";
import { buildSlotMap, summarizeSlotMap, type SlotMap } from "@/lib/edu/lesson/slotMap";
import {
  endStage,
  setMetric,
  startStage,
  type DecorateMetrics,
} from "@/lib/edu/lesson/decoratePipeline";
import { resolveSlotsFromHtmlV2, type SlotResolutionV2 } from "@/lib/edu/lesson/slotResolverV2";
import type { SlotCandidate } from "@/lib/edu/lesson/slotResolverV2";
import type { LocalChatMessage, WebLLMWorkerResponse } from "@/lib/edu/llm/webllmWorkerTypes";
import { extractDeterministicFallbackIntent } from "@/lib/edu/lesson/decorateGuards";
import { routeDecorateIntent, type DecorateIntentSummary } from "@/lib/edu/lesson/decorateIntentRouter";
import {
  classifyDecorateStyleIntent,
  evaluateDecorateIntentMatch,
  isBackgroundStyleIntent,
  shouldAllowHtmlMutationForDecorateIntent,
  shouldUseSlotResolverForDecorateIntent,
  type DecorateStyleIntent,
} from "@/lib/edu/lesson/decorateStyleIntent";
import { resolveDecorateSurfaceTarget } from "@/lib/edu/lesson/decorateSurfaceTarget";
import { buildDecorateStyleComposition } from "@/lib/edu/lesson/decorateStyleComposition";
import { detectDecorateSemanticSections } from "@/lib/edu/lesson/decorateSemanticSections";
import { evaluateSemanticDecorateCoherence } from "@/lib/edu/lesson/decorateSemanticCoherence";
import { evaluateDecorateContrastGuard } from "@/lib/edu/lesson/decorateContrastGuard";
import { normalizeDecorateStyleProfile } from "@/lib/edu/lesson/decorateStyleProfile";
import { resolveDecorateStyleTargets } from "@/lib/edu/lesson/decorateStyleTargets";
import { evaluateComposedStyleIntentMatch } from "@/lib/edu/lesson/decorateComposedIntentMatch";
import { validateDecoratePlan } from "@/lib/edu/lesson/decoratePlanValidation";
import { compareDecorateCandidates } from "@/lib/edu/lesson/decorateCandidateComparison";
import { shapeDecoratePlan, type DecoratePlanShaping } from "@/lib/edu/lesson/decoratePlanShaper";
import type { DecorateHistoryContext } from "@/lib/edu/lesson/decorateHistoryContext";
import { decideDecorateDegradedMode, type DecorateDegradedDecision } from "@/lib/edu/lesson/decorateDegradedMode";
import { interpretStudentDecoratePrompt, buildStudentPreviewSummary } from "@/lib/edu/lesson/studentDecorateUi";

const hashHtml = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const AUTO_SLOT_HTML =
  '<section class="edu-auto-slot" data-edu-slot="1" data-slot-id="edu_auto_1" data-slot-type="image"><img alt="" src="" /></section>';

const IMAGE_PROMPT_REGEX = /(사진|이미지|img|image|photo|picture|고양이\s*사진|cat\s*photo|고양이|cat)/i;
type GuardrailReason = "slot_not_found" | "json_unrecoverable" | "engine";
type DecorateMode = "llm" | "deterministic";
type DecoratePlanSource = "server_llm" | "local_llm" | "deterministic";

type AbortReason = "timeout" | "user_cancel" | "navigation";

type AbortMeta = {
  abortReason: AbortReason;
  phase: string;
  startedAt: number;
  elapsedMs: number;
  timeoutMs: number | null;
  usingLocalWebLLM: boolean;
  modelId: string | null;
  stage: string;
  retryCount: number;
  slotCandidatesCount: number | null;
  selectedSlotId: string | null;
  selectedSelector: string | null;
  slotResolveSource: string | null;
  snapshotVersion: string | null;
  htmlHashBefore: string | null;
  htmlHashAfterInjection: string | null;
  committedHtmlHash: string | null;
  commitTargetKey: string | null;
  previewRefreshTriggered: boolean | null;
  previewHtmlHash: string | null;
  previewMatchesCommitted: boolean | null;
};

const inferTargetSlotType = (userPrompt: string): "image" | "text" => {
  if (IMAGE_PROMPT_REGEX.test(userPrompt)) return "image";
  return "text";
};

const prioritizeCandidatesByTarget = (
  resolved: SlotResolutionV2,
  targetSlotType: "image" | "text",
): SlotResolutionV2 => {
  const sorted = [...resolved.candidates].sort((a, b) => {
    const aPreferred = a.type === targetSlotType ? 0 : 1;
    const bPreferred = b.type === targetSlotType ? 0 : 1;
    if (aPreferred !== bPreferred) return aPreferred - bPreferred;
    return 0;
  });
  const selected = sorted[0] ?? null;
  return { ...resolved, candidates: sorted, selected };
};

const injectDefaultSlotIntoStudentHtml = (html: string) => {
  if (/class=["'][^"']*edu-auto-slot[^"']*["'][^>]*data-slot-id=["']edu_auto_1["']/i.test(html)) {
    return { html, injected: false };
  }
  if (html.includes("</main>")) {
    return { html: html.replace(/<\/main>/i, `${AUTO_SLOT_HTML}</main>`), injected: true };
  }
  if (html.includes("</body>")) {
    return { html: html.replace(/<\/body>/i, `${AUTO_SLOT_HTML}</body>`), injected: true };
  }
  return { html: `${html}${AUTO_SLOT_HTML}`, injected: true };
};

const toAbortError = (params: {
  phase: string;
  metrics: DecorateMetrics;
  timeoutMs: number;
  modelId?: string;
  abortReason?: AbortReason;
  error?: unknown;
}): never => {
  const { phase, metrics, timeoutMs, modelId, abortReason, error } = params;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const isTimeout = message.includes("timeout");
  const meta: AbortMeta = {
    abortReason: abortReason ?? (isTimeout ? "timeout" : "navigation"),
    phase,
    startedAt: metrics.startedAt,
    elapsedMs: Math.max(0, Date.now() - metrics.startedAt),
    timeoutMs,
    usingLocalWebLLM: true,
    modelId: modelId ?? null,
    stage: metrics.stage,
    retryCount: metrics.retryCount,
    slotCandidatesCount: metrics.slotCandidatesCount,
    selectedSlotId: metrics.selectedSlotId,
    selectedSelector: metrics.selectedSelector,
    slotResolveSource: metrics.slotResolveSource,
    snapshotVersion: metrics.snapshotVersion,
    htmlHashBefore: metrics.htmlHashBefore,
    htmlHashAfterInjection: metrics.htmlHashAfterInjection,
    committedHtmlHash: metrics.committedHtmlHash,
    commitTargetKey: metrics.commitTargetKey,
    previewRefreshTriggered: metrics.previewRefreshTriggered,
    previewHtmlHash: metrics.previewHtmlHash,
    previewMatchesCommitted: metrics.previewMatchesCommitted,
  };
  throw new DOMException(JSON.stringify(meta), "AbortError");
};

const readAbortReason = (reason: unknown): AbortReason => {
  if (!reason || typeof reason !== "object") return "navigation";
  const value = (reason as { abortReason?: unknown }).abortReason;
  if (value === "timeout" || value === "user_cancel" || value === "navigation") {
    return value;
  }
  return "navigation";
};

const buildDeterministicDecoratePlan = (
  prompt: string,
  routedIntent: DecorateIntentSummary | undefined,
  styleIntent: ReturnType<typeof classifyDecorateStyleIntent>,
  resolvedTargets: ReturnType<typeof resolveDecorateStyleTargets>["resolvedTargets"] = [],
  semantic?: ReturnType<typeof detectDecorateSemanticSections>,
): DecoratePlanV1 => {
  const routed = routedIntent ?? routeDecorateIntent(prompt);
  const profile = normalizeDecorateStyleProfile({ prompt, sourceIntent: styleIntent.primaryStyleIntent });
  const composed = buildDecorateStyleComposition({
    primaryStyleIntent: styleIntent.primaryStyleIntent,
    secondaryStyleIntents: styleIntent.secondaryStyleIntents,
    styleProfile: profile.profile,
    colorTokens: styleIntent.colorTokens,
    resolvedTargets,
    semantic,
  });
  const guarded = evaluateDecorateContrastGuard({ version: 1, summary: "style compose", ops: composed.ops });
  const ops: DecoratePlanV1["ops"] = guarded.adjustedOps.length > 0
    ? guarded.adjustedOps
    : [{ op: "set_section_style", target: { kind: "slot", slot: "section_any" }, style: { spacingToneHint: "balanced" } }];
  const profileLabel = profile.profile === "none" ? "기본" : profile.profile;
  const summary = `${profileLabel} 스타일 미리보기를 만들었어요.`;
  if (routed.imageTargets.length > 0 && !ops.some((op) => op.op === "insert_media")) {
    ops.push({ op: "insert_media", target: { kind: "slot", slot: "image_primary" }, media: { kind: "generic_placeholder" }, style: { prominence: "medium", caption: false } });
  }
  return { version: 1, summary, ops };
};

const buildDecorateSummaryFromActualOps = (plan: DecoratePlanV1, styleProfile: string = "none", semanticKinds: string[] = []) => {
  const opKinds = plan.ops.map((op) => op.op);
  const majorOpKinds = Array.from(new Set(opKinds)).slice(0, 2);
  const multiOp = majorOpKinds.length > 1;
  if (opKinds.includes("set_surface_background")) {
    const hasGradient = plan.ops.some((op) => op.op === "set_surface_background" && op.style.mode === "gradient");
    return {
      summary: hasGradient ? "배경 그라데이션과 텍스트 대비를 함께 조정했어요." : "배경 톤과 텍스트 대비를 함께 조정했어요.",
      majorOpKinds,
      summaryStyle: "background",
      multiOp,
    };
  }
  if (opKinds.includes("set_button_style") && opKinds.includes("set_accent_style")) {
    if (semanticKinds.includes("cta") || semanticKinds.includes("footer_cta")) {
      return {
        summary: "버튼 영역이 더 눈에 띄도록 다듬었어요.",
        majorOpKinds,
        summaryStyle: "semantic_cta",
        multiOp,
      };
    }
    return {
      summary: "버튼이 더 눈에 띄도록 강조하고 대비를 다듬었어요.",
      majorOpKinds,
      summaryStyle: "cta_contrast",
      multiOp,
    };
  }
  if (styleProfile === "soft_playful") {
    if (semanticKinds.length > 0) {
      return {
        summary: "주요 영역 분위기를 더 부드럽고 자연스럽게 다듬었어요.",
        majorOpKinds,
        summaryStyle: "semantic_soft_profile",
        multiOp,
      };
    }
    return {
      summary: "전체 분위기를 더 부드럽게 다듬고 강조 요소를 살렸어요.",
      majorOpKinds,
      summaryStyle: "soft_playful",
      multiOp,
    };
  }
  if (opKinds.includes("set_section_style") && opKinds.includes("set_text_emphasis")) {
    if (semanticKinds.includes("hero")) {
      return {
        summary: "첫 화면 분위기를 정리하고 제목을 더 잘 보이게 했어요.",
        majorOpKinds,
        summaryStyle: "semantic_hero_headline",
        multiOp,
      };
    }
    return {
      summary: "섹션 톤을 정리하고 제목을 더 잘 보이게 했어요.",
      majorOpKinds,
      summaryStyle: "section_headline",
      multiOp,
    };
  }
  if (styleProfile === "luxury_minimal" || styleProfile === "clean_modern") {
    return {
      summary: "전체 톤을 더 정돈되고 세련되게 다듬었어요.",
      majorOpKinds,
      summaryStyle: "luxury_clean",
      multiOp,
    };
  }
  if (opKinds.includes("set_card_style")) {
    if (semanticKinds.includes("card_grid") || semanticKinds.includes("feature_list")) {
      return {
        summary: "카드 영역 분위기를 더 부드럽게 다듬었어요.",
        majorOpKinds,
        summaryStyle: "semantic_card_tone",
        multiOp,
      };
    }
    return {
      summary: "카드 톤을 더 부드럽게 다듬었어요.",
      majorOpKinds,
      summaryStyle: "card_tone",
      multiOp,
    };
  }
  if (opKinds.includes("set_text_emphasis") || opKinds.includes("set_text_style")) {
    return {
      summary: "제목과 텍스트 강조를 조정했어요.",
      majorOpKinds,
      summaryStyle: "headline",
      multiOp,
    };
  }
  return { summary: plan.summary, majorOpKinds, summaryStyle: "plain", multiOp };
};


export type RunDecorateFlowResult =
  | {
      ok: true;
      nextHtml: string;
      applyResult: {
        changed: boolean;
        matched: boolean;
        degradedExternalImage: boolean;
        appliedOps: number;
        changedNodes: Array<{
          selector: string;
          kind: "insert" | "update" | "style";
          summary: string;
          beforeSnippet: string;
          afterSnippet: string;
        }>;
        opResults: Array<{ opId: string; applied: boolean; degraded: boolean; targetResolvedTo: string }>;
      };
      plan: DecoratePlanV1;
      slot: SlotCandidate;
      slotMap: SlotMap;
      metrics: DecorateMetrics;
      resultReady: {
        summary: string;
        opsCount: number;
        selector: string;
        htmlSnippet: string;
      };
      mode: DecorateMode;
    }
  | { ok: false; reason: GuardrailReason; metrics: DecorateMetrics };

export async function runDecorateFlow(params: {
  requestId: string;
  userPrompt: string;
  timeoutMs: number;
  modelId?: string;
  metrics: DecorateMetrics;
  maxTokens: number;
  signal?: AbortSignal;
  getCommittedEditorHtmlSSOT: () => Promise<{ html: string; snapshotVersion: string | null }>;
  commitStudentHtml: (nextHtml: string) => Promise<void>;
  emitSlotResolve: (input: {
    snapshotVersion: string | null;
    resolved: SlotResolutionV2;
    htmlHashBefore: string;
    htmlHashAfterInjection: string | null;
  }) => void;
  emitCommitState: (input: {
    committedHtmlHash: string;
    commitTargetKey: "index.html";
    previewRefreshTriggered: boolean;
  }) => void;
  onGuardrail: (input: { reason: "slot_not_found"; source: string }) => void;
  emitResultReady?: (input: {
    mode: DecorateMode;
    summary: string;
    opsCount: number;
    selector: string;
    htmlSnippetLen: number;
  }) => void;
  emitPlanReady?: (input: { mode: DecorateMode; source?: DecoratePlanSource; opsCount: number; summary: string }) => void;
  emitPlanExecute?: (input: {
    appliedOps: number;
    changed: boolean;
    degraded: boolean;
    changedNodesCount: number;
    majorTargets: string[];
  }) => void;
  emitPlanSource?: (input: {
    source: DecoratePlanSource;
    stage?: "start" | "end";
    latencyMs: number;
    ok: boolean;
    status?: number;
    reason?: string;
  }) => void;
  emitPlanValidation?: (input: {
    source: DecoratePlanSource | "cache";
    schemaValid: boolean;
    semanticallyUseful: boolean;
    repairable: boolean;
    recommendedAction: "accept" | "accept_and_enrich" | "fallback" | "reject";
    issues: string[];
    intentMatched?: boolean;
    mismatchKinds?: string[];
  }) => void;
  emitCandidateComparison?: (input: {
    serverScore: number;
    fallbackScore: number;
    chosenSource: DecoratePlanSource;
    reason: string;
    intentMatchScore?: number;
    surfaceStyleScore?: number;
    htmlOnlyPenalty?: number;
    contrastSafetyScore?: number;
    accentCoverageScore?: number;
    overMutationPenalty?: number;
    targetCoverageScore?: number;
    legibilityScore?: number;
    styleCoherenceScore?: number;
    emphasisPrecisionScore?: number;
    saturationPenalty?: number;
    noisyCompositionPenalty?: number;
    semanticCoherenceScore?: number;
    chosenReason?: string;
  }) => void;
  emitFallbackIntentExtracted?: (input: {
    colors: string[];
    tone: string[];
    emphasis: string[];
    imageIntent: boolean;
    reducedCapability: boolean;
  }) => void;
  emitIntentRouted?: (input: DecorateIntentSummary) => void;
  emitStyleIntentClassified?: (input: { styleIntent: DecorateStyleIntent; primaryStyleIntent: DecorateStyleIntent; secondaryStyleIntents: DecorateStyleIntent[]; compositionHints: string[]; styleProfile: string; colorTokens: string[]; gradientRequested: boolean; backgroundRequested: boolean; confidence: number }) => void;
  emitStudentPromptInterpreted?: (input: { requestId: string; normalizedPromptClass: string; primaryIntent: string; styleIntent: string; confidence: number }) => void;
  emitStyleIntentComposed?: (input: { requestId: string; primaryStyleIntent: DecorateStyleIntent; secondaryStyleIntents: DecorateStyleIntent[]; compositionHints: string[]; confidence: number }) => void;
  emitStyleProfileNormalized?: (input: { requestId: string; profile: string; sourceIntent: string; confidence: number }) => void;
  emitStyleTargetsResolved?: (input: { requestId: string; targetKinds: string[]; resolvedCount: number; unresolvedKinds: string[]; confidences: number[]; semanticKindsUsed?: string[]; provenanceKinds?: string[]; semanticCoverageScore?: number }) => void;
  emitSemanticSectionsDetected?: (input: { requestId: string; sectionKinds: string[]; primarySectionKind: string | null; hasHero: boolean; hasCTA: boolean; hasCards: boolean; count: number }) => void;
  emitStructureGuidedCompositionBuilt?: (input: { requestId: string; semanticKindsUsed: string[]; opKinds: string[]; targetKinds: string[]; compositionStrategy: string }) => void;
  emitSemanticPartialTargetUsed?: (input: { requestId: string; requestedKinds: string[]; resolvedKinds: string[]; missingKinds: string[]; strategy: string }) => void;
  emitStyleProfileSemanticApplied?: (input: { requestId: string; profile: string; semanticKinds: string[]; majorTargets: string[] }) => void;
  emitSemanticCoherenceEvaluated?: (input: { requestId: string; score: number; matchedSemanticKinds: string[]; missingSemanticKinds: string[]; penalties: string[] }) => void;
  emitStyleCompositionBuilt?: (input: { requestId: string; opKinds: string[]; targetKinds: string[]; strength: string; styleProfile: string }) => void;
  emitStyleCompositionRefined?: (input: { requestId: string; originalOpCount: number; finalOpCount: number; droppedKinds: string[]; refinedReasons: string[] }) => void;
  emitContrastGuardEvaluated?: (input: { requestId: string; score: number; contrastWarnings: string[] }) => void;
  emitContrastGuardAdjusted?: (input: { requestId: string; adjustmentsApplied: string[] }) => void;
  emitLegibilityGuardWarning?: (input: { requestId: string; warnings: string[] }) => void;
  emitComposedIntentMatchEvaluated?: (input: { requestId: string; primaryStyleIntent: string; matchScore: number; matchKinds: string[]; missingKinds: string[]; penalties: string[] }) => void;
  emitStyleFallbackComposed?: (input: { requestId: string; profile: string; opKinds: string[]; targetKinds: string[] }) => void;
  emitSlotResolveBlocked?: (input: { styleIntent: DecorateStyleIntent; blockedResolver: string; reason: string }) => void;
  emitHtmlMutationBlocked?: (input: { styleIntent: DecorateStyleIntent; reason: string }) => void;
  emitBackgroundFallbackSelected?: (input: { targetKind: string; styleIntent: DecorateStyleIntent; colors: string[]; gradient: boolean; contrastAdjusted: boolean }) => void;
  emitSurfaceTargetResolved?: (input: { targetType: string; selector: string; confidence: number; reason: string }) => void;
  emitIntentMatchEvaluated?: (input: { primaryIntent: string; styleIntent: DecorateStyleIntent; intentMatched: boolean; mismatchKinds: string[]; surfaceStyleChanged: boolean; htmlOnlyMutation: boolean }) => void;
  emitSummaryBuilt?: (input: { opKinds: string[]; styleProfile?: string; summaryKind: string; intentMatched: boolean; majorOpKinds?: string[]; summaryStyle?: string; multiOp?: boolean; semanticKindsMentioned?: string[]; summaryAudienceStyle?: string; multiSection?: boolean }) => void;
  emitStudentPreviewSummaryBuilt?: (input: { requestId: string; summaryKind: string; majorTargets: string[]; intentMatched: boolean }) => void;
  emitStyleFallbackPartialTargetUsed?: (input: { requestId: string; foundKinds: string[]; unresolvedKinds: string[] }) => void;
  emitStyleFallbackRefined?: (input: { requestId: string; finalOpCount: number; refinedReasons: string[] }) => void;
  emitStyleFallbackDegradedTarget?: (input: { requestId: string; kind: string; degradedTo: string }) => void;
  emitHistoryContextBuilt?: (input: { hasRecentEdits: boolean; hasRecentDecorateApply: boolean; hasRecentUndo: boolean; historyConfidence: number; biasKinds: string[] }) => void;
  emitPlanShaped?: (input: { primaryIntent: string; shapingReasons: string[]; targetBiasKinds: string[]; avoidRegionKinds: string[]; recommendedStrength: string }) => void;
  historyContext?: DecorateHistoryContext | null;
  pageSignals?: { recentUserEditRegionKinds?: string[]; imageSlotsAvailable?: number };
  allowUserEditConflictOverride?: boolean;
  requestServerPlan?: (input: {
    prompt: string;
    snapshotVersion: string;
    slotFingerprint?: string;
    slotHints?: ReturnType<typeof summarizeSlotMap>;
    changedNodesCount: number;
    intentSummary?: DecorateIntentSummary;
    shapedPlan?: DecoratePlanShaping;
    historyConfidence?: number;
    signal?: AbortSignal;
  }) => Promise<
    | { ok: true; provider: "server_llm" | "cache" | "deterministic_safe"; plan: DecoratePlanV1 }
    | { ok: false; reason: string; status?: number }
  >;
  localPlanEnabled?: boolean;
  changedNodesHint?: number;
  startWebLLM: (
    requestId: string,
    input: {
      kind: "generateJson";
      messages: LocalChatMessage[];
      temperature: number;
      schema: Record<string, unknown>;
      timeoutMs: number;
      maxTokens: number;
      preferredModelId?: string;
      useResponseFormat: true;
      signal?: AbortSignal;
    },
  ) => Promise<WebLLMWorkerResponse>;
  decorateMode?: DecorateMode;
  degradedHint?: {
    kickoffDelayMs?: number | null;
    previewBuildDelayMs?: number | null;
    snapshotReady?: boolean;
    hashReady?: boolean;
    hydrationStable?: boolean;
    recentSlaBreach?: boolean;
    networkTimeoutSignal?: boolean;
  };
  emitDegradedMode?: (input: { mode: DecorateDegradedDecision["mode"]; reasons: string[] }) => void;
  reliabilityBudgetMs?: number;
  emitReliabilityBudget?: (input: { event: "decorate_reliability_budget_started" | "decorate_reliability_budget_exceeded" | "decorate_reliability_budget_downgraded"; elapsedMs: number; budgetMs: number }) => void;
}): Promise<RunDecorateFlowResult> {
  const startedAt = Date.now();
  const {
    requestId,
    userPrompt,
    timeoutMs,
    modelId,
    metrics,
    maxTokens,
    signal,
    getCommittedEditorHtmlSSOT,
    commitStudentHtml,
    emitSlotResolve,
    emitCommitState,
    onGuardrail,
    emitResultReady,
    emitPlanReady,
    emitPlanExecute,
    emitPlanSource,
    emitPlanValidation,
    emitCandidateComparison,
    emitFallbackIntentExtracted,
    emitIntentRouted,
    emitStyleIntentClassified,
    emitStudentPromptInterpreted,
    emitStyleIntentComposed,
    emitStyleProfileNormalized,
    emitStyleTargetsResolved,
    emitSemanticSectionsDetected,
    emitStructureGuidedCompositionBuilt,
    emitSemanticPartialTargetUsed,
    emitStyleProfileSemanticApplied,
    emitSemanticCoherenceEvaluated,
    emitStyleCompositionBuilt,
    emitStyleCompositionRefined,
    emitContrastGuardEvaluated,
    emitContrastGuardAdjusted,
    emitLegibilityGuardWarning,
    emitComposedIntentMatchEvaluated,
    emitStyleFallbackComposed,
    emitSlotResolveBlocked,
    emitHtmlMutationBlocked,
    emitBackgroundFallbackSelected,
    emitSurfaceTargetResolved,
    emitIntentMatchEvaluated,
    emitSummaryBuilt,
    emitStudentPreviewSummaryBuilt,
    emitStyleFallbackPartialTargetUsed,
    emitStyleFallbackRefined,
    emitStyleFallbackDegradedTarget,
    emitHistoryContextBuilt,
    emitPlanShaped,
    historyContext,
    pageSignals,
    allowUserEditConflictOverride = false,
    requestServerPlan,
    localPlanEnabled = true,
    changedNodesHint = 0,
    startWebLLM,
    decorateMode = "llm",
    degradedHint,
    emitDegradedMode,
    reliabilityBudgetMs = 220,
    emitReliabilityBudget,
  } = params;

  setMetric(metrics, "startedAt", startedAt);
  const reliabilityStartedAt = Date.now();
  emitReliabilityBudget?.({ event: "decorate_reliability_budget_started", elapsedMs: 0, budgetMs: reliabilityBudgetMs });
  const degradedDecision = decideDecorateDegradedMode({
    kickoffDelayMs: degradedHint?.kickoffDelayMs,
    previewBuildDelayMs: degradedHint?.previewBuildDelayMs,
    snapshotReady: degradedHint?.snapshotReady,
    hashReady: degradedHint?.hashReady,
    hydrationStable: degradedHint?.hydrationStable,
    recentSlaBreach: degradedHint?.recentSlaBreach,
    networkTimeoutSignal: degradedHint?.networkTimeoutSignal,
  });
  emitDegradedMode?.({ mode: degradedDecision.mode, reasons: degradedDecision.reasons });

  const routedIntent = routeDecorateIntent(userPrompt);
  emitIntentRouted?.(routedIntent);
  const styleIntent = classifyDecorateStyleIntent({ prompt: userPrompt, intent: routedIntent });
  const normalizedProfile = normalizeDecorateStyleProfile({ prompt: userPrompt, sourceIntent: styleIntent.primaryStyleIntent });
  const studentPromptInterpretation = interpretStudentDecoratePrompt({ prompt: userPrompt, intent: routedIntent, styleIntent: styleIntent.styleIntent });
  emitStudentPromptInterpreted?.({ requestId, ...studentPromptInterpretation });
  emitStyleIntentClassified?.(styleIntent);
  emitStyleIntentComposed?.({
    requestId,
    primaryStyleIntent: styleIntent.primaryStyleIntent,
    secondaryStyleIntents: styleIntent.secondaryStyleIntents,
    compositionHints: styleIntent.compositionHints,
    confidence: styleIntent.confidence,
  });
  emitStyleProfileNormalized?.({ requestId, profile: normalizedProfile.profile, sourceIntent: normalizedProfile.sourceIntent, confidence: normalizedProfile.confidence });
  const elapsedForBudget = () => Math.max(0, Date.now() - reliabilityStartedAt);
  const overBudget = () => elapsedForBudget() > reliabilityBudgetMs || degradedDecision.skipNonEssentialShaping;
  if (overBudget()) {
    emitReliabilityBudget?.({ event: "decorate_reliability_budget_exceeded", elapsedMs: elapsedForBudget(), budgetMs: reliabilityBudgetMs });
  }
  const shapedPlan = shapeDecoratePlan({
    intent: routedIntent,
    history: overBudget() ? undefined : historyContext ?? undefined,
    pageSignals,
    allowUserEditConflictOverride: overBudget() ? false : allowUserEditConflictOverride,
  });
  if (overBudget()) {
    emitReliabilityBudget?.({ event: "decorate_reliability_budget_downgraded", elapsedMs: elapsedForBudget(), budgetMs: reliabilityBudgetMs });
  }
  emitPlanShaped?.({
    primaryIntent: shapedPlan.shapedIntent.primaryIntent,
    shapingReasons: shapedPlan.shapingReasons,
    targetBiasKinds: shapedPlan.targetBias,
    avoidRegionKinds: shapedPlan.avoidRegions,
    recommendedStrength: shapedPlan.recommendedStrength,
  });
  emitHistoryContextBuilt?.({
    hasRecentEdits: Boolean(historyContext?.avoidConflictWithRecentUserEdit),
    hasRecentDecorateApply: Boolean(historyContext?.recentIntentBias?.length),
    hasRecentUndo: Boolean(!historyContext?.preferStableTargets),
    historyConfidence: historyContext?.historyConfidence ?? 0,
    biasKinds: [
      historyContext?.recentToneBias?.length ? "tone" : "",
      historyContext?.recentColorBias?.length ? "color" : "",
      historyContext?.recentEmphasisBias?.length ? "emphasis" : "",
      historyContext?.recentIntentBias?.length ? "intent" : "",
    ].filter(Boolean),
  });

  const assertNotAborted = (phase: string): void => {
    if (!signal?.aborted) return;
    toAbortError({
      phase,
      metrics,
      timeoutMs,
      modelId,
      abortReason: readAbortReason(signal.reason),
    });
  };

  let htmlHashBefore: string | null = null;
  let htmlHashAfterInjection: string | null = null;

  try {
    startStage(metrics, "slot_resolve");
    assertNotAborted("decorate.slotResolve");
    const initial = await getCommittedEditorHtmlSSOT();
    let html = initial.html;
    let snapshotVersion = initial.snapshotVersion;
    htmlHashBefore = hashHtml(html);
    setMetric(metrics, "snapshotVersion", snapshotVersion);
    setMetric(metrics, "htmlHashBefore", htmlHashBefore);

    const initialTargetSlotType = isBackgroundStyleIntent(styleIntent.styleIntent) ? "text" : inferTargetSlotType(userPrompt);
    let resolved = prioritizeCandidatesByTarget(resolveSlotsFromHtmlV2(html), initialTargetSlotType);

    const resolveAndStoreMetrics = (current: SlotResolutionV2) => {
      setMetric(metrics, "slotCandidatesCount", current.candidates.length);
      setMetric(metrics, "selectedSlotId", current.selected?.id ?? null);
      setMetric(metrics, "selectedSelector", current.selected?.selector ?? null);
      setMetric(metrics, "slotResolveSource", current.source ?? null);
      emitSlotResolve({
        snapshotVersion,
        resolved: current,
        htmlHashBefore: htmlHashBefore ?? hashHtml(html),
        htmlHashAfterInjection,
      });
    };

    if (isBackgroundStyleIntent(styleIntent.styleIntent) && !shouldUseSlotResolverForDecorateIntent({ styleIntent: styleIntent.styleIntent, prompt: userPrompt })) {
      emitSlotResolveBlocked?.({ styleIntent: styleIntent.styleIntent, blockedResolver: "text_slot_resolver", reason: "background_intent_surface_first" });
    }
    resolveAndStoreMetrics(resolved);

    if (resolved.candidates.length === 0 || !resolved.selected) {
      assertNotAborted("decorate.slotResolve");
      const injected = injectDefaultSlotIntoStudentHtml(html);
      if (injected.injected) {
        await commitStudentHtml(injected.html);
        htmlHashAfterInjection = hashHtml(injected.html);
        setMetric(metrics, "htmlHashAfterInjection", htmlHashAfterInjection);
        setMetric(metrics, "committedHtmlHash", htmlHashAfterInjection);
        setMetric(metrics, "commitTargetKey", "index.html");
        setMetric(metrics, "previewRefreshTriggered", true);
        emitCommitState({
          committedHtmlHash: htmlHashAfterInjection,
          commitTargetKey: "index.html",
          previewRefreshTriggered: true,
        });
      }

      const committed = await getCommittedEditorHtmlSSOT();
      html = committed.html;
      snapshotVersion = committed.snapshotVersion;
      setMetric(metrics, "snapshotVersion", snapshotVersion);
      resolved = prioritizeCandidatesByTarget(resolveSlotsFromHtmlV2(html), initialTargetSlotType);
      if ((resolved.candidates.length === 0 || !resolved.selected) && injected.injected) {
        resolved = prioritizeCandidatesByTarget(resolveSlotsFromHtmlV2(injected.html), initialTargetSlotType);
        html = injected.html;
        if (htmlHashAfterInjection) {
          setMetric(metrics, "snapshotVersion", `${snapshotVersion}:local_injected`);
        }
      }
      resolveAndStoreMetrics(resolved);
    }

    endStage(metrics, "slot_resolve");

    if (resolved.candidates.length === 0 || !resolved.selected) {
      setMetric(metrics, "guardrailReason", "slot_not_found");
      onGuardrail({ reason: "slot_not_found", source: resolved.source ?? "heuristic_none" });
      return { ok: false, reason: "slot_not_found", metrics };
    }

    const slotMap = buildSlotMap({
      resolved,
      selectedSelector: resolved.selected.selector,
      html: resolved.html,
    });

    const semanticSections = detectDecorateSemanticSections({
      html: resolved.html,
      slotMap,
      existingSignals: styleIntent.compositionHints,
    });
    emitSemanticSectionsDetected?.({
      requestId,
      sectionKinds: semanticSections.semanticSections.map((section) => section.kind),
      primarySectionKind: semanticSections.primarySectionKind,
      hasHero: semanticSections.hasHero,
      hasCTA: semanticSections.hasCTA,
      hasCards: semanticSections.hasCards,
      count: semanticSections.semanticSections.length,
    });

    const requestedTargetKinds = Array.from(new Set([
      styleIntent.primaryStyleIntent === "cta_emphasis" ? "cta_emphasis" : null,
      styleIntent.primaryStyleIntent === "headline_emphasis" ? "headline_emphasis" : null,
      styleIntent.primaryStyleIntent === "card_tone" ? "card_tone" : null,
      styleIntent.primaryStyleIntent === "section_tone" || isBackgroundStyleIntent(styleIntent.styleIntent) ? "section_tone" : null,
      styleIntent.primaryStyleIntent === "cta_emphasis" ? "accent_emphasis" : null,
      normalizedProfile.profile === "soft_playful" ? "headline_emphasis" : null,
      normalizedProfile.profile === "soft_playful" ? "section_tone" : null,
      normalizedProfile.profile === "luxury_minimal" || normalizedProfile.profile === "clean_modern" ? "section_tone" : null,
    ].filter((kind): kind is "cta_emphasis" | "headline_emphasis" | "card_tone" | "section_tone" | "accent_emphasis" => Boolean(kind))));

    const resolvedStyleTargets = resolveDecorateStyleTargets({
      html: resolved.html,
      slotMap,
      targetKinds: requestedTargetKinds,
      semanticSections: semanticSections.semanticSections,
    });
    emitStyleTargetsResolved?.({
      requestId,
      targetKinds: requestedTargetKinds,
      resolvedCount: resolvedStyleTargets.resolvedTargets.length,
      unresolvedKinds: resolvedStyleTargets.unresolvedKinds,
      confidences: resolvedStyleTargets.confidences,
      semanticKindsUsed: resolvedStyleTargets.semanticKindsUsed,
      provenanceKinds: resolvedStyleTargets.provenanceKinds,
      semanticCoverageScore: resolvedStyleTargets.semanticCoverageScore,
    });

    if (resolvedStyleTargets.resolvedTargets.length > 0 && resolvedStyleTargets.unresolvedKinds.length > 0) {
      emitStyleFallbackPartialTargetUsed?.({ requestId, foundKinds: resolvedStyleTargets.resolvedTargets.map((target) => target.kind), unresolvedKinds: resolvedStyleTargets.unresolvedKinds });
      emitSemanticPartialTargetUsed?.({
        requestId,
        requestedKinds: requestedTargetKinds,
        resolvedKinds: resolvedStyleTargets.resolvedTargets.map((target) => target.kind),
        missingKinds: resolvedStyleTargets.unresolvedKinds,
        strategy: "semantic_partial_precision",
      });
      for (const unresolvedKind of resolvedStyleTargets.unresolvedKinds) {
        emitStyleFallbackDegradedTarget?.({ requestId, kind: unresolvedKind, degradedTo: "safe_fallback_selector" });
      }
    }

    let plan: DecoratePlanV1;
    let selectedPlanSource: DecoratePlanSource | null = null;
    if (decorateMode === "deterministic") {
      emitPlanSource?.({ source: "deterministic", latencyMs: 0, ok: true, stage: "start" });
      const deterministicIntent = extractDeterministicFallbackIntent(userPrompt, true);
      emitFallbackIntentExtracted?.(deterministicIntent);
      plan = buildDeterministicDecoratePlan(userPrompt, shapedPlan.shapedIntent, styleIntent, resolvedStyleTargets.resolvedTargets, semanticSections);
      if (isBackgroundStyleIntent(styleIntent.styleIntent)) {
        const surfaceTarget = resolveDecorateSurfaceTarget({ sectionAny: slotMap.section_any, headingPrimary: slotMap.heading_primary, textAny: slotMap.text_any });
        emitSurfaceTargetResolved?.(surfaceTarget);
        emitBackgroundFallbackSelected?.({ targetKind: surfaceTarget.targetType, styleIntent: styleIntent.styleIntent, colors: styleIntent.colorTokens, gradient: styleIntent.gradientRequested, contrastAdjusted: true });
      }
      selectedPlanSource = "deterministic";
      emitPlanSource?.({ source: "deterministic", latencyMs: 0, ok: true, stage: "end" });
    } else {
      const slotHints = summarizeSlotMap(slotMap);
      const snapshot = snapshotVersion ?? "unknown";
      let resolvedPlan: DecoratePlanV1 | null = null;
      let serverCandidate: DecoratePlanV1 | null = null;

      if (requestServerPlan && !degradedDecision.forceDeterministicFallback) {
        const serverStart = Date.now();
        emitPlanSource?.({ source: "server_llm", stage: "start", latencyMs: 0, ok: true });
        const serverResult = await requestServerPlan({
          prompt: userPrompt,
          snapshotVersion: snapshot,
          slotFingerprint: resolved.fingerprint,
          slotHints,
          changedNodesCount: Math.max(0, changedNodesHint),
          intentSummary: shapedPlan.shapedIntent,
          shapedPlan,
          historyConfidence: historyContext?.historyConfidence ?? 0,
          signal,
        });
        const latencyMs = Math.max(0, Date.now() - serverStart);
        if (serverResult.ok) {
          const validated = validateDecoratePlan({ plan: serverResult.plan, source: "server_llm", intent: shapedPlan.shapedIntent, styleIntent: styleIntent.styleIntent });
          emitPlanValidation?.({
            source: serverResult.provider === "cache" ? "cache" : "server_llm",
            schemaValid: validated.isSchemaValid,
            semanticallyUseful: validated.isSemanticallyUseful,
            repairable: validated.repairable,
            recommendedAction: validated.recommendedAction,
            issues: validated.issues,
            intentMatched: validated.intentMatched,
            mismatchKinds: validated.mismatchKinds,
          });
          if (validated.plan && validated.recommendedAction !== "reject") {
            serverCandidate = validated.plan;
            emitPlanSource?.({ source: "server_llm", stage: "end", latencyMs, ok: true, status: 200 });
          } else {
            emitPlanSource?.({ source: "server_llm", stage: "end", latencyMs, ok: false, reason: validated.schemaReason ?? "semantic_weak", status: 200 });
          }
        } else {
          emitPlanSource?.({
            source: "server_llm",
            stage: "end",
            latencyMs,
            ok: false,
            reason: serverResult.reason,
            status: serverResult.status,
          });
        }
      }

      if (serverCandidate) {
        const deterministicPlan = buildDeterministicDecoratePlan(userPrompt, shapedPlan.shapedIntent, styleIntent, resolvedStyleTargets.resolvedTargets, semanticSections);
        const compared = compareDecorateCandidates({ intent: shapedPlan.shapedIntent, styleIntent: styleIntent.styleIntent, serverPlan: serverCandidate, fallbackPlan: deterministicPlan, semantic: semanticSections });
        emitCandidateComparison?.({
          serverScore: compared.serverScore,
          fallbackScore: compared.fallbackScore,
          chosenSource: compared.chosenSource,
          reason: compared.reason,
          intentMatchScore: compared.styleIntentMatchScore,
          surfaceStyleScore: compared.surfaceCoverageScore,
          htmlOnlyPenalty: compared.htmlMutationPenalty,
          contrastSafetyScore: compared.contrastSafetyScore,
          accentCoverageScore: compared.accentCoverageScore,
          overMutationPenalty: compared.overMutationPenalty,
          targetCoverageScore: compared.targetCoverageScore,
          legibilityScore: compared.legibilityScore,
          styleCoherenceScore: compared.styleCoherenceScore,
          emphasisPrecisionScore: compared.emphasisPrecisionScore,
          saturationPenalty: compared.saturationPenalty,
          noisyCompositionPenalty: compared.noisyCompositionPenalty,
          semanticCoherenceScore: compared.semanticCoherenceScore,
          chosenReason: compared.reason,
        });
        if (compared.chosenSource === "server_llm") {
          resolvedPlan = serverCandidate;
          selectedPlanSource = "server_llm";
        } else {
          resolvedPlan = deterministicPlan;
          selectedPlanSource = "deterministic";
        }
      }

      if (!resolvedPlan && localPlanEnabled && !degradedDecision.preferMinimalPreviewPlan) {
        startStage(metrics, "generate_json");
        assertNotAborted("decorate.generateJson");
        const localStart = Date.now();
        emitPlanSource?.({ source: "local_llm", latencyMs: 0, ok: true, stage: "start" });
        let decorateJsonResult: Awaited<ReturnType<typeof generateDecoratePlanJson>> | null = null;
        try {
          decorateJsonResult = await withDecorateGenerateJsonContext(() =>
            generateDecoratePlanJson({
              requestId,
              userPrompt,
              slotType: resolved.selected!.type,
              timeoutMs,
              modelId,
              maxTokens,
              signal,
              startWebLLM,
            }),
          );
        } catch (error) {
          endStage(metrics, "generate_json");
          emitPlanSource?.({ source: "local_llm", latencyMs: Math.max(0, Date.now() - localStart), ok: false, reason: "abort", stage: "end" });
          toAbortError({
            phase: "decorate.generateJson",
            metrics,
            timeoutMs,
            modelId,
            abortReason: readAbortReason(signal?.reason),
            error,
          });
        }
        endStage(metrics, "generate_json");

        const latencyMs = Math.max(0, Date.now() - localStart);
        if (!decorateJsonResult || !decorateJsonResult.ok) {
          emitPlanSource?.({ source: "local_llm", latencyMs, ok: false, reason: "no_result", stage: "end" });
        } else {
          const response = decorateJsonResult.response;
          if (response.type !== "result" || response.kind !== "generateJson" || !response.result.ok || !("data" in response.result)) {
            emitPlanSource?.({ source: "local_llm", latencyMs, ok: false, reason: "invalid_response", stage: "end" });
          } else {
            const validated = validateDecoratePlanV1(response.result.data);
            if (validated.ok) {
              const semantic = validateDecoratePlan({ plan: validated.plan, source: "local_llm", intent: shapedPlan.shapedIntent, styleIntent: styleIntent.styleIntent });
              if (isBackgroundStyleIntent(styleIntent.styleIntent) && !shouldAllowHtmlMutationForDecorateIntent({ styleIntent: styleIntent.styleIntent, prompt: userPrompt })) {
                emitHtmlMutationBlocked?.({ styleIntent: styleIntent.styleIntent, reason: "background_intent_requires_surface_style" });
              }
              resolvedPlan = semantic.recommendedAction === "fallback" && isBackgroundStyleIntent(styleIntent.styleIntent) ? null : validated.plan;
              selectedPlanSource = resolvedPlan ? "local_llm" : selectedPlanSource;
              emitPlanValidation?.({
                source: "local_llm",
                schemaValid: semantic.isSchemaValid,
                semanticallyUseful: semantic.isSemanticallyUseful,
                repairable: semantic.repairable,
                recommendedAction: semantic.recommendedAction,
                issues: semantic.issues,
                intentMatched: semantic.intentMatched,
                mismatchKinds: semantic.mismatchKinds,
              });
              emitPlanSource?.({ source: "local_llm", latencyMs, ok: true, stage: "end" });
            } else {
              emitPlanSource?.({ source: "local_llm", latencyMs, ok: false, reason: validated.reason, stage: "end" });
            }
          }
        }
      }

      if (!resolvedPlan) {
        emitPlanSource?.({ source: "deterministic", latencyMs: 0, ok: true, stage: "start" });
        const deterministicIntent = extractDeterministicFallbackIntent(userPrompt, true);
        emitFallbackIntentExtracted?.(deterministicIntent);
        plan = buildDeterministicDecoratePlan(userPrompt, shapedPlan.shapedIntent, styleIntent, resolvedStyleTargets.resolvedTargets, semanticSections);
        emitStyleFallbackComposed?.({
          requestId,
          profile: normalizedProfile.profile,
          opKinds: Array.from(new Set(plan.ops.map((op) => op.op))),
          targetKinds: Array.from(new Set(plan.ops.map((op) => (op.target.kind === "slot" ? op.target.slot : "selector")))),
        });
        selectedPlanSource = "deterministic";
        emitPlanSource?.({ source: "deterministic", latencyMs: 0, ok: true, stage: "end" });
      } else {
        plan = resolvedPlan;
      }
    }

    const contrastGuard = evaluateDecorateContrastGuard(plan);
    emitContrastGuardEvaluated?.({ requestId, score: contrastGuard.score, contrastWarnings: contrastGuard.contrastWarnings });
    if (contrastGuard.adjustmentsApplied.length > 0) emitContrastGuardAdjusted?.({ requestId, adjustmentsApplied: contrastGuard.adjustmentsApplied });
    if (contrastGuard.contrastWarnings.length > 0) emitLegibilityGuardWarning?.({ requestId, warnings: contrastGuard.contrastWarnings });

    const composedIntentMatch = evaluateComposedStyleIntentMatch({
      primaryStyleIntent: styleIntent.primaryStyleIntent,
      plan: { ...plan, ops: contrastGuard.adjustedOps },
    });
    emitComposedIntentMatchEvaluated?.({
      requestId,
      primaryStyleIntent: styleIntent.primaryStyleIntent,
      matchScore: composedIntentMatch.matchScore,
      matchKinds: composedIntentMatch.matchKinds,
      missingKinds: composedIntentMatch.missingKinds,
      penalties: composedIntentMatch.penalties,
    });
    const semanticCoherence = evaluateSemanticDecorateCoherence({
      plan: { ...plan, ops: contrastGuard.adjustedOps },
      styleIntent: styleIntent.styleIntent,
      semantic: semanticSections,
    });
    emitSemanticCoherenceEvaluated?.({
      requestId,
      score: semanticCoherence.score,
      matchedSemanticKinds: semanticCoherence.matchedSemanticKinds,
      missingSemanticKinds: semanticCoherence.missingSemanticKinds,
      penalties: semanticCoherence.penalties,
    });

    const builtSummary = buildDecorateSummaryFromActualOps({ ...plan, ops: contrastGuard.adjustedOps }, normalizedProfile.profile, semanticSections.semanticSections.map((section) => section.kind));
    const studentPreviewSummary = buildStudentPreviewSummary({ plan: { ...plan, ops: contrastGuard.adjustedOps }, intent: routedIntent, styleIntent: styleIntent.styleIntent });
    plan = { ...plan, ops: contrastGuard.adjustedOps, summary: studentPreviewSummary.summary || builtSummary.summary };
    const compositionSnapshot = { opKinds: Array.from(new Set(plan.ops.map((op) => op.op))), targetKinds: Array.from(new Set(plan.ops.map((op) => (op.target.kind === "slot" ? op.target.slot : "selector")))), strength: plan.ops.length >= 4 ? "high" : plan.ops.length >= 2 ? "medium" : "low", styleProfile: normalizedProfile.profile };
    emitStyleCompositionBuilt?.({ requestId, ...compositionSnapshot });
    emitStructureGuidedCompositionBuilt?.({
      requestId,
      semanticKindsUsed: semanticSections.semanticSections.map((section) => section.kind),
      opKinds: compositionSnapshot.opKinds,
      targetKinds: compositionSnapshot.targetKinds,
      compositionStrategy: plan.ops.length > 0 ? (semanticSections.hasHero ? "hero_centered" : semanticSections.hasCTA ? "cta_centered" : semanticSections.hasCards ? "cards_centered" : "primary_section_balanced") : "none",
    });
    emitStyleProfileSemanticApplied?.({
      requestId,
      profile: normalizedProfile.profile,
      semanticKinds: semanticSections.semanticSections.map((section) => section.kind),
      majorTargets: compositionSnapshot.targetKinds.slice(0, 3),
    });
    emitStyleCompositionRefined?.({
      requestId,
      originalOpCount: compositionSnapshot.opKinds.length,
      finalOpCount: plan.ops.length,
      droppedKinds: [],
      refinedReasons: ["target_mapping_and_guard_refined"],
    });
    if (selectedPlanSource === "deterministic") {
      emitStyleFallbackRefined?.({ requestId, finalOpCount: plan.ops.length, refinedReasons: ["deterministic_composed_refined"] });
    }
    emitPlanReady?.({ mode: decorateMode, source: decorateMode === "deterministic" ? "deterministic" : selectedPlanSource ?? undefined, opsCount: plan.ops.length, summary: plan.summary });

    const intentMatchPrecheck = evaluateDecorateIntentMatch({ styleIntent: styleIntent.styleIntent, plan });
    emitIntentMatchEvaluated?.({
      primaryIntent: routedIntent.primaryIntent,
      styleIntent: styleIntent.styleIntent,
      intentMatched: intentMatchPrecheck.intentMatched,
      mismatchKinds: intentMatchPrecheck.mismatchKinds,
      surfaceStyleChanged: intentMatchPrecheck.surfaceStyleChanged,
      htmlOnlyMutation: intentMatchPrecheck.htmlOnlyMutation,
    });
    emitSummaryBuilt?.({
      opKinds: plan.ops.map((op) => op.op),
      styleProfile: normalizedProfile.profile,
      summaryKind: studentPreviewSummary.summaryKind,
      intentMatched: intentMatchPrecheck.intentMatched,
      majorOpKinds: builtSummary.majorOpKinds,
      summaryStyle: builtSummary.summaryStyle,
      multiOp: builtSummary.multiOp,
      semanticKindsMentioned: semanticSections.semanticSections.map((section) => section.kind).slice(0, 3),
      summaryAudienceStyle: "friendly",
      multiSection: semanticSections.semanticSections.length > 1,
    });
    emitStudentPreviewSummaryBuilt?.({
      requestId,
      summaryKind: studentPreviewSummary.summaryKind,
      majorTargets: studentPreviewSummary.majorTargets,
      intentMatched: studentPreviewSummary.intentMatched && intentMatchPrecheck.intentMatched,
    });

    startStage(metrics, "apply_patch");
    assertNotAborted("decorate.applyPatch");
    let executed = executeDecoratePlan({ html: resolved.html, plan, slotMap });
    let slotMapForApply = slotMap;
    let selectedForApply = resolved.selected;
    let candidatesForApply = resolved.candidates;

    if (!executed.report.matched) {
      const injected = injectDefaultSlotIntoStudentHtml(resolved.html);
      if (injected.injected) {
        const repairedResolved = prioritizeCandidatesByTarget(resolveSlotsFromHtmlV2(injected.html), initialTargetSlotType);
        if (repairedResolved.selected) {
          slotMapForApply = buildSlotMap({
            resolved: repairedResolved,
            selectedSelector: repairedResolved.selected.selector,
            html: repairedResolved.html,
          });
          selectedForApply = repairedResolved.selected;
          candidatesForApply = repairedResolved.candidates;
          executed = executeDecoratePlan({ html: repairedResolved.html, plan, slotMap: slotMapForApply });
        }
      }
    }
    endStage(metrics, "apply_patch");

    emitPlanExecute?.({
      appliedOps: executed.report.appliedOps,
      changed: executed.report.changed,
      degraded: executed.report.degraded,
      changedNodesCount: executed.report.changedNodes.length,
      majorTargets: [...new Set(executed.report.changedNodes.map((node) => node.selector))].slice(0, 2),
    });

    const resultReady = {
      summary: plan.summary,
      opsCount: plan.ops.length,
      selector: (selectedForApply ?? resolved.selected).selector,
      htmlSnippet: executed.nextHtml.slice(0, 120),
    } as const;

    emitResultReady?.({
      mode: decorateMode,
      summary: resultReady.summary,
      opsCount: resultReady.opsCount,
      selector: resultReady.selector,
      htmlSnippetLen: resultReady.htmlSnippet.length,
    });

    const slotForApply: SlotCandidate =
      selectedForApply ??
      candidatesForApply[0] ?? {
        id: "decorate.fallback.main",
        type: "text",
        selector: "main",
        tagName: "main",
      };

    return {
      ok: true,
      nextHtml: executed.nextHtml,
      applyResult: {
        changed: executed.report.changed,
        matched: executed.report.matched,
        degradedExternalImage: executed.report.degraded,
        appliedOps: executed.report.appliedOps,
        changedNodes: executed.report.changedNodes,
        opResults: executed.report.opResults,
      },
      plan,
      slot: slotForApply,
      slotMap: slotMapForApply,
      metrics,
      resultReady,
      mode: decorateMode,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    toAbortError({
      phase: metrics.stage === "generate_json" ? "decorate.generateJson" : "decorate.slotResolve",
      metrics,
      timeoutMs,
      modelId,
      abortReason: readAbortReason(signal?.reason),
      error,
    });
  }
  throw new Error("runDecorateFlow_unreachable");
}
