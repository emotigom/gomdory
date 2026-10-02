import { parseCodingStudioFeedbackNote, type CodingStudioFeedbackNote } from "./feedbackSchema";
import type { LessonId } from "./types";

const STORAGE_KEY = "gomdoryedu.coding-studio.feedback.v1";

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadCodingStudioFeedbackNotes(): CodingStudioFeedbackNote[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = safeParseJson(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => parseCodingStudioFeedbackNote(entry))
    .filter((entry): entry is CodingStudioFeedbackNote => Boolean(entry))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function saveCodingStudioFeedbackNotes(notes: CodingStudioFeedbackNote[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function upsertCodingStudioFeedbackNote(note: CodingStudioFeedbackNote): CodingStudioFeedbackNote[] {
  const notes = loadCodingStudioFeedbackNotes();
  const next = [note, ...notes.filter((entry) => entry.feedbackId !== note.feedbackId)];
  saveCodingStudioFeedbackNotes(next);
  return next;
}

export function removeCodingStudioFeedbackNote(feedbackId: string): CodingStudioFeedbackNote[] {
  const notes = loadCodingStudioFeedbackNotes();
  const next = notes.filter((entry) => entry.feedbackId !== feedbackId);
  saveCodingStudioFeedbackNotes(next);
  return next;
}

export function listFeedbackNotesForSubmission(submissionId: string): CodingStudioFeedbackNote[] {
  return loadCodingStudioFeedbackNotes().filter((entry) => entry.submissionId === submissionId);
}

export function getLatestFeedbackNotesForLesson(lessonId: LessonId): CodingStudioFeedbackNote[] {
  const grouped = new Map<string, CodingStudioFeedbackNote[]>();
  for (const note of loadCodingStudioFeedbackNotes()) {
    if (note.lessonId !== lessonId) continue;
    grouped.set(note.submissionId, [...(grouped.get(note.submissionId) ?? []), note]);
  }
  const latestSubmissionGroup = Array.from(grouped.values()).sort((a, b) => (a[0].createdAt < b[0].createdAt ? 1 : -1))[0] ?? [];
  return latestSubmissionGroup.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export function clearCodingStudioFeedbackNotes() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
