import type { DecorateIntentSummary } from "@/lib/edu/lesson/decorateIntentRouter";
import type { DecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";
import type { DecorateStyleIntent } from "@/lib/edu/lesson/decorateStyleIntent";
import { detectDecorateSemanticSections, type DecorateSemanticSectionKind } from "@/lib/edu/lesson/decorateSemanticSections";
import { resolveDecorateStyleTargets, type DecorateStyleTargetKind } from "@/lib/edu/lesson/decorateStyleTargets";
import { normalizeStudentDecoratePrompt } from "@/lib/edu/lesson/studentPromptNormalization";

export type StudentDecorateCopyPhase = "preview_ready" | "apply_start" | "applied";
export type StudentDecorateUiState = "idle" | "sending" | "ready" | "failed";
export type StudentDecorateCtaMode = "start" | "apply";
export type StudentDecoratePromptClass = "background" | "button" | "headline" | "section" | "image" | "mood" | "ambiguous_safe" | "general";
export type StudentDecorateExampleKind = "background" | "button" | "headline" | "section" | "mood" | "image";

export type StudentDecorateExamplePrompt = {
  kind: StudentDecorateExampleKind;
  prompt: string;
  promptClass: StudentDecoratePromptClass;
  targetHint?: string;
  score?: number;
};

type StudentDecorateExampleOutcomeHint = {
  selectionRate?: number;
  successRate?: number;
  lowImpactRate?: number;
};

export type StudentDecorateStructureSignals = {
  html?: string;
  semanticSectionKinds?: DecorateSemanticSectionKind[];
  detectedTargetKinds?: DecorateStyleTargetKind[];
  hasHero?: boolean;
  hasCTA?: boolean;
  hasCards?: boolean;
  hasImageSlot?: boolean;
  hasHeadline?: boolean;
  structureConfidence?: number;
};

export type StructureAwareStudentDecorateExamplesResult = {
  examples: StudentDecorateExamplePrompt[];
  guidanceCopy: string;
  rankingReasonSummary: string[];
  structureSignals: Required<Omit<StudentDecorateStructureSignals, "html" | "semanticSectionKinds" | "detectedTargetKinds">> & {
    semanticSectionKinds: DecorateSemanticSectionKind[];
    detectedTargetKinds: DecorateStyleTargetKind[];
  };
};

type StudentDecorateSuggestionContext = {
  lessonId?: "P1" | "P2" | "P3" | "P4" | null;
  isFreeMode?: boolean;
  limit?: number;
  structureSignals?: StudentDecorateStructureSignals;
  outcomeHints?: Partial<Record<StudentDecorateExampleKind, StudentDecorateExampleOutcomeHint>>;
};

const STUDENT_DECORATE_EXAMPLE_PROMPTS: StudentDecorateExamplePrompt[] = [
  { kind: "background", prompt: "배경을 파란색으로 바꿔줘", promptClass: "background" },
  { kind: "button", prompt: "버튼을 더 눈에 띄게 해줘", promptClass: "button" },
  { kind: "headline", prompt: "제목을 더 크게 보여줘", promptClass: "headline" },
  { kind: "mood", prompt: "좀 더 귀엽게 꾸며줘", promptClass: "mood" },
  { kind: "image", prompt: "사진 자리에 고양이 사진을 넣어줘", promptClass: "image" },
];

const LESSON_AWARE_DECORATE_EXAMPLES: Record<"P1" | "P2" | "P3" | "P4" | "FREE", StudentDecorateExamplePrompt[]> = {
  P1: [
    { kind: "background", prompt: "배경을 밝게 바꿔줘", promptClass: "background" },
    { kind: "headline", prompt: "제목을 더 크게 보여줘", promptClass: "headline" },
    { kind: "section", prompt: "자기소개 카드가 더 잘 보이게 해줘", promptClass: "section" },
  ],
  P2: [
    { kind: "headline", prompt: "관심사 제목을 더 눈에 띄게 해줘", promptClass: "headline" },
    { kind: "mood", prompt: "카드 분위기를 더 부드럽게 해줘", promptClass: "mood" },
    { kind: "background", prompt: "배경을 차분한 색으로 바꿔줘", promptClass: "background" },
  ],
  P3: [
    { kind: "button", prompt: "버튼을 더 눈에 띄게 해줘", promptClass: "button" },
    { kind: "headline", prompt: "퀴즈 제목을 더 크게 해줘", promptClass: "headline" },
    { kind: "mood", prompt: "게임 느낌이 나게 꾸며줘", promptClass: "mood" },
  ],
  P4: [
    { kind: "background", prompt: "작품이 더 돋보이게 배경을 바꿔줘", promptClass: "background" },
    { kind: "section", prompt: "전시 느낌이 나게 정리해줘", promptClass: "section" },
    { kind: "section", prompt: "카드/섹션을 더 깔끔하게 해줘", promptClass: "section" },
  ],
  FREE: STUDENT_DECORATE_EXAMPLE_PROMPTS,
};

export const mapStudentDecorateExampleKindToPromptClass = (
  kind: StudentDecorateExampleKind,
): StudentDecoratePromptClass => {
  if (kind === "background") return "background";
  if (kind === "button") return "button";
  if (kind === "headline") return "headline";
  if (kind === "section") return "section";
  if (kind === "mood") return "mood";
  return "image";
};

export const classifyStudentDecoratePromptClass = (input: {
  prompt: string;
  isAmbiguous: boolean;
}): StudentDecoratePromptClass => {
  const normalized = normalizeStudentDecoratePrompt(input.prompt);
  if (/배경|그라데이션|background/.test(normalized)) return "background";
  if (/버튼|cta|button/.test(normalized)) return "button";
  if (/제목|headline|title/.test(normalized)) return "headline";
  if (/카드|섹션|분위기/.test(normalized)) return "section";
  if (/사진|이미지|image|photo/.test(normalized)) return "image";
  if (/귀엽|말랑|세련|멋지|soft|cute|clean|modern/.test(normalized)) return "mood";
  if (input.isAmbiguous) return "ambiguous_safe";
  return "general";
};

export const getLessonAwareStudentDecorateExamples = (input: StudentDecorateSuggestionContext = {}) => {
  const limit = Math.min(5, Math.max(1, input.limit ?? 5));
  if (input.isFreeMode) {
    return LESSON_AWARE_DECORATE_EXAMPLES.FREE.slice(0, limit);
  }
  const lessonExamples = input.lessonId ? LESSON_AWARE_DECORATE_EXAMPLES[input.lessonId] : null;
  if (lessonExamples?.length) {
    return lessonExamples.slice(0, limit);
  }
  return STUDENT_DECORATE_EXAMPLE_PROMPTS.slice(0, limit);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const inferStructureSignals = (input: StudentDecorateStructureSignals = {}) => {
  const derivedSectionKinds = [...(input.semanticSectionKinds ?? [])];
  const derivedTargetKinds = [...(input.detectedTargetKinds ?? [])];
  let hasHero = Boolean(input.hasHero);
  let hasCTA = Boolean(input.hasCTA);
  let hasCards = Boolean(input.hasCards);
  let hasImageSlot = Boolean(input.hasImageSlot);
  let hasHeadline = Boolean(input.hasHeadline);

  if (input.html?.trim()) {
    const semantic = detectDecorateSemanticSections({ html: input.html });
    const semanticKinds = semantic.semanticSections.map((section) => section.kind);
    for (const kind of semanticKinds) if (!derivedSectionKinds.includes(kind)) derivedSectionKinds.push(kind);
    hasHero = hasHero || semantic.hasHero;
    hasCTA = hasCTA || semantic.hasCTA;
    hasCards = hasCards || semantic.hasCards;

    const targets = resolveDecorateStyleTargets({
      html: input.html,
      slotMap: {
        image_primary: "main img",
        image_any: ["main img", "img"],
        heading_primary: "main h1",
        text_any: ["main p", "main li", "main"],
        section_any: ["main section", "main", "body"],
      },
      targetKinds: ["cta_emphasis", "headline_emphasis", "card_tone", "section_tone", "accent_emphasis"],
      semanticSections: semantic.semanticSections,
    });
    for (const kind of targets.resolvedTargets.map((target) => target.kind)) if (!derivedTargetKinds.includes(kind)) derivedTargetKinds.push(kind);
  }

  const hasSemanticGallery = derivedSectionKinds.includes("gallery");
  const hasSemanticHeadline = derivedTargetKinds.includes("headline_emphasis") || derivedSectionKinds.includes("hero");
  hasImageSlot = hasImageSlot || hasSemanticGallery || (input.html ? /<img\b|data-image|image-slot|photo-slot|gallery/i.test(input.html) : false);
  hasHeadline = hasHeadline || hasSemanticHeadline || (input.html ? /<h1\b|<h2\b/i.test(input.html) : false);

  const explicitSignals = [input.hasHero, input.hasCTA, input.hasCards, input.hasImageSlot, input.hasHeadline].filter((value) => value !== undefined).length;
  const inferredSignals = [hasHero, hasCTA, hasCards, hasImageSlot, hasHeadline].filter(Boolean).length;
  const structureConfidence = clamp(input.structureConfidence ?? (explicitSignals > 0 ? 0.86 : 0.58 + inferredSignals * 0.07), 0.4, 0.98);

  return {
    semanticSectionKinds: derivedSectionKinds,
    detectedTargetKinds: derivedTargetKinds,
    hasHero,
    hasCTA,
    hasCards,
    hasImageSlot,
    hasHeadline,
    structureConfidence: Number(structureConfidence.toFixed(2)),
  };
};

export const rankStudentDecorateExamples = (input: {
  examples: StudentDecorateExamplePrompt[];
  structure: ReturnType<typeof inferStructureSignals>;
  outcomeHints?: Partial<Record<StudentDecorateExampleKind, StudentDecorateExampleOutcomeHint>>;
  isFreeMode?: boolean;
}) => {
  const reasons: string[] = [];
  const ranked = input.examples.map((example, index) => {
    let score = 0.35 - index * 0.02;
    if (example.kind === "button" && input.structure.hasCTA) score += 0.43;
    if (example.kind === "mood" && input.structure.hasCards) score += 0.34;
    if (example.kind === "headline" && (input.structure.hasHeadline || input.structure.hasHero)) score += 0.3;
    if (example.kind === "background" && input.structure.hasHero) score += 0.2;
    if (example.kind === "image") score += input.structure.hasImageSlot ? 0.29 : -0.22;
    if (example.kind === "section" && input.structure.hasCards) score += 0.24;
    if (input.structure.detectedTargetKinds.includes("cta_emphasis") && example.kind === "button") score += 0.12;
    if (input.structure.detectedTargetKinds.includes("card_tone") && (example.kind === "mood" || example.kind === "section")) score += 0.1;
    if (input.isFreeMode && (example.kind === "background" || example.kind === "headline")) score += 0.06;

    const hint = input.outcomeHints?.[example.kind];
    if (hint) {
      const outcomeSupport = (hint.selectionRate ?? 0) * 0.2 + (hint.successRate ?? 0) * 0.6 - (hint.lowImpactRate ?? 0) * 0.45;
      score += clamp(outcomeSupport, -0.08, 0.12);
    }

    return { ...example, score: Number(score.toFixed(3)) };
  }).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (input.structure.hasCTA) reasons.push("cta_present_button_priority");
  if (input.structure.hasCards) reasons.push("cards_present_tone_priority");
  if (input.structure.hasHero || input.structure.hasHeadline) reasons.push("hero_headline_priority");
  if (input.structure.hasImageSlot) reasons.push("image_slot_boost");
  if (!input.structure.hasImageSlot) reasons.push("image_example_demoted_without_slot");
  if (input.outcomeHints) reasons.push("outcome_hint_assist");

  return { ranked, rankingReasons: reasons.slice(0, 4) };
};

export const getStructureAwareStudentDecorateExamples = (input: StudentDecorateSuggestionContext = {}): StructureAwareStudentDecorateExamplesResult => {
  const limit = Math.min(5, Math.max(1, input.limit ?? 5));
  const baseExamples = getLessonAwareStudentDecorateExamples({ lessonId: input.lessonId, isFreeMode: input.isFreeMode, limit: 6 });
  const structure = inferStructureSignals(input.structureSignals);
  const { ranked, rankingReasons } = rankStudentDecorateExamples({
    examples: baseExamples,
    structure,
    outcomeHints: input.outcomeHints,
    isFreeMode: input.isFreeMode,
  });

  return {
    examples: ranked.slice(0, limit),
    guidanceCopy: getStudentDecorateInputGuidanceCopy({ lessonId: input.lessonId, isFreeMode: input.isFreeMode, structureSignals: structure }).support,
    rankingReasonSummary: rankingReasons,
    structureSignals: structure,
  };
};

export const getStudentDecorateExamplePrompts = (input: StudentDecorateSuggestionContext = {}) => {
  const limit = Math.min(5, Math.max(1, input.limit ?? 5));
  if (input.lessonId || input.isFreeMode || input.structureSignals) {
    return getStructureAwareStudentDecorateExamples(input).examples;
  }
  return STUDENT_DECORATE_EXAMPLE_PROMPTS.slice(0, limit);
};

export const getStudentDecorateInputGuidanceCopy = (input: Pick<StudentDecorateSuggestionContext, "lessonId" | "isFreeMode" | "structureSignals"> = {}) => {
  const structure = inferStructureSignals(input.structureSignals);
  const support = input.isFreeMode
    ? "원하는 스타일을 짧게 적거나 예시를 눌러 시작할 수 있어요."
    : structure.hasCTA || structure.hasCards
      ? "이 화면에 보이는 요소를 바꾸고 싶다면 예시를 눌러 시작할 수 있어요."
      : structure.hasHero || structure.hasHeadline
        ? "제목이나 배경처럼 잘 보이는 부분부터 바꿔볼 수 있어요."
        : "이 교시에 어울리는 예시를 눌러 시작해요.";
  return {
    placeholder: "바꾸고 싶은 내용을 적어보세요.",
    support,
    emptyHint: "예시를 눌러서 바로 시작할 수 있어요.",
  };
};

export const resolveStudentDecorateCtaModel = (input: {
  uiState: StudentDecorateUiState;
  canApplyPreview: boolean;
  inputValue: string;
}) => {
  const trimmed = input.inputValue.trim();
  if (input.uiState === "ready" && !input.canApplyPreview) {
    return {
      state: "idle" as const,
      mode: "start" as const,
      disabled: !trimmed,
      normalized: true,
      reason: "preview_not_applicable",
    };
  }
  if (input.uiState === "ready") {
    return {
      state: "ready" as const,
      mode: "apply" as const,
      disabled: false,
      normalized: false,
      reason: null,
    };
  }
  if (input.uiState === "sending") {
    return {
      state: "sending" as const,
      mode: "apply" as const,
      disabled: true,
      normalized: false,
      reason: null,
    };
  }
  if (input.uiState === "failed") {
    return {
      state: "failed" as const,
      mode: "start" as const,
      disabled: !trimmed,
      normalized: false,
      reason: null,
    };
  }
  return {
    state: "idle" as const,
    mode: "start" as const,
    disabled: !trimmed,
    normalized: false,
    reason: null,
  };
};

export const interpretStudentDecoratePrompt = (input: {
  prompt: string;
  intent: DecorateIntentSummary;
  styleIntent: DecorateStyleIntent;
}) => {
  const normalizedPromptClass = classifyStudentDecoratePromptClass({
    prompt: input.prompt,
    isAmbiguous: input.intent.isAmbiguous,
  });

  return {
    normalizedPromptClass,
    primaryIntent: input.intent.primaryIntent,
    styleIntent: input.styleIntent,
    confidence: Number((input.intent.confidence * 0.6 + (input.styleIntent === "none" ? 0.3 : 0.85) * 0.4).toFixed(2)),
  };
};

export const buildStudentPreviewSummary = (input: {
  plan: DecoratePlanV1;
  intent: DecorateIntentSummary;
  styleIntent: DecorateStyleIntent;
}) => {
  const opKinds = input.plan.ops.map((op) => op.op);
  const majorTargets: string[] = [];

  if (opKinds.includes("set_surface_background")) majorTargets.push("background");
  if (opKinds.includes("set_button_style") || opKinds.includes("set_accent_style")) majorTargets.push("button");
  if (opKinds.includes("set_text_emphasis") || opKinds.includes("emphasize_heading")) majorTargets.push("headline");
  if (opKinds.includes("set_card_style") || opKinds.includes("set_section_style")) majorTargets.push("section");
  if (opKinds.includes("insert_media")) majorTargets.push("image");

  const picked = majorTargets.slice(0, 2);
  const summaryKind = picked.join("_") || "general";
  const intentMatched = picked.length > 0 || !input.intent.isAmbiguous;

  const summary = picked[0] === "background"
    ? input.plan.ops.some((op) => op.op === "set_surface_background" && op.style.mode === "gradient")
      ? "배경을 그라데이션으로 바꿨어요."
      : "배경 분위기를 바꿨어요."
    : picked[0] === "button"
      ? "버튼이 더 잘 보이도록 강조했어요."
      : picked[0] === "headline"
        ? "제목이 더 잘 보이도록 다듬었어요."
        : picked[0] === "section"
          ? "카드와 섹션 분위기를 더 또렷하게 다듬었어요."
          : picked[0] === "image"
            ? "사진 자리 변경이 보이도록 미리보기를 만들었어요."
            : "바뀌는 내용을 미리보기로 준비했어요.";

  return {
    summary,
    summaryKind,
    majorTargets: picked,
    intentMatched,
  };
};


export const buildStudentOutcomeSummary = (input: {
  majorTargets: string[];
  lowImpactPreview: boolean;
}): string => {
  const major = input.majorTargets.slice(0, 2);
  if (input.lowImpactPreview) {
    if (major.includes("background")) return "배경과 분위기를 조금 더 정리했어요.";
    if (major.includes("button")) return "버튼이 더 잘 보이도록 조금 강조했어요.";
    if (major.includes("headline")) return "제목을 조금 더 읽기 쉽게 다듬었어요.";
    return "변경 내용을 안정적으로 미리보기로 준비했어요.";
  }
  if (major[0] === "background") return "배경을 더 또렷하게 바꿨어요.";
  if (major[0] === "button") return "버튼이 더 잘 보이도록 강조했어요.";
  if (major[0] === "headline") return "제목이 더 잘 보이도록 정리했어요.";
  if (major[0] === "section") return "제목과 분위기를 조금 더 정리했어요.";
  if (major[0] === "image") return "이미지 영역이 더 자연스럽게 보이도록 바꿨어요.";
  return "바뀌는 핵심만 미리보기에 반영했어요.";
};

export const inferStudentMajorTargetsFromPlan = (plan: DecoratePlanV1): string[] => {
  const opKinds = plan.ops.map((op) => op.op);
  const targets: string[] = [];
  if (opKinds.includes("set_surface_background") || opKinds.includes("set_surface_tone")) targets.push("background");
  if (opKinds.includes("set_button_style") || opKinds.includes("set_accent_style")) targets.push("button");
  if (opKinds.includes("set_text_emphasis") || opKinds.includes("emphasize_heading") || opKinds.includes("set_text_style")) targets.push("headline");
  if (opKinds.includes("set_card_style") || opKinds.includes("set_section_style")) targets.push("section");
  if (opKinds.includes("insert_media")) targets.push("image");
  return targets.slice(0, 2);
};

export const buildStudentResultConfidenceLine = (input: { majorTargets: string[]; lowImpactPreview: boolean }) => {
  const major = input.majorTargets;
  if (major.includes("background")) return input.lowImpactPreview ? "배경이 먼저 바뀌는 미리보기예요." : "배경이 눈에 띄게 바뀌어요.";
  if (major.includes("button") && major.includes("headline")) return "버튼과 제목이 잘 보이게 바뀌어요.";
  if (major.includes("button")) return "버튼이 더 잘 보이게 바뀌어요.";
  if (major.includes("headline")) return "제목이 더 잘 보이게 바뀌어요.";
  if (major.includes("image")) return "이미지 영역이 먼저 바뀌는 미리보기예요.";
  return "화면에서 먼저 보이는 부분부터 바뀌어요.";
};

export const getStudentDecorateResultCopy = (phase: StudentDecorateCopyPhase) => {
  if (phase === "preview_ready") return "미리보기가 준비됐어요.";
  if (phase === "apply_start") return "바뀐 내용을 적용하고 있어요.";
  return "바뀐 내용이 적용됐어요.";
};
