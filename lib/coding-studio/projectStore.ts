import { createLessonTemplateProject, parseCodingStudioProject } from "./projectSchema";
import type { CodingStudioProject, LessonId } from "./types";

const STORAGE_KEY = "gomdoryedu.coding-studio.project.v1";
const LESSON_STORAGE_KEY_PREFIX = "gomdoryedu.coding-studio.project.lesson";

function getLessonStorageKey(lessonId: LessonId) {
  return `${LESSON_STORAGE_KEY_PREFIX}.${lessonId}.v1`;
}

export function saveCodingStudioProject(project: CodingStudioProject) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getLessonStorageKey(project.lessonId), JSON.stringify(project));
}

export function loadCodingStudioProject(lessonId: LessonId): CodingStudioProject {
  if (typeof window === "undefined") {
    return createLessonTemplateProject(lessonId);
  }

  const raw = window.localStorage.getItem(getLessonStorageKey(lessonId)) ?? window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createLessonTemplateProject(lessonId);

  try {
    const parsed = parseCodingStudioProject(JSON.parse(raw));
    if (!parsed || parsed.lessonId !== lessonId) {
      return createLessonTemplateProject(lessonId);
    }
    return parsed;
  } catch {
    return createLessonTemplateProject(lessonId);
  }
}

export function resetCodingStudioProject(lessonId: LessonId): CodingStudioProject {
  const next = createLessonTemplateProject(lessonId);
  saveCodingStudioProject(next);
  return next;
}
