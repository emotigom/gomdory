import { completeLessonProgression, resolveSafeCurrentLesson, resolveUnlockedLessonIds } from "./lessons";
import { CODING_STUDIO_PROGRESSION_SCHEMA_VERSION, LESSON_IDS, type CodingStudioProgressionState, type LessonId } from "./types";

const PROGRESSION_STORAGE_KEY = "gomdoryedu.coding-studio.progression.v1";

export function createInitialProgressionState(): CodingStudioProgressionState {
  const completedLessonIds: LessonId[] = [];
  const unlockedLessonIds = resolveUnlockedLessonIds(completedLessonIds);
  return {
    schemaVersion: CODING_STUDIO_PROGRESSION_SCHEMA_VERSION,
    currentLessonId: unlockedLessonIds[0] ?? "goal-move",
    completedLessonIds,
    unlockedLessonIds,
    updatedAt: new Date(0).toISOString(),
  };
}

export function parseProgressionState(input: unknown): CodingStudioProgressionState | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<CodingStudioProgressionState>;
  if (candidate.schemaVersion !== CODING_STUDIO_PROGRESSION_SCHEMA_VERSION) return null;
  if (!Array.isArray(candidate.completedLessonIds) || !Array.isArray(candidate.unlockedLessonIds)) return null;
  const completedLessonIds = candidate.completedLessonIds.filter((id): id is LessonId => typeof id === "string" && LESSON_IDS.includes(id as LessonId));
  const unlockedLessonIds = resolveUnlockedLessonIds(completedLessonIds);
  const currentLessonId = resolveSafeCurrentLesson({
    currentLessonId:
      typeof candidate.currentLessonId === "string" && LESSON_IDS.includes(candidate.currentLessonId as LessonId)
        ? (candidate.currentLessonId as LessonId)
        : null,
    unlockedLessonIds,
  });
  return {
    schemaVersion: CODING_STUDIO_PROGRESSION_SCHEMA_VERSION,
    currentLessonId,
    completedLessonIds,
    unlockedLessonIds,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date(0).toISOString(),
  };
}

export function loadCodingStudioProgression(): CodingStudioProgressionState {
  if (typeof window === "undefined") return createInitialProgressionState();
  const raw = window.localStorage.getItem(PROGRESSION_STORAGE_KEY);
  if (!raw) return createInitialProgressionState();
  try {
    const parsed = parseProgressionState(JSON.parse(raw));
    return parsed ?? createInitialProgressionState();
  } catch {
    return createInitialProgressionState();
  }
}

export function saveCodingStudioProgression(state: CodingStudioProgressionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(state));
}

export function markLessonCompleted(state: CodingStudioProgressionState, lessonId: LessonId): CodingStudioProgressionState {
  const next = completeLessonProgression({ state, lessonId });
  saveCodingStudioProgression(next);
  return next;
}

export function updateCurrentLesson(state: CodingStudioProgressionState, lessonId: LessonId): CodingStudioProgressionState {
  const currentLessonId = resolveSafeCurrentLesson({
    currentLessonId: lessonId,
    unlockedLessonIds: state.unlockedLessonIds,
  });
  const next = {
    ...state,
    currentLessonId,
    updatedAt: new Date().toISOString(),
  };
  saveCodingStudioProgression(next);
  return next;
}
