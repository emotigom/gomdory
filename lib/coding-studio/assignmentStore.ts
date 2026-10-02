import { getNextLessonId } from "./lessons";
import {
  CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION,
  migrateLegacyAssignment,
  parseCodingStudioAssignment,
  type CodingStudioAssignment,
} from "./assignmentSchema";
import { LESSON_IDS, type LessonId } from "./types";

const ASSIGNMENTS_STORAGE_KEY = "gomdoryedu.coding-studio.assignments.v1";
const ASSIGNMENT_RESUME_STORAGE_KEY = "gomdoryedu.coding-studio.assignment-resume.v1";

export const CODING_STUDIO_ASSIGNMENT_RESUME_SCHEMA_VERSION = 1 as const;

export type CodingStudioAssignmentResumeState = {
  schemaVersion: typeof CODING_STUDIO_ASSIGNMENT_RESUME_SCHEMA_VERSION;
  activeAssignmentId: string | null;
  currentLessonId: LessonId | null;
  completedLessonIds: LessonId[];
  lastOpenedAt: string;
};

export function createInitialAssignmentResumeState(): CodingStudioAssignmentResumeState {
  return {
    schemaVersion: CODING_STUDIO_ASSIGNMENT_RESUME_SCHEMA_VERSION,
    activeAssignmentId: null,
    currentLessonId: null,
    completedLessonIds: [],
    lastOpenedAt: new Date(0).toISOString(),
  };
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export function parseAssignmentResumeState(input: unknown): CodingStudioAssignmentResumeState | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<CodingStudioAssignmentResumeState>;
  if (candidate.schemaVersion !== CODING_STUDIO_ASSIGNMENT_RESUME_SCHEMA_VERSION) return null;

  const completedLessonIds = Array.isArray(candidate.completedLessonIds)
    ? candidate.completedLessonIds.filter((id): id is LessonId => typeof id === "string" && LESSON_IDS.includes(id as LessonId))
    : [];

  return {
    schemaVersion: CODING_STUDIO_ASSIGNMENT_RESUME_SCHEMA_VERSION,
    activeAssignmentId: typeof candidate.activeAssignmentId === "string" ? candidate.activeAssignmentId : null,
    currentLessonId:
      typeof candidate.currentLessonId === "string" && LESSON_IDS.includes(candidate.currentLessonId as LessonId)
        ? (candidate.currentLessonId as LessonId)
        : null,
    completedLessonIds,
    lastOpenedAt: typeof candidate.lastOpenedAt === "string" ? candidate.lastOpenedAt : new Date(0).toISOString(),
  };
}

export function loadCodingStudioAssignments(): CodingStudioAssignment[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeJsonParse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => parseCodingStudioAssignment(entry) ?? migrateLegacyAssignment(entry))
    .filter((entry): entry is CodingStudioAssignment => Boolean(entry));
}

export function saveCodingStudioAssignments(assignments: CodingStudioAssignment[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
}

export function upsertCodingStudioAssignment(assignment: CodingStudioAssignment): CodingStudioAssignment[] {
  const parsed = parseCodingStudioAssignment(assignment);
  if (!parsed) return loadCodingStudioAssignments();
  const assignments = loadCodingStudioAssignments();
  const existingIndex = assignments.findIndex((item) => item.assignmentId === parsed.assignmentId);
  const next = {
    ...parsed,
    schemaVersion: CODING_STUDIO_ASSIGNMENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) {
    assignments[existingIndex] = next;
  } else {
    assignments.push(next);
  }
  saveCodingStudioAssignments(assignments);
  return assignments;
}

export function loadAssignmentResumeState(): CodingStudioAssignmentResumeState {
  if (typeof window === "undefined") return createInitialAssignmentResumeState();
  const raw = window.localStorage.getItem(ASSIGNMENT_RESUME_STORAGE_KEY);
  if (!raw) return createInitialAssignmentResumeState();
  return parseAssignmentResumeState(safeJsonParse(raw)) ?? createInitialAssignmentResumeState();
}

export function saveAssignmentResumeState(state: CodingStudioAssignmentResumeState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ASSIGNMENT_RESUME_STORAGE_KEY, JSON.stringify(state));
}

