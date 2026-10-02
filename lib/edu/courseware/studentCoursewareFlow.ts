import type { StudentDayContent } from "./studentCoursewareContent";

export const STUDENT_DAY_RUNTIME_MARKER = "student-day-v2";
export const progressKey = (day:number, version:string) => `edu:courseware:day:${day}:flow:${version}`;
export const clampStage = (value:number, total:number) => (Number.isInteger(value) && value >= 0 && value < total ? value : 0);
export const resolveInitialStage = (day:number, content:StudentDayContent) => {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(progressKey(day, content.lessonFlowVersion));
  return clampStage(Number(raw), content.scenes.length);
};
