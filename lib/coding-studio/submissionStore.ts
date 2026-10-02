import { parseCodingStudioSubmissionSnapshot, type CodingStudioSubmissionSnapshot } from "./submissionSchema";
import type { LessonId } from "./types";

const STORAGE_KEY = "gomdoryedu.coding-studio.submissions.v1";

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function deepCloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadCodingStudioSubmissions(): CodingStudioSubmissionSnapshot[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeParseJson(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => parseCodingStudioSubmissionSnapshot(entry))
    .filter((entry): entry is CodingStudioSubmissionSnapshot => Boolean(entry))
    .sort((a, b) => {
      if (a.submittedAt === b.submittedAt) return 0;
      return a.submittedAt < b.submittedAt ? 1 : -1;
    })
    .map((entry) => deepCloneSnapshot(entry));
}

export function saveCodingStudioSubmissions(submissions: CodingStudioSubmissionSnapshot[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions.map((entry) => deepCloneSnapshot(entry))));
}

export function saveCodingStudioSubmission(snapshot: CodingStudioSubmissionSnapshot): CodingStudioSubmissionSnapshot[] {
  const submissions = loadCodingStudioSubmissions();
  const next = [deepCloneSnapshot(snapshot), ...submissions.filter((entry) => entry.submissionId !== snapshot.submissionId)];
  saveCodingStudioSubmissions(next);
  return next.map((entry) => deepCloneSnapshot(entry));
}

export function listSubmissionsByLesson(lessonId: LessonId): CodingStudioSubmissionSnapshot[] {
  return loadCodingStudioSubmissions().filter((entry) => entry.lessonId === lessonId);
}

export function getLatestSubmissionForLesson(lessonId: LessonId): CodingStudioSubmissionSnapshot | null {
  return listSubmissionsByLesson(lessonId)[0] ?? null;
}

export function getSubmissionById(submissionId: string): CodingStudioSubmissionSnapshot | null {
  return loadCodingStudioSubmissions().find((entry) => entry.submissionId === submissionId) ?? null;
}

export function clearCodingStudioSubmissionHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
