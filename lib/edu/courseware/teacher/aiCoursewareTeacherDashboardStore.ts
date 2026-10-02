import type { TeacherCoursewareDashboardState } from "./aiCoursewareTeacherDashboardTypes";

const KEY = "gomdory.aiCourseware.teacherDashboard.v1";
let memoryState: TeacherCoursewareDashboardState | null = null;

export const createDefaultTeacherDashboardState = (selectedDayNumber = 1): TeacherCoursewareDashboardState => ({
  selectedDayNumber,
  collectedLinks: [],
  updatedAt: new Date().toISOString(),
  source: "local-teacher-dashboard",
  version: 1,
});

const isValidState = (v: unknown): v is TeacherCoursewareDashboardState => {
  if (!v || typeof v !== "object") return false;
  const s = v as TeacherCoursewareDashboardState;
  return s.version === 1 && s.source === "local-teacher-dashboard" && Number.isInteger(s.selectedDayNumber) && Array.isArray(s.collectedLinks);
};

export function loadTeacherDashboardState(defaultDay = 1): TeacherCoursewareDashboardState {
  const fallback = memoryState ?? createDefaultTeacherDashboardState(defaultDay);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) return fallback;
    memoryState = parsed;
    return parsed;
  } catch {
    return fallback;
  }
}

export function saveTeacherDashboardState(state: TeacherCoursewareDashboardState) {
  memoryState = state;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // local-only fallback stays in memory
  }
}