export function activateAssignment(args: { assignmentId: string; preferredLessonId?: LessonId | null }): CodingStudioAssignmentResumeState {
  const assignments = loadCodingStudioAssignments();
  const assignment = assignments.find((item) => item.assignmentId === args.assignmentId) ?? null;
  if (!assignment) return loadAssignmentResumeState();

  const lessonId = args.preferredLessonId && assignment.lessonIds.includes(args.preferredLessonId) ? args.preferredLessonId : assignment.recommendedStartLessonId;
  const next: CodingStudioAssignmentResumeState = {
    schemaVersion: CODING_STUDIO_ASSIGNMENT_RESUME_SCHEMA_VERSION,
    activeAssignmentId: assignment.assignmentId,
    currentLessonId: lessonId,
    completedLessonIds: [],
    lastOpenedAt: new Date().toISOString(),
  };
  saveAssignmentResumeState(next);
  return next;
}

export function resolveActiveAssignment(args: { assignments: CodingStudioAssignment[]; resume: CodingStudioAssignmentResumeState }): CodingStudioAssignment | null {
  if (!args.resume.activeAssignmentId) return null;
  return args.assignments.find((entry) => entry.assignmentId === args.resume.activeAssignmentId) ?? null;
}

export function resolveAssignedCurrentLesson(args: {
  assignment: CodingStudioAssignment | null;
  resume: CodingStudioAssignmentResumeState;
}): LessonId | null {
  const { assignment, resume } = args;
  if (!assignment) return null;
  if (resume.currentLessonId && assignment.lessonIds.includes(resume.currentLessonId)) {
    return resume.currentLessonId;
  }
  const firstPending = assignment.lessonIds.find((id) => !resume.completedLessonIds.includes(id));
  return firstPending ?? assignment.recommendedStartLessonId;
}

export function touchAssignmentLesson(args: { lessonId: LessonId }): CodingStudioAssignmentResumeState {
  const resume = loadAssignmentResumeState();
  const next = {
    ...resume,
    currentLessonId: args.lessonId,
    lastOpenedAt: new Date().toISOString(),
  };
  saveAssignmentResumeState(next);
  return next;
}

export function advanceAssignmentOnLessonCompletion(args: {
  assignment: CodingStudioAssignment | null;
  resume: CodingStudioAssignmentResumeState;
  completedLessonId: LessonId;
}): CodingStudioAssignmentResumeState {
  if (!args.assignment) return args.resume;
  if (!args.assignment.lessonIds.includes(args.completedLessonId)) return args.resume;

  const completedLessonIds = Array.from(new Set([...args.resume.completedLessonIds, args.completedLessonId])) as LessonId[];
  const currentIndex = args.assignment.lessonIds.findIndex((id) => id === args.completedLessonId);
  const nextAssignedLessonId = args.assignment.lessonIds[currentIndex + 1] ?? null;

  const next = {
    ...args.resume,
    completedLessonIds,
    currentLessonId: nextAssignedLessonId,
    lastOpenedAt: new Date().toISOString(),
  };
  saveAssignmentResumeState(next);
  return next;
}

export function resetAssignmentResumeProgress(): CodingStudioAssignmentResumeState {
  const next = createInitialAssignmentResumeState();
  saveAssignmentResumeState(next);
  return next;
}

export function buildAssignmentEcho(args: {
  assignment: CodingStudioAssignment | null;
  resume: CodingStudioAssignmentResumeState;
}): { title: string; currentLessonId: LessonId; nextLessonId: LessonId | null } | null {
  const { assignment, resume } = args;
  if (!assignment) return null;
  const currentLessonId = resolveAssignedCurrentLesson({ assignment, resume });
  if (!currentLessonId) return null;

  const nextLessonIdInAssignment = assignment.lessonIds.find((id) => !resume.completedLessonIds.includes(id) && id !== currentLessonId) ?? getNextLessonId(currentLessonId);

  return {
    title: assignment.title,
    currentLessonId,
    nextLessonId: nextLessonIdInAssignment ?? null,
  };
}
