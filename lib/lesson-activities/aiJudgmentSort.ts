import type { LessonActivityType } from "@/lib/lesson-activities/registry";

export const AI_JUDGMENT_SORT_ACTIVITY_TYPE = "ai_judgment_sort" satisfies LessonActivityType;
export const AI_JUDGMENT_SORT_CONFIG_VERSION = 1;
export const AI_JUDGMENT_SORT_REASON_MAX_LENGTH = 160;
export const AI_JUDGMENT_SORT_DISCUSSION_SPLIT_THRESHOLD = 0.6;

export const AI_JUDGMENT_SORT_CATEGORY_IDS = [
  "ai_good",
  "human_needed",
  "collaboration",
] as const;

export type JudgmentSortCategoryId = (typeof AI_JUDGMENT_SORT_CATEGORY_IDS)[number];

export type JudgmentSortCategory = {
  id: JudgmentSortCategoryId;
  label: string;
  shortLabel: string;
  description: string;
};

export type JudgmentSortCard = {
  id: string;
  title: string;
  situation: string;
  recommendedCategory: JudgmentSortCategoryId;
  teacherExplanation: string;
  discussionPrompt?: string;
};

export type AiJudgmentSortConfig = {
  version: typeof AI_JUDGMENT_SORT_CONFIG_VERSION;
  categories: JudgmentSortCategory[];
  cards: JudgmentSortCard[];
};

export type JudgmentSortCardState = {
  cardId: string;
  category: JudgmentSortCategoryId | null;
  reason: string;
};

export type AiJudgmentSortState = {
  activityType: typeof AI_JUDGMENT_SORT_ACTIVITY_TYPE;
  version: typeof AI_JUDGMENT_SORT_CONFIG_VERSION;
  cards: JudgmentSortCardState[];
  submitted: boolean;
  completed: boolean;
  updatedAt: string;
};

export type JudgmentSortTeacherSummary = {
  activityRunId: string;
  activityTitle: "AI 판단 카드 분류";
  participantCount: number;
  submittedCount: number;
  cards: Array<{
    cardId: string;
    title: string;
    recommendedCategory: JudgmentSortCategoryId;
    distribution: Record<JudgmentSortCategoryId, number>;
    responseCount: number;
    topCategory: JudgmentSortCategoryId | null;
    topRatio: number;
    discussionRecommended: boolean;
    teacherExplanation: string;
    discussionPrompt?: string;
  }>;
  recentReasons: Array<{
    id: string;
    displayName: string;
    cardTitle: string;
    categoryLabel: string;
    reason: string;
    updatedAt: string;
  }>;
};

export const AI_JUDGMENT_SORT_CATEGORIES: JudgmentSortCategory[] = [
  {
    id: "ai_good",
    label: "AI가 잘하는 일",
    shortLabel: "AI가 잘함",
    description: "데이터가 많고 반복되는 일을 빠르게 처리해요.",
  },
  {
    id: "human_needed",
    label: "사람의 판단이 필요한 일",
    shortLabel: "사람 판단",
    description: "책임, 감정, 윤리, 공감이 중요해요.",
  },
  {
    id: "collaboration",
    label: "AI와 사람이 함께하면 좋은 일",
    shortLabel: "협력",
    description: "AI가 도와주고, 마지막 판단은 사람이 해요.",
  },
];

