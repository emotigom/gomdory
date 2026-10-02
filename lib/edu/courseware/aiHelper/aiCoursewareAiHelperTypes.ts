import type { ArtifactType } from "@/lib/edu/courseware/aiCoursewareTypes";

export type CoursewareAiHelperTask = "title-suggestions" | "intro-copy" | "menu-names" | "faq-draft" | "recommendation-copy" | "presentation-summary" | "reflection-prompts" | "rewrite-student-tone" | "simplify-middle-school" | "source-disclosure-copy";
export type CoursewareAiTone = "middle-school" | "teacher-friendly" | "presentation";
export type CoursewareSuggestionSource = "server-ai" | "template-fallback";

export type CoursewareAiHelperRequest = { task: CoursewareAiHelperTask; lessonNumber?: number; artifactType?: ArtifactType; pageDraftSummary?: string; studentTopicKo?: string; constraintsKo?: string[]; tone: CoursewareAiTone; maxSuggestions: number; source: "courseware-ai-helper"; version: 1 };
export type CoursewareAiSuggestion = { suggestionId: string; task: CoursewareAiHelperTask; titleKo?: string; bodyKo: string; rationaleKo?: string; warningsKo?: string[]; generatedBy: CoursewareSuggestionSource; createdAt: string };
export type CoursewareAiHelperResponse = { status: "ok" | "unavailable" | "validation_failed"; suggestions: CoursewareAiSuggestion[]; messageKo?: string };
