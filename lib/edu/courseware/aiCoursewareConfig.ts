import { AI_COURSEWARE_MAX_DAY, AI_COURSEWARE_MIN_DAY } from "./aiCoursewareRoutes";

export const AI_COURSEWARE_DEFAULT_ACTIVE_DAY = 1;

function clampCoursewareDay(day: number, maxDay: number): number {
  return Math.min(Math.max(day, AI_COURSEWARE_MIN_DAY), maxDay);
}

export function resolveCoursewareActiveDay(input?: {
  searchParamsDay?: string | string[];
  configuredDay?: number;
  maxDay?: number;
}): number {
  const maxDay = Number.isInteger(input?.maxDay) ? Math.max(AI_COURSEWARE_MIN_DAY, Number(input?.maxDay)) : AI_COURSEWARE_MAX_DAY;
  const queryValue = Array.isArray(input?.searchParamsDay) ? input?.searchParamsDay[0] : input?.searchParamsDay;
  const queryDay = Number(queryValue);
  if (Number.isInteger(queryDay)) {
    return clampCoursewareDay(queryDay, maxDay);
  }
  const configuredDay = Number(input?.configuredDay);
  if (Number.isInteger(configuredDay)) {
    return clampCoursewareDay(configuredDay, maxDay);
  }
  return clampCoursewareDay(AI_COURSEWARE_DEFAULT_ACTIVE_DAY, maxDay);
}