export const LESSON_2_AI_JUDGMENT_SORT_CARDS: JudgmentSortCard[] = [
  {
    id: "youtube_recommendation",
    title: "유튜브가 내 취향에 맞는 영상을 추천한다.",
    situation: "유튜브가 내 취향에 맞는 영상을 추천한다.",
    recommendedCategory: "ai_good",
    teacherExplanation: "많은 시청 기록에서 반복되는 패턴을 빠르게 찾는 추천은 AI가 잘 도와줄 수 있습니다.",
  },
  {
    id: "doctor_surgery_decision",
    title: "의사가 환자에게 수술 여부를 결정한다.",
    situation: "의사가 환자에게 수술 여부를 결정한다.",
    recommendedCategory: "human_needed",
    teacherExplanation: "AI가 자료를 정리해도 생명과 책임이 걸린 최종 결정과 설명은 의료 전문가의 판단이 필요합니다.",
    discussionPrompt: "AI가 검사 결과를 정리해 주더라도 최종 책임은 누가 져야 할까요?",
  },
  {
    id: "factory_defect_sort",
    title: "공장에서 불량 제품을 자동으로 골라낸다.",
    situation: "공장에서 불량 제품을 자동으로 골라낸다.",
    recommendedCategory: "ai_good",
    teacherExplanation: "반복되는 제품 이미지를 많이 비교해 빠르게 분류하는 일은 AI가 강점을 보이는 영역입니다.",
  },
  {
    id: "judge_sentence",
    title: "판사가 범죄자의 형량을 결정한다.",
    situation: "판사가 범죄자의 형량을 결정한다.",
    recommendedCategory: "human_needed",
    teacherExplanation: "형량 결정은 공정성, 맥락, 책임, 윤리 판단이 중요하므로 사람의 최종 판단이 필요합니다.",
    discussionPrompt: "AI가 판례를 정리해도 최종 책임 있는 결정은 누가 해야 할까요?",
  },
  {
    id: "spam_filter",
    title: "스팸 메일을 자동으로 차단한다.",
    situation: "스팸 메일을 자동으로 차단한다.",
    recommendedCategory: "ai_good",
    teacherExplanation: "반복되는 메일 패턴과 많은 데이터를 빠르게 비교하는 일이어서 AI가 잘 도와줄 수 있습니다.",
  },
  {
    id: "counselor_conversation",
    title: "심리 상담사가 힘든 마음을 털어놓은 사람과 대화한다.",
    situation: "심리 상담사가 힘든 마음을 털어놓은 사람과 대화한다.",
    recommendedCategory: "human_needed",
    teacherExplanation: "공감, 안전, 책임 있는 보호가 중요하므로 사람이 상황을 살피고 대화해야 합니다.",
    discussionPrompt: "AI가 위로 문장을 제안할 수는 있지만, 힘든 마음을 털어놓은 사람의 안전은 누가 함께 확인해야 할까요?",
  },
  {
    id: "navigation_shortest_route",
    title: "내비게이션이 최단 경로를 계산한다.",
    situation: "내비게이션이 최단 경로를 계산한다.",
    recommendedCategory: "ai_good",
    teacherExplanation: "지도와 교통 데이터를 빠르게 계산하고 비교하는 일은 AI와 알고리즘이 잘하는 일입니다.",
  },
  {
    id: "teacher_student_advice",
    title: "선생님이 학생의 의견을 직접 듣고 조언한다.",
    situation: "선생님이 학생의 의견을 직접 듣고 조언한다.",
    recommendedCategory: "human_needed",
    teacherExplanation: "학생의 맥락을 듣고 공감하며 책임 있게 조언하는 일은 사람의 판단이 중요합니다.",
  },
  {
    id: "xray_anomaly",
    title: "AI가 X-ray 사진에서 이상 부위를 표시한다.",
    situation: "AI가 X-ray 사진에서 이상 부위를 표시한다.",
    recommendedCategory: "collaboration",
    teacherExplanation: "AI는 많은 의료 이미지에서 의심 지점을 빠르게 표시할 수 있지만 진단과 책임 있는 설명은 의료 전문가가 맡아야 합니다.",
    discussionPrompt: "AI가 이상 부위를 표시했을 때, 마지막 진단과 설명은 누가 해야 할까요?",
  },
  {
    id: "rescue_priority",
    title: "사고 현장에서 누구를 먼저 구조할지 판단한다.",
    situation: "사고 현장에서 누구를 먼저 구조할지 판단한다.",
    recommendedCategory: "collaboration",
    teacherExplanation: "AI가 정보를 빠르게 정리해 도울 수는 있지만, 새롭고 복잡한 현장에서 윤리와 책임이 따르는 판단은 사람이 맡아야 합니다.",
    discussionPrompt: "AI의 정보 정리가 도움이 되어도 구조 우선순위의 최종 책임은 누가 져야 할까요?",
  },
  {
    id: "robot_coffee_order",
    title: "로봇이 커피 주문을 받는다.",
    situation: "로봇이 커피 주문을 받는다.",
    recommendedCategory: "ai_good",
    teacherExplanation: "정해진 메뉴와 반복되는 주문 접수는 AI와 자동화가 빠르고 정확하게 처리하기 좋은 일입니다.",
  },
  {
    id: "online_translation",
    title: "온라인 번역기가 영어 문장을 한국어로 번역한다.",
    situation: "온라인 번역기가 영어 문장을 한국어로 번역한다.",
    recommendedCategory: "ai_good",
    teacherExplanation: "많은 언어 데이터의 패턴을 바탕으로 문장을 빠르게 바꾸는 일은 AI가 잘 도와줄 수 있습니다. 중요한 문맥은 사람이 확인하면 더 좋습니다.",
  },
];

