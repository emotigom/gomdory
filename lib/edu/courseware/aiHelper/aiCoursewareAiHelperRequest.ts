import type { CoursewareAiHelperRequest, CoursewareAiHelperTask } from "./aiCoursewareAiHelperTypes";
import type { ArtifactType } from "@/lib/edu/courseware/aiCoursewareTypes";

const TASKS: CoursewareAiHelperTask[] = ["title-suggestions", "intro-copy", "menu-names", "faq-draft", "recommendation-copy", "presentation-summary", "reflection-prompts", "rewrite-student-tone", "simplify-middle-school", "source-disclosure-copy"];

export function validateAiHelperRequest(input: unknown): CoursewareAiHelperRequest | null {
  if (!input || typeof input !== "object") return null;
  const request = input as Record<string, unknown> & { task?: unknown };
  if (typeof request.task !== "string" || !TASKS.includes(request.task as CoursewareAiHelperTask)) return null;
  const studentTopicKo = typeof request.studentTopicKo === "string" ? request.studentTopicKo.slice(0, 200) : undefined;
  const pageDraftSummary = typeof request.pageDraftSummary === "string" ? request.pageDraftSummary.slice(0, 400) : undefined;
  const artifactType = typeof request.artifactType === "string" ? request.artifactType as ArtifactType : undefined;
  return { task: request.task as CoursewareAiHelperTask, lessonNumber: typeof request.lessonNumber === "number" ? request.lessonNumber : undefined, artifactType, pageDraftSummary, studentTopicKo, constraintsKo: Array.isArray(request.constraintsKo) ? request.constraintsKo.map((v: string) => String(v).slice(0, 80)).slice(0, 6) : [], tone: request.tone === "teacher-friendly" || request.tone === "presentation" ? request.tone : "middle-school", maxSuggestions: Math.max(1, Math.min(5, Number(request.maxSuggestions) || 3)), source: "courseware-ai-helper", version: 1 };
}

export const isCoursewareAiHelperEnabled = () => process.env.COURSEWARE_AI_HELPER_ENABLED === "1";
