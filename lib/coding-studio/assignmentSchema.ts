import { LESSON_IDS, type LessonId } from "./types";

export const CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION = 1 as const;

export type CodingStudioAssignmentSource = "mock" | "local" | "future-sync";

export type CodingStudioAssignmentVisibility = "draft" | "visible";

export type CodingStudioAssignment = {
  schemaVersion: typeof CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION;
  assignmentId: string;
  title: string;
  subtitle: string;
  lessonIds: LessonId[];
  recommendedStartLessonId: LessonId;
  stageGroup?: string;
  classroom?: string;
  dueAt?: string | null;
  visibility?: CodingStudioAssignmentVisibility;
  teacherPrompt?: string;
  note?: string;
  source: CodingStudioAssignmentSource;
  createdAt: string;
  updatedAt: string;
};

function normalizeLessonIds(input: unknown): LessonId[] {
  if (!Array.isArray(input)) return [];
  return input.filter((id): id is LessonId => typeof id === "string" && LESSON_IDS.includes(id as LessonId));
}

function resolveFallbackStartLesson(lessonIds: LessonId[]): LessonId {
  return lessonIds[0] ?? "goal-move";
}

function resolveSource(input: unknown): CodingStudioAssignmentSource {
  return input === "mock" || input === "local" || input === "future-sync" ? input : "local";
}

export function parseCodingStudioAssignment(input: unknown): CodingStudioAssignment | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<CodingStudioAssignment>;
  if (candidate.schemaVersion !== CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION) return null;
  if (typeof candidate.assignmentId !== "string" || !candidate.assignmentId.trim()) return null;
  if (typeof candidate.title !== "string" || !candidate.title.trim()) return null;

  const lessonIds = normalizeLessonIds(candidate.lessonIds);
  const recommendedStartLessonId =
    typeof candidate.recommendedStartLessonId === "string" && lessonIds.includes(candidate.recommendedStartLessonId as LessonId)
      ? (candidate.recommendedStartLessonId as LessonId)
      : resolveFallbackStartLesson(lessonIds);

  return {
    schemaVersion: CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION,
    assignmentId: candidate.assignmentId,
    title: candidate.title,
    subtitle: typeof candidate.subtitle === "string" ? candidate.subtitle : "",
    lessonIds,
    recommendedStartLessonId,
    stageGroup: typeof candidate.stageGroup === "string" ? candidate.stageGroup : undefined,
    classroom: typeof candidate.classroom === "string" ? candidate.classroom : undefined,
    dueAt: typeof candidate.dueAt === "string" ? candidate.dueAt : null,
    visibility: candidate.visibility === "draft" || candidate.visibility === "visible" ? candidate.visibility : "visible",
    teacherPrompt: typeof candidate.teacherPrompt === "string" ? candidate.teacherPrompt : undefined,
    note: typeof candidate.note === "string" ? candidate.note : undefined,
    source: resolveSource(candidate.source),
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date(0).toISOString(),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date(0).toISOString(),
  };
}

export function migrateLegacyAssignment(input: unknown): CodingStudioAssignment | null {
  if (!input || typeof input !== "object") return null;
  const legacy = input as {
    id?: unknown;
    title?: unknown;
    subtitle?: unknown;
    lessonIds?: unknown;
    source?: unknown;
  };
  if (typeof legacy.id !== "string" || typeof legacy.title !== "string") return null;

  const lessonIds = normalizeLessonIds(legacy.lessonIds);
  const now = new Date(0).toISOString();
  return parseCodingStudioAssignment({
    schemaVersion: CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION,
    assignmentId: legacy.id,
    title: legacy.title,
    subtitle: typeof legacy.subtitle === "string" ? legacy.subtitle : "",
    lessonIds,
    recommendedStartLessonId: resolveFallbackStartLesson(lessonIds),
    source: resolveSource(legacy.source),
    createdAt: now,
    updatedAt: now,
  });
}
