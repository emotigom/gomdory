export type LessonEntryState = "first_entry" | "resume_entry" | "free_mode_entry" | "revisit_entry";

export type LessonEntryContext = {
  lessonId: number;
  wasVisited: boolean;
  hasSavedProgress: boolean;
  isFreeMode: boolean;
};

export type LessonEntryGuidanceCopy = {
  eyebrow: string;
  title: string;
  support: string;
  continuity: string | null;
};

export type LessonHeaderStatus = {
  chipLabel: string;
  metadata: string | null;
};

const CORE_LESSON_IDS = [1, 2, 3, 4] as const;

const FIRST_ACTION_HINT_BY_LESSON_ID: Record<number, string> = {
  0: "빈 페이지에 첫 문장이나 제목부터 바로 적어보세요.",
  1: "나를 소개할 핵심 내용 한 줄부터 적어보세요.",
  2: "관심 있는 주제나 소재를 하나 먼저 정해보세요.",
  3: "넣고 싶은 퀴즈나 상호작용 아이디어를 먼저 적어보세요.",
  4: "보여주고 싶은 결과물 순서를 먼저 간단히 정리해보세요.",
};

export function resolveLessonEntryState(context: LessonEntryContext): LessonEntryState {
  const { isFreeMode, wasVisited, hasSavedProgress } = context;

  if (isFreeMode) return "free_mode_entry";
  if (!wasVisited) return "first_entry";
  if (hasSavedProgress) return "resume_entry";
  return "revisit_entry";
}

export function resolveRecommendedCoreLessonId(visitedLessonIds: Set<number>): number | null {
  for (const lessonId of CORE_LESSON_IDS) {
    if (!visitedLessonIds.has(lessonId)) {
      return lessonId;
    }
  }
  return null;
}

export function getLessonFirstActionHint(lessonId: number): string {
  return FIRST_ACTION_HINT_BY_LESSON_ID[lessonId] ?? "이번 교시 목표에 맞는 핵심 한 줄부터 시작해보세요.";
}

export function getLessonEntryGuidanceCopy(input: {
  lessonId: number;
  entryState: LessonEntryState;
  isRecommended: boolean;
}): LessonEntryGuidanceCopy {
  const { lessonId, entryState, isRecommended } = input;

  if (entryState === "free_mode_entry") {
    return {
      eyebrow: "자유 시작",
      title: "빈 페이지에서 원하는 방식으로 바로 시작할 수 있어요.",
      support: "정해진 순서 없이 필요한 요소부터 직접 구성해보세요.",
      continuity: null,
    };
  }

  if (entryState === "resume_entry") {
    return {
      eyebrow: "이어하기",
      title: "이전에 하던 흐름을 이어서 차분하게 정리해요.",
      support: "저장된 작업을 바탕으로 필요한 부분부터 이어가면 돼요.",
      continuity: null,
    };
  }

  if (entryState === "revisit_entry") {
    return {
      eyebrow: "다시 보기",
      title: "이 교시를 다시 열었어요.",
      support: "핵심만 빠르게 점검하고 필요한 부분부터 손봐도 좋아요.",
      continuity: null,
    };
  }

  return {
    eyebrow: "교시 시작",
    title: "이번 교시 목표에 맞는 결과물을 차근차근 만들어요.",
    support: "아래 첫 행동 힌트로 시작하면 흐름을 잡기 쉬워요.",
    continuity: isRecommended && lessonId > 0 ? "지금 시작하기 좋은 추천 교시에요." : null,
  };
}

export function getLessonWorkspaceContext(lessonId: number): string {
  switch (lessonId) {
    case 0:
      return "빈 페이지에서 원하는 내용을 자유롭게 시작할 수 있어요.";
    case 1:
      return "소개 페이지를 만들며 나를 한눈에 보여주는 공간이에요.";
    case 2:
      return "관심 주제를 정리하고 전달 흐름을 잡는 교시예요.";
    case 3:
      return "퀴즈나 미니게임 아이디어를 시험해볼 수 있는 교시예요.";
    case 4:
      return "작품을 보기 좋게 정리해 발표 흐름을 완성하는 교시예요.";
    default:
      return "현재 교시 목표에 맞는 결과물을 만드는 작업 공간이에요.";
  }
}

export function getLessonHeaderStatus(input: {
  entryState: LessonEntryState;
  isRecommended: boolean;
}): LessonHeaderStatus {
  const { entryState, isRecommended } = input;

  if (entryState === "free_mode_entry") {
    return { chipLabel: "자유 시작", metadata: null };
  }

  if (entryState === "resume_entry") {
    return { chipLabel: "이어서 작업", metadata: null };
  }

  if (entryState === "revisit_entry") {
    return { chipLabel: "다시 보기", metadata: null };
  }

  return {
    chipLabel: "현재 교시",
    metadata: isRecommended ? "추천 흐름에서 바로 시작한 교시예요." : null,
  };
}

export function getLessonStepLabel(lessonId: number): string {
  return lessonId === 0 ? "자유모드" : `${lessonId}교시`;
}

export function getLessonEntryA11ySummary(input: {
  lessonStepLabel: string;
  lessonTitle: string;
  entryState: LessonEntryState;
  workspaceContext: string;
  firstActionHint: string;
}): string {
  const { lessonStepLabel, lessonTitle, entryState, workspaceContext, firstActionHint } = input;

  const stateLabel =
    entryState === "free_mode_entry"
      ? "자유 시작"
      : entryState === "resume_entry"
        ? "이어하기"
        : entryState === "revisit_entry"
          ? "재방문"
          : "첫 시작";

  return `${lessonStepLabel} ${lessonTitle}. ${stateLabel}. 공간 안내: ${workspaceContext} 첫 행동: ${firstActionHint}`;
}
