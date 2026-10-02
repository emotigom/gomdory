const AI_COURSEWARE_OVERVIEW_PATH = "/edu/lesson/teacher";
const AI_COURSEWARE_DAY_BASE_PATH = "/edu/lesson/day";

export const AI_COURSEWARE_MIN_DAY = 1;
export const AI_COURSEWARE_MAX_DAY = 32;

export function normalizeAiCoursewareDay(day: number): number | null {
  if (!Number.isInteger(day)) return null;
  if (day < AI_COURSEWARE_MIN_DAY || day > AI_COURSEWARE_MAX_DAY) return null;
  return day;
}

export function aiCoursewareOverviewHref(options?: { boardId?: string }): string {
  if (!options?.boardId) return AI_COURSEWARE_OVERVIEW_PATH;
  return `${AI_COURSEWARE_OVERVIEW_PATH}?boardId=${encodeURIComponent(options.boardId)}`;
}

export function aiCoursewareDayHref(day: number, options?: { boardId?: string }): string {
  const normalizedDay = normalizeAiCoursewareDay(day);
  if (normalizedDay === null) throw new Error(`Invalid AI courseware day: ${day}`);
  const path = `${AI_COURSEWARE_DAY_BASE_PATH}/${normalizedDay}`;
  if (!options?.boardId) return path;
  return `${path}?boardId=${encodeURIComponent(options.boardId)}`;
}


export function coursewareLessonHref(day: number): string { return aiCoursewareDayHref(day); }
export function coursewareTeacherLessonHref(day: number): string { const n = normalizeAiCoursewareDay(day); if (n===null) throw new Error(`Invalid AI courseware day: ${day}`); return `/edu/lesson/teacher/day/${n}`; }
export function coursewareHubHref(options?: { day?: number }): string { if (!options?.day) return "/edu/lesson"; const n=normalizeAiCoursewareDay(options.day); if (n===null) return "/edu/lesson"; return `/edu/lesson?day=${n}`; }
