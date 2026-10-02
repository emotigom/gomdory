import type { LessonCard } from "./lessonListOrdering";
import type { LessonProgressState } from "./lessonListProgress";

const FALLBACK_LESSON_TITLE_PREFIX = "교시";
const FALLBACK_CORE_PREVIEW = "이 교시 활동을 살펴보고 시작해요.";
const FALLBACK_FREE_MODE_PREVIEW = "원하는 내용을 처음부터 자유롭게 만들 수 있어요.";

const LESSON_ICON_BY_ID: Record<number, string> = {
  0: "sparkles",
  1: "profile",
  2: "search",
  3: "game",
  4: "gallery",
};

const LESSON_VISUAL_VARIANT_BY_ID: Record<number, string> = {
  0: "free",
  1: "identity",
  2: "explore",
  3: "play",
  4: "showcase",
};

const LESSON_PREVIEW_BY_ID: Record<number, string> = {
  0: "원하는 내용을 처음부터 자유롭게 만들 수 있어요.",
  1: "나를 소개하는 첫 페이지를 만들어요.",
  2: "좋아하는 주제를 정리하고 소개해요.",
  3: "간단한 상호작용이나 게임 요소를 넣어봐요.",
  4: "완성한 결과물을 보기 좋게 정리해요.",
};

const LESSON_OUTCOME_HINTS_BY_ID: Record<number, readonly string[]> = {
  0: ["빈 캔버스", "자유 구성"],
  1: ["프로필 카드", "짧은 소개"],
  2: ["관심 주제", "탐색 정리"],
  3: ["미니 인터랙션", "게임 흐름"],
  4: ["작품 쇼케이스", "전시 구성"],
};

const LESSON_OUTCOME_A11Y_SUMMARY_BY_ID: Record<number, string> = {
  0: "빈 캔버스에서 자유 시작",
  1: "자기소개 결과물",
  2: "관심사 탐색 결과물",
  3: "상호작용 결과물",
  4: "전시형 결과물",
};

const FALLBACK_OUTCOME_HINTS = ["결과 미리보기", "직접 구성"] as const;

export type LessonMiniPreviewKind =
  | "profile_card"
  | "topic_map"
  | "interactive_play"
  | "showcase_board"
  | "blank_canvas"
  | "generic";

type LessonStatusCopyInput = {
  progressState: LessonProgressState;
  isFreeMode?: boolean;
};

type LessonStatusCopy = {
  badge: string | null;
  cue: string | null;
  a11yStatus: string;
};

export type LessonIconName = "profile" | "search" | "game" | "gallery" | "sparkles" | "default";

export type LessonVisualVariant = "identity" | "explore" | "play" | "showcase" | "free" | "default";

export function normalizeLessonTitle(lesson: LessonCard): string {
  const trimmed = lesson.title?.trim();
  if (trimmed) return trimmed;
  if (lesson.id === 0) return "자유모드 · 빈 페이지";
  return `${lesson.id}${FALLBACK_LESSON_TITLE_PREFIX}`;
}

export function resolveActiveLessonId(pathname: string | null): number | null {
  if (!pathname) return null;
  const match = pathname.match(/\/edu\/lesson\/(\d+)/);
  if (!match) return null;
  const lessonId = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(lessonId)) return null;
  return lessonId;
}

export function getLessonPreviewCopy(lesson: LessonCard): string {
  const preview = LESSON_PREVIEW_BY_ID[lesson.id];
  if (preview) return preview;
  return lesson.id === 0 ? FALLBACK_FREE_MODE_PREVIEW : FALLBACK_CORE_PREVIEW;
}

export function getLessonOutcomeHints(lesson: LessonCard): readonly string[] {
  return LESSON_OUTCOME_HINTS_BY_ID[lesson.id] ?? FALLBACK_OUTCOME_HINTS;
}

export function getLessonMiniPreviewKind(lesson: LessonCard): LessonMiniPreviewKind {
  switch (lesson.id) {
    case 0:
      return "blank_canvas";
    case 1:
      return "profile_card";
    case 2:
      return "topic_map";
    case 3:
      return "interactive_play";
    case 4:
      return "showcase_board";
    default:
      return "generic";
  }
}

export function getLessonIconName(lesson: LessonCard): LessonIconName {
  const icon = LESSON_ICON_BY_ID[lesson.id];
  if (icon === "profile" || icon === "search" || icon === "game" || icon === "gallery" || icon === "sparkles") {
    return icon;
  }
  return "default";
}

export function getLessonVisualVariant(lesson: LessonCard): LessonVisualVariant {
  const variant = LESSON_VISUAL_VARIANT_BY_ID[lesson.id];
  if (variant === "identity" || variant === "explore" || variant === "play" || variant === "showcase" || variant === "free") {
    return variant;
  }
  return "default";
}

export function getLessonIconSymbol(iconName: LessonIconName): string {
  switch (iconName) {
    case "profile":
      return "◔";
    case "search":
      return "⌕";
    case "game":
      return "✦";
    case "gallery":
      return "▣";
    case "sparkles":
      return "✧";
    default:
      return "•";
  }
}

export function getLessonStatusCopy(input: LessonStatusCopyInput): LessonStatusCopy {
  const { progressState, isFreeMode = false } = input;

  switch (progressState) {
    case "current":
      return { badge: "현재", cue: null, a11yStatus: "현재 진행 중" };
    case "recommended_next":
      return { badge: "다음 추천", cue: "이어서 하기", a11yStatus: "다음 추천" };
    case "visited":
      return {
        badge: null,
        cue: isFreeMode ? "이어서 만들기" : "다시 보기",
        a11yStatus: "방문함",
      };
    default:
      return {
        badge: null,
        cue: isFreeMode ? "자유롭게 시작하기" : "시작하기",
        a11yStatus: "미방문",
      };
  }
}

export function getLessonCardA11yLabel(input: {
  lesson: LessonCard;
  progressState: LessonProgressState;
  includePreview?: boolean;
  includeOutcomeSummary?: boolean;
  isFreeMode?: boolean;
}): string {
  const { lesson, progressState, includePreview = true, includeOutcomeSummary = true, isFreeMode = false } = input;
  const title = normalizeLessonTitle(lesson);
  const preview = includePreview ? getLessonPreviewCopy(lesson) : "";
  const outcomeSummary = includeOutcomeSummary ? (LESSON_OUTCOME_A11Y_SUMMARY_BY_ID[lesson.id] ?? "교시 결과물 미리보기") : "";
  const status = getLessonStatusCopy({ progressState, isFreeMode });
  return [title, status.a11yStatus, outcomeSummary, preview].filter(Boolean).join(" - ");
}
