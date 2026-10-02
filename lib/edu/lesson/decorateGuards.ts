import { routeDecorateIntent, type DecorateIntentSummary } from "@/lib/edu/lesson/decorateIntentRouter";
import { evaluateDecorateIntentMatch, isBackgroundStyleIntent, type DecorateStyleIntent } from "@/lib/edu/lesson/decorateStyleIntent";
import type { DecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";
export type DecoratePendingInvalidationReason =
  | "pending_stale_due_to_user_edit"
  | "pending_stale_due_to_newer_decorate"
  | "pending_stale_due_to_snapshot_change"
  | "pending_stale_due_to_hash_change"
  | "pending_stale_due_to_missing_base";

export type DecoratePreviewQualityInput = {
  beforeHtml: string;
  nextHtml: string;
  changedFiles: number;
  prompt: string;
  plan?: DecoratePlanV1;
  styleIntent?: DecorateStyleIntent;
};

export type DecoratePreviewQuality = {
  intentMismatch: boolean;
  mismatchKinds: string[];
  changedFiles: number;
  htmlChanged: boolean;
  styleMutationCount: number;
  textMutationCount: number;
  imageIntentCount: number;
  estimatedMutationCount: number;
  lowImpactPreview: boolean;
  qualityScore: number;
  studentVisibleChange: boolean;
  visibleTargetKinds: string[];
};

const countRegex = (value: string, regex: RegExp) => {
  const matches = value.match(regex);
  return matches ? matches.length : 0;
};

export const evaluateDecoratePreviewQuality = (input: DecoratePreviewQualityInput): DecoratePreviewQuality => {
  const { beforeHtml, nextHtml, changedFiles, prompt } = input;
  const htmlChanged = beforeHtml !== nextHtml;
  const classMutations = Math.abs(countRegex(nextHtml, /class\s*=\s*["']/gi) - countRegex(beforeHtml, /class\s*=\s*["']/gi));
  const styleMutations = Math.abs(countRegex(nextHtml, /style\s*=\s*["']/gi) - countRegex(beforeHtml, /style\s*=\s*["']/gi));
  const headingMutations = Math.abs(countRegex(nextHtml, /<h[1-6]\b/gi) - countRegex(beforeHtml, /<h[1-6]\b/gi));
  const paragraphMutations = Math.abs(countRegex(nextHtml, /<p\b/gi) - countRegex(beforeHtml, /<p\b/gi));
  const imageIntentCount = countRegex(prompt, /(사진|이미지|img|image|photo|picture|고양이|cat)/gi);
  const textMutationCount = headingMutations + paragraphMutations;
  const estimatedMutationCount = classMutations + styleMutations + textMutationCount + Number(htmlChanged);
  const lowImpactPreview = !htmlChanged || (estimatedMutationCount <= 1 && changedFiles <= 1);
  const intentMatch = input.plan ? evaluateDecorateIntentMatch({ styleIntent: input.styleIntent ?? "none", plan: input.plan }) : { intentMatched: true, mismatchKinds: [], surfaceStyleChanged: false, htmlOnlyMutation: false };
  const intentMismatch = isBackgroundStyleIntent(input.styleIntent ?? "none") && !intentMatch.intentMatched;
  const qualityScore = Math.max(0, Math.min(1, estimatedMutationCount / 6 + (htmlChanged ? 0.2 : 0) - (intentMismatch ? 0.35 : 0)));
  const visibleTargetKinds: string[] = [];
  if (input.plan) {
    const opKinds = input.plan.ops.map((op) => op.op);
    if (opKinds.includes("set_surface_background") || opKinds.includes("set_surface_tone")) visibleTargetKinds.push("background");
    if (opKinds.includes("set_button_style") || opKinds.includes("set_accent_style")) visibleTargetKinds.push("button");
    if (opKinds.includes("set_text_emphasis") || opKinds.includes("emphasize_heading") || opKinds.includes("set_text_style")) visibleTargetKinds.push("headline");
    if (opKinds.includes("set_card_style") || opKinds.includes("set_section_style")) visibleTargetKinds.push("section");
    if (opKinds.includes("insert_media")) visibleTargetKinds.push("image");
  }
  const studentVisibleChange = !lowImpactPreview && (styleMutations > 0 || visibleTargetKinds.length > 0 || qualityScore >= 0.56);
  return {
    intentMismatch,
    mismatchKinds: intentMatch.mismatchKinds,
    changedFiles,
    htmlChanged,
    styleMutationCount: classMutations + styleMutations,
    textMutationCount,
    imageIntentCount,
    estimatedMutationCount,
    lowImpactPreview,
    qualityScore,
    studentVisibleChange,
    visibleTargetKinds,
  };
};

export const hardenOpenaiResponseQuality = (input: {
  quality: DecoratePreviewQuality;
  intent: DecorateIntentSummary;
}): {
  semanticUseful: boolean;
  studentVisibleChange: boolean;
  intentMatched: boolean;
  recommendedAction: "accept" | "enrich" | "fallback";
  reasons: string[];
} => {
  const reasons: string[] = [];
  const intentMatched = !input.quality.intentMismatch;
  if (!input.quality.htmlChanged) reasons.push("no_html_change");
  if (input.quality.lowImpactPreview) reasons.push("low_impact_preview");
  if (!intentMatched) reasons.push("intent_mismatch");
  if (input.intent.imageTargets.length > 0 && !input.quality.visibleTargetKinds.includes("image")) reasons.push("image_intent_unmet");
  if (input.intent.emphasisTargets.length > 0 && !input.quality.visibleTargetKinds.some((kind) => kind === "button" || kind === "headline")) reasons.push("emphasis_intent_unmet");
  if (input.intent.colors.length > 0 && !input.quality.visibleTargetKinds.includes("background")) reasons.push("color_intent_unmet");
  const semanticUseful = reasons.length === 0 || (reasons.length === 1 && reasons[0] === "low_impact_preview");
  const studentVisibleChange = input.quality.studentVisibleChange;
  let recommendedAction: "accept" | "enrich" | "fallback" = "accept";
  if (!intentMatched || reasons.includes("image_intent_unmet") || reasons.includes("emphasis_intent_unmet")) {
    recommendedAction = "fallback";
  } else if (!studentVisibleChange || input.quality.lowImpactPreview) {
    recommendedAction = "enrich";
  }
  return { semanticUseful, studentVisibleChange, intentMatched, recommendedAction, reasons };
};

export const raiseFallbackQualityFloor = (input: {
  nextHtml: string;
  intent: DecorateIntentSummary;
  styleIntent: DecorateStyleIntent;
}) => {
  let nextHtml = input.nextHtml;
  const appliedReasons: string[] = [];
  const isBackground = isBackgroundStyleIntent(input.styleIntent) || input.intent.colors.length > 0;
  const isButton = input.styleIntent === "cta_emphasis" || input.intent.emphasisTargets.some((target) => /cta|button|버튼/i.test(target));
  const isHeadline = input.styleIntent === "headline_emphasis" || input.intent.emphasisTargets.some((target) => /headline|title|제목|헤딩/i.test(target));

  if (isBackground && /<main\b/i.test(nextHtml) && !/data-student-floor="background"/.test(nextHtml)) {
    nextHtml = nextHtml.replace(/<main\b([^>]*)>/i, '<main$1 data-student-floor="background" style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#ffffff;">');
    appliedReasons.push("background_floor");
  }
  if (isButton && /<button\b/i.test(nextHtml) && !/data-student-floor="button"/.test(nextHtml)) {
    nextHtml = nextHtml.replace(/<button\b([^>]*)>/i, '<button$1 data-student-floor="button" style="background:#2563eb;color:#fff;box-shadow:0 8px 20px rgba(37,99,235,.35);font-weight:800;">');
    appliedReasons.push("button_floor");
  }
  if (isHeadline && /<h1\b/i.test(nextHtml) && !/data-student-floor="headline"/.test(nextHtml)) {
    nextHtml = nextHtml.replace(/<h1\b([^>]*)>/i, '<h1$1 data-student-floor="headline" style="font-size:clamp(2rem,4vw,3rem);font-weight:900;letter-spacing:.01em;">');
    appliedReasons.push("headline_floor");
  }

  if (appliedReasons.length === 0 && /<main\b/i.test(nextHtml) && !/data-student-floor="vague"/.test(nextHtml)) {
    nextHtml = nextHtml.replace(/<main\b([^>]*)>/i, '<main$1 data-student-floor="vague" style="outline:3px solid rgba(14,165,233,.45);border-radius:16px;">');
    appliedReasons.push("vague_floor");
  }

  return { nextHtml, raised: appliedReasons.length > 0 && nextHtml !== input.nextHtml, reasons: appliedReasons };
};

export const decideAcceptedStudentResult = (input: {
  openaiQuality: number;
  fallbackQuality: number;
  openaiPatchable: boolean;
  openaiStrong: boolean;
}) => {
  if (input.openaiStrong && input.openaiQuality >= input.fallbackQuality - 0.04) {
    return { chosenSource: "openai" as const, reason: "openai_strong_and_intent_matched" };
  }
  if (input.openaiPatchable && input.openaiQuality >= input.fallbackQuality - 0.12) {
    return { chosenSource: "openai_enriched" as const, reason: "openai_weak_but_patchable" };
  }
  return { chosenSource: "fallback_deterministic" as const, reason: "fallback_stronger_visible_change" };
};

export type DecoratePreviewConsistencyInput = {
  pendingRequestId: string;
  pendingPreviewHash: string;
  pendingBaseSnapshotVersion: string | null;
  pendingBaseHtmlHash: string;
  beforeSnapshotVersion: string | null;
  beforeHtmlHash: string;
};

export type DecoratePreviewMismatchReason =
  | "preview_apply_hash_mismatch"
  | "preview_apply_snapshot_mismatch"
  | "preview_apply_missing_pending"
  | "preview_apply_rebased";

export const classifyPreviewApplyConsistency = (
  input: DecoratePreviewConsistencyInput,
): { ok: boolean; reasons: DecoratePreviewMismatchReason[] } => {
  const reasons: DecoratePreviewMismatchReason[] = [];
  if (!input.pendingBaseSnapshotVersion) {
    reasons.push("preview_apply_rebased");
  }
  if (input.beforeSnapshotVersion !== input.pendingBaseSnapshotVersion) {
    reasons.push("preview_apply_snapshot_mismatch");
  }
  if (input.beforeHtmlHash !== input.pendingBaseHtmlHash) {
    reasons.push("preview_apply_hash_mismatch");
  }
  return { ok: reasons.length === 0, reasons };
};

export const decidePendingInvalidationReason = (input: {
  beforeSnapshotVersion: string | null;
  beforeHtmlHash: string;
  pendingBaseSnapshotVersion: string | null;
  pendingBaseHtmlHash: string;
  lastOwner: "decorate" | "user_edit" | "generator" | "initial";
}): DecoratePendingInvalidationReason | null => {
  const { beforeSnapshotVersion, beforeHtmlHash, pendingBaseSnapshotVersion, pendingBaseHtmlHash, lastOwner } = input;
  if (!pendingBaseSnapshotVersion) return "pending_stale_due_to_missing_base";
  if (beforeSnapshotVersion !== pendingBaseSnapshotVersion) {
    return lastOwner === "user_edit" ? "pending_stale_due_to_user_edit" : "pending_stale_due_to_snapshot_change";
  }
  if (beforeHtmlHash !== pendingBaseHtmlHash) {
    return lastOwner === "user_edit" ? "pending_stale_due_to_user_edit" : "pending_stale_due_to_hash_change";
  }
  return null;
};

export const shouldBlockGeneratorFallbackRestore = (input: {
  decorateInProgress: boolean;
  lastOwner: "decorate" | "user_edit" | "generator" | "initial";
  ownerSnapshotHash: string | null;
  currentHtmlHash: string;
  restoreTargets: string[];
}): { blocked: boolean; reason: "decorate_in_progress" | "recent_owner_guard" | "html_hash_mismatch" | null } => {
  if (input.restoreTargets.length === 0) return { blocked: true, reason: null };
  if (input.decorateInProgress) return { blocked: true, reason: "decorate_in_progress" };
  if (input.lastOwner === "decorate" || input.lastOwner === "user_edit") {
    if (input.ownerSnapshotHash && input.ownerSnapshotHash !== input.currentHtmlHash) {
      return { blocked: true, reason: "html_hash_mismatch" };
    }
    return { blocked: true, reason: "recent_owner_guard" };
  }
  return { blocked: false, reason: null };
};

export type DecorateFallbackIntent = {
  colors: string[];
  tone: string[];
  emphasis: string[];
  imageIntent: boolean;
  reducedCapability: boolean;
};

const COLOR_RULES = [
  "빨강", "파랑", "보라", "파스텔", "네온", "어두운", "밝은", "그라데이션", "red", "blue", "purple", "pastel", "neon", "dark", "bright", "gradient",
] as const;
const TONE_RULES = ["귀여운", "귀엽", "말랑", "차분", "고급", "세련", "미래", "심플", "멋지", "cute", "soft", "calm", "luxury", "futur", "simple", "modern", "clean"] as const;
const EMPHASIS_RULES = ["cta", "버튼", "button", "제목", "헤딩", "카드", "박스", "강조", "눈에 띄", "잘 보이", "크게"] as const;

export const extractDeterministicFallbackIntent = (prompt: string, reducedCapability: boolean): DecorateFallbackIntent => {
  const routed = routeDecorateIntent(prompt);
  const normalized = prompt.toLowerCase();
  const colors = COLOR_RULES.filter((token) => normalized.includes(token) || routed.colors.includes(token));
  const tone = TONE_RULES.filter((token) => normalized.includes(token) || routed.tone.includes(token));
  const emphasis = EMPHASIS_RULES.filter((token) => normalized.includes(token) || routed.emphasisTargets.includes(token));
  return {
    colors: [...new Set(colors)],
    tone: [...new Set(tone)],
    emphasis: [...new Set(emphasis)],
    imageIntent: /(사진|이미지|img|image|photo|picture|고양이|cat)/i.test(prompt),
    reducedCapability,
  };
};

export const autoEnrichLowImpactPreview = (input: { nextHtml: string; intent: DecorateIntentSummary }) => {
  const { intent } = input;
  let nextHtml = input.nextHtml;
  const reasons: string[] = [];
  if (intent.colors.length > 0 && /<main\b/i.test(nextHtml)) {
    nextHtml = nextHtml.replace(/<main\b([^>]*)>/i, '<main$1 style="outline: 2px solid rgba(99,102,241,.45);">');
    reasons.push("color_contrast_boost");
  }
  if (intent.tone.length > 0) {
    nextHtml = nextHtml.replace(/<h1\b([^>]*)>/i, '<h1$1 style="letter-spacing:.02em;font-weight:800;">');
    reasons.push("tone_headline_boost");
  }
  if (intent.emphasisTargets.length > 0) {
    nextHtml = nextHtml.replace(/<button\b([^>]*)>/i, '<button$1 style="box-shadow:0 0 0 3px rgba(251,191,36,.45);font-weight:700;">');
    reasons.push("emphasis_cta_boost");
  }
  if (intent.imageTargets.length > 0 && !nextHtml.includes("data-decorate-image-intent")) {
    nextHtml = nextHtml.replace(/<img\b/i, '<img data-decorate-image-intent="true"');
    reasons.push("image_metadata_boost");
  }
  return { nextHtml, applied: reasons.length > 0 && nextHtml !== input.nextHtml, reason: reasons.join(",") || "no_enrich_rule" };
};

export type DecorateRecoveryDecision = "accept_preview" | "enrich_preview" | "invalidate_and_retry_fallback" | "accept_with_low_impact_flag";

export type StudentCoachRecoveryDecision =
  | "accept_openai"
  | "accept_webllm"
  | "enrich_openai"
  | "enrich_webllm"
  | "fallback_deterministic"
  | "accept_low_quality_with_flag";

export const decideDecorateRecoveryAction = (input: {
  source: "server_llm" | "local_llm" | "deterministic";
  quality: DecoratePreviewQuality;
  hasFallbackBudget: boolean;
  intent: DecorateIntentSummary;
}): { decision: DecorateRecoveryDecision; reason: string } => {
  if (!input.quality.lowImpactPreview) return { decision: "accept_preview", reason: "quality_ok" };
  if (input.intent.imageTargets.length > 0 || input.intent.emphasisTargets.length > 0 || input.intent.colors.length > 0) {
    return { decision: "enrich_preview", reason: "intent_driven_low_impact" };
  }
  if (input.source === "server_llm" && input.hasFallbackBudget) {
    return { decision: "invalidate_and_retry_fallback", reason: "server_low_impact_retry_fallback" };
  }
  return { decision: "accept_with_low_impact_flag", reason: "safe_accept_low_impact" };
};

export const decideStudentCoachRecovery = (input: {
  initialProvider: "openai" | "webllm" | "deterministic";
  quality: DecoratePreviewQuality;
  hasDeterministicBudget: boolean;
  intent: DecorateIntentSummary;
}): { decision: StudentCoachRecoveryDecision; reason: string } => {
  if (!input.quality.lowImpactPreview && input.quality.qualityScore >= 0.5) {
    if (input.initialProvider === "openai") return { decision: "accept_openai", reason: "quality_strong" };
    if (input.initialProvider === "webllm") return { decision: "accept_webllm", reason: "quality_strong" };
    return { decision: "accept_low_quality_with_flag", reason: "deterministic_already_used" };
  }
  const highIntentVisibility =
    input.intent.colors.length > 0 ||
    input.intent.emphasisTargets.length > 0 ||
    input.intent.imageTargets.length > 0;
  if (input.initialProvider === "openai") {
    if (highIntentVisibility) return { decision: "enrich_openai", reason: "openai_low_impact_but_enrichable" };
    return input.hasDeterministicBudget
      ? { decision: "fallback_deterministic", reason: "openai_low_impact_needs_safe_fallback" }
      : { decision: "accept_low_quality_with_flag", reason: "openai_low_impact_budget_exhausted" };
  }
  if (input.initialProvider === "webllm") {
    if (highIntentVisibility) return { decision: "enrich_webllm", reason: "webllm_low_impact_but_enrichable" };
    return input.hasDeterministicBudget
      ? { decision: "fallback_deterministic", reason: "webllm_low_impact_needs_safe_fallback" }
      : { decision: "accept_low_quality_with_flag", reason: "webllm_low_impact_budget_exhausted" };
  }
  return { decision: "accept_low_quality_with_flag", reason: "deterministic_low_impact_safe_accept" };
};
