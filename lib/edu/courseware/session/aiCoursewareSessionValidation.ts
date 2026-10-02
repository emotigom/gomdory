import { getCoursewareLessonsByDay } from "@/lib/edu/courseware/aiCoursewareSelectors";
import { parseTeacherShareInput } from "@/lib/edu/courseware/teacher/aiCoursewareTeacherLinkParser";
export const isClassSessionWriteEnabled = () => process.env.COURSEWARE_CLASS_SESSIONS_ENABLED === "1";
export function validateSessionCreateInput(dayNumber: number, title?: string | null) { if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 16) return null; const lessons = getCoursewareLessonsByDay(dayNumber); if (lessons.length === 0) return null; return { dayNumber, title: (title ?? "").trim().slice(0, 80) || null, lessonNumbers: lessons.map((v) => v.lessonNumber) }; }
export function sanitizeOptionalText(input: string | undefined | null, max = 80) { const text = (input ?? "").replace(/[<>]/g, "").trim(); return text ? text.slice(0, max) : null; }
export function validateSubmissionInput(input: { publicUrl?: string; shareId?: string }, origin: string) { const raw = input.publicUrl ?? input.shareId ?? ""; return parseTeacherShareInput(raw, origin); }
