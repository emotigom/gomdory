import type { CoursewarePageDraft } from "./aiCoursewarePageTypes";
import { sanitizeDraft } from "./aiCoursewarePageSanitizer";

const STORAGE_KEY = "gomdory.aiCourseware.pageDrafts.v1";
const memory = new Map<number, CoursewarePageDraft>();

const canUseLocalStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

export const getPageDraft = (lessonNumber: number): CoursewarePageDraft | null => {
  if (!canUseLocalStorage()) return memory.get(lessonNumber) ?? null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return sanitizeDraft(parsed[String(lessonNumber)]);
  } catch {
    return memory.get(lessonNumber) ?? null;
  }
};

export const savePageDraft = (draft: CoursewarePageDraft) => {
  memory.set(draft.lessonNumber, draft);
  if (!canUseLocalStorage()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    parsed[String(draft.lessonNumber)] = draft;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {}
};