export function buildLesson2AiJudgmentSortConfig(): AiJudgmentSortConfig {
  return {
    version: AI_JUDGMENT_SORT_CONFIG_VERSION,
    categories: AI_JUDGMENT_SORT_CATEGORIES,
    cards: LESSON_2_AI_JUDGMENT_SORT_CARDS,
  };
}

export function isJudgmentSortCategoryId(value: unknown): value is JudgmentSortCategoryId {
  return typeof value === "string" && (AI_JUDGMENT_SORT_CATEGORY_IDS as readonly string[]).includes(value);
}

export function normalizeJudgmentSortReason(reason: unknown): string {
  if (typeof reason !== "string") return "";
  return reason.replace(/<[^>]*>/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

export function buildInitialAiJudgmentSortState(
  activityRunId: string,
  participantKey: string,
): AiJudgmentSortState {
  void activityRunId;
  void participantKey;
  return {
    activityType: AI_JUDGMENT_SORT_ACTIVITY_TYPE,
    version: AI_JUDGMENT_SORT_CONFIG_VERSION,
    cards: LESSON_2_AI_JUDGMENT_SORT_CARDS.map((card) => ({
      cardId: card.id,
      category: null,
      reason: "",
    })),
    submitted: false,
    completed: false,
    updatedAt: new Date().toISOString(),
  };
}

export function isAiJudgmentSortConfig(value: unknown): value is AiJudgmentSortConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<AiJudgmentSortConfig>;
  return candidate.version === AI_JUDGMENT_SORT_CONFIG_VERSION
    && Array.isArray(candidate.categories)
    && candidate.categories.every((category) => category && isJudgmentSortCategoryId((category as JudgmentSortCategory).id))
    && Array.isArray(candidate.cards)
    && candidate.cards.every((card) => {
      const candidateCard = card as Partial<JudgmentSortCard>;
      return typeof candidateCard.id === "string"
        && typeof candidateCard.title === "string"
        && typeof candidateCard.situation === "string"
        && isJudgmentSortCategoryId(candidateCard.recommendedCategory);
    });
}

export function judgmentCardExistsInConfig(config: AiJudgmentSortConfig, cardId: string): boolean {
  return config.cards.some((card) => card.id === cardId);
}

export function validateJudgmentCardPlacement(config: AiJudgmentSortConfig, cardId: string, category: unknown): JudgmentSortCategoryId {
  if (!judgmentCardExistsInConfig(config, cardId)) throw new Error("활동 카드에 없는 항목입니다.");
  if (!isJudgmentSortCategoryId(category)) throw new Error("분류할 수 없는 영역입니다.");
  return category;
}

export function calculateJudgmentSortCompletion(state: Pick<AiJudgmentSortState, "cards" | "submitted">): boolean {
  return state.submitted && state.cards.length === LESSON_2_AI_JUDGMENT_SORT_CARDS.length && state.cards.every((card) => Boolean(card.category));
}

export function normalizeJudgmentSortState(value: unknown, fallback: AiJudgmentSortState): AiJudgmentSortState {
  const fallbackById = new Map(fallback.cards.map((card) => [card.cardId, card]));
  const incomingCards = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<AiJudgmentSortState>).cards
    : null;
  const incomingById = new Map<string, Partial<JudgmentSortCardState>>();
  if (Array.isArray(incomingCards)) {
    incomingCards.forEach((card) => {
      if (card && typeof card.cardId === "string" && fallbackById.has(card.cardId)) incomingById.set(card.cardId, card);
    });
  }
  const normalizedCards = fallback.cards.map((fallbackCard) => {
    const incoming = incomingById.get(fallbackCard.cardId);
    const normalizedReason = normalizeJudgmentSortReason(incoming?.reason).slice(0, AI_JUDGMENT_SORT_REASON_MAX_LENGTH);
    return {
      cardId: fallbackCard.cardId,
      category: isJudgmentSortCategoryId(incoming?.category) ? incoming.category : null,
      reason: normalizedReason,
    };
  });
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<AiJudgmentSortState> : {};
  const submitted = Boolean(candidate.submitted);
  const normalized = {
    activityType: AI_JUDGMENT_SORT_ACTIVITY_TYPE,
    version: AI_JUDGMENT_SORT_CONFIG_VERSION,
    cards: normalizedCards,
    submitted,
    completed: false,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : fallback.updatedAt,
  } satisfies AiJudgmentSortState;
  return { ...normalized, completed: calculateJudgmentSortCompletion(normalized) };
}

