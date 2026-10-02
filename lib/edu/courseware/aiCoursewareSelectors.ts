import { AI_COURSEWARE_LESSONS } from "./aiCoursewareLessons";
import { AI_COURSEWARE_STARTER_TEMPLATES } from "./aiCoursewareStarterTemplates";
import type { ArtifactType, CoursewareLesson, CoursewareTag } from "./aiCoursewareTypes";

export const getAllCoursewareLessons = (): CoursewareLesson[] => AI_COURSEWARE_LESSONS;
export const getCoursewareLessonByNumber = (lessonNumber: number): CoursewareLesson | null =>
  AI_COURSEWARE_LESSONS.find((lesson) => lesson.lessonNumber === lessonNumber) ?? null;
export const getCoursewareLessonsByDay = (dayNumber: number): CoursewareLesson[] =>
  AI_COURSEWARE_LESSONS.filter((lesson) => lesson.dayNumber === dayNumber);
export const getCoursewareDayPlan = (dayNumber: number) => ({
  dayNumber,
  lessons: getCoursewareLessonsByDay(dayNumber),
});
export const getNextCoursewareLesson = (lessonNumber: number): CoursewareLesson | null => getCoursewareLessonByNumber(lessonNumber + 1);
export const getPreviousCoursewareLesson = (lessonNumber: number): CoursewareLesson | null => getCoursewareLessonByNumber(lessonNumber - 1);
export const getRequiredArtifacts = () =>
  AI_COURSEWARE_LESSONS.filter((lesson) => lesson.artifact.required).map((lesson) => lesson.artifact);
export const getLessonsByArtifactType = (type: ArtifactType): CoursewareLesson[] =>
  AI_COURSEWARE_LESSONS.filter((lesson) => lesson.artifact.type === type);
export const getLessonsByTag = (tag: CoursewareTag): CoursewareLesson[] =>
  AI_COURSEWARE_LESSONS.filter((lesson) => lesson.tags.includes(tag));
export const getAbsentRecoveryPack = (lessonNumber: number) => {
  const lesson = getCoursewareLessonByNumber(lessonNumber);
  return lesson ? { lessonNumber: lesson.lessonNumber, titleKo: lesson.titleKo, recovery: lesson.recovery } : null;
};
export const getStarterTemplates = () => AI_COURSEWARE_STARTER_TEMPLATES;
export const mapStarterTemplateToCoursewareLessons = (templateId: string): CoursewareLesson[] => {
  const template = AI_COURSEWARE_STARTER_TEMPLATES.find((item) => item.templateId === templateId);
  if (!template) return [];
  return template.mapsToLessonNumbers.map((lessonNumber) => getCoursewareLessonByNumber(lessonNumber)).filter((v): v is CoursewareLesson => Boolean(v));
};
