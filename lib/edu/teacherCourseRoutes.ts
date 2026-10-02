export const TEACHER_AI_COURSE_CANONICAL_PATH = "/edu/lesson/teacher";
export const TEACHER_AI_COURSE_LEGACY_PATH = "/edu/teacher/classroom/new";

export function teacherAiCourseNewHref(input?: { boardId?: string | null }) {
  const params = new URLSearchParams();
  if (input?.boardId) {
    params.set("boardId", input.boardId);
  }
  const query = params.toString();
  return query ? `${TEACHER_AI_COURSE_CANONICAL_PATH}?${query}` : TEACHER_AI_COURSE_CANONICAL_PATH;
}