export function summarizeJudgmentSortForTeacher(params: {
  activityRunId: string;
  config: AiJudgmentSortConfig;
  rows: Array<{ id: string; displayName: string | null; state: unknown; status: string; updatedAt: string }>;
}): JudgmentSortTeacherSummary {
  const categoryLabels = new Map(params.config.categories.map((category) => [category.id, category.shortLabel]));
  const fallback = buildInitialAiJudgmentSortState(params.activityRunId, "teacher-summary");
  const cardSummaries = params.config.cards.map((card) => ({
    cardId: card.id,
    title: card.title,
    recommendedCategory: card.recommendedCategory,
    distribution: { ai_good: 0, human_needed: 0, collaboration: 0 } as Record<JudgmentSortCategoryId, number>,
    responseCount: 0,
    topCategory: null as JudgmentSortCategoryId | null,
    topRatio: 0,
    discussionRecommended: false,
    teacherExplanation: card.teacherExplanation,
    discussionPrompt: card.discussionPrompt,
  }));
  const cardsById = new Map(cardSummaries.map((card) => [card.cardId, card]));
  const titlesById = new Map(params.config.cards.map((card) => [card.id, card.title]));
  const recentReasons: JudgmentSortTeacherSummary["recentReasons"] = [];

  params.rows.forEach((row) => {
    const state = normalizeJudgmentSortState(row.state, fallback);
    state.cards.forEach((cardState) => {
      if (!cardState.category) return;
      const summary = cardsById.get(cardState.cardId);
      if (!summary) return;
      summary.distribution[cardState.category] += 1;
      summary.responseCount += 1;
      if (cardState.reason) {
        recentReasons.push({
          id: `${row.id}:${cardState.cardId}`,
          displayName: row.displayName || "익명 학생",
          cardTitle: titlesById.get(cardState.cardId) ?? cardState.cardId,
          categoryLabel: categoryLabels.get(cardState.category) ?? cardState.category,
          reason: cardState.reason,
          updatedAt: row.updatedAt,
        });
      }
    });
  });

  cardSummaries.forEach((card) => {
    const entries = Object.entries(card.distribution) as Array<[JudgmentSortCategoryId, number]>;
    const [topCategory, topCount] = entries.sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    card.topCategory = topCount > 0 ? topCategory : null;
    card.topRatio = card.responseCount > 0 ? topCount / card.responseCount : 0;
    card.discussionRecommended = card.responseCount >= 2 && card.topRatio < AI_JUDGMENT_SORT_DISCUSSION_SPLIT_THRESHOLD;
  });
  recentReasons.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    activityRunId: params.activityRunId,
    activityTitle: "AI 판단 카드 분류",
    participantCount: params.rows.length,
    submittedCount: params.rows.filter((row) => row.status === "completed" || normalizeJudgmentSortState(row.state, fallback).submitted).length,
    cards: cardSummaries,
    recentReasons: recentReasons.slice(0, 8),
  };
}
