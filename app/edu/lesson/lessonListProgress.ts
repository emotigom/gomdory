import type { LessonCard } from "./lessonListOrdering";

export type LessonProgressState = "current" | "visited" | "recommended_next" | "default";

const CORE_LESSON_IDS = [1, 2, 3, 4] as const;

function getCoreLessonRank(id: number): number {
  const index = CORE_LESSON_IDS.indexOf(id as (typeof CORE_LESSON_IDS)[number]);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

export function getOrderedCoreLessonIds(lessons: LessonCard[]): number[] {
  return lessons
    .map((lesson) => lesson.id)
    .filter((id) => id > 0)
    .sort((a, b) => {
      const rankDiff = getCoreLessonRank(a) - getCoreLessonRank(b);
      return rankDiff !== 0 ? rankDiff : a - b;
    });
}

export function resolveRecommendedLessonId(input: {
  orderedCoreLessonIds: number[];
  activeLessonId: number | null;
}): number | null {
  const { orderedCoreLessonIds, activeLessonId } = input;
  if (orderedCoreLessonIds.length === 0) return null;
  if (activeLessonId === null || !orderedCoreLessonIds.includes(activeLessonId)) {
    return orderedCoreLessonIds[0] ?? null;
  }

  const currentIndex = orderedCoreLessonIds.indexOf(activeLessonId);
  if (currentIndex < 0) return orderedCoreLessonIds[0] ?? null;

  return orderedCoreLessonIds[currentIndex + 1] ?? null;
}

export function resolveLessonProgressState(input: {
  lessonId: number;
  activeLessonId: number | null;
  recommendedLessonId: number | null;
  visitedLessonIds: Set<number>;
}): LessonProgressState {
  const { lessonId, activeLessonId, recommendedLessonId, visitedLessonIds } = input;

  if (activeLessonId === lessonId) return "current";
  if (recommendedLessonId === lessonId) return "recommended_next";
  if (visitedLessonIds.has(lessonId)) return "visited";
  return "default";
}

export function getProgressA11yLabel(state: LessonProgressState): string {
  switch (state) {
    case "current":
      return "현재 교시";
    case "recommended_next":
      return "다음 추천 교시";
    case "visited":
      return "방문함";
    default:
      return "미방문";
  }
}
