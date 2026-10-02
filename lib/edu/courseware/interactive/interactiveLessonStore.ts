export type InteractiveLessonProgress = { lessonId: string; completedActivityIds: string[]; resultCard: Record<string, string> };
const KEY = "gomdory.courseware.interactive.v1";
const isBrowser = () => typeof window !== "undefined";
const sanitize = (value: string) => value.replace(/[0-9]{2,}/g, "").replace(/@/g, "");

export function loadInteractiveProgress(): Record<string, InteractiveLessonProgress> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, InteractiveLessonProgress>;
    return structuredClone(parsed ?? {});
  } catch {
    return {};
  }
}

export function saveInteractiveProgress(progress: Record<string, InteractiveLessonProgress>) {
  if (!isBrowser()) return;
  const cleaned: Record<string, InteractiveLessonProgress> = {};
  for (const [k, v] of Object.entries(progress)) {
    cleaned[k] = {
      lessonId: v.lessonId,
      completedActivityIds: [...v.completedActivityIds],
      resultCard: Object.fromEntries(Object.entries(v.resultCard).map(([rk, rv]) => [rk, sanitize(rv)])),
    };
  }
  window.localStorage.setItem(KEY, JSON.stringify(structuredClone(cleaned)));
}
