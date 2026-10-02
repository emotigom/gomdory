import type { CoursewareLesson } from "@/lib/edu/courseware/aiCoursewareTypes";

export type CoursewareLessonId = CoursewareLesson["id"];
export type PublishScope = "class_only" | "school_share" | "public_portfolio";
export const DEFAULT_PUBLISH_SCOPE: PublishScope = "class_only";
export const AI_SPINE_STORAGE_KEY = "gomdory.aiCourseware.spine.v1";
export const TEACHER_RUBRIC_DOMAINS = ["educational_effectiveness", "ethics_privacy", "technical_reliability", "accessibility_inclusion", "personalized_support"] as const;

export type PromptChipIntent = "understand" | "create" | "verify" | "improve" | "reflect";
export type VerificationKind = "fact" | "source" | "privacy" | "copyright" | "bias" | "accessibility" | "publish_scope";
export type TeacherRubricDomain = (typeof TEACHER_RUBRIC_DOMAINS)[number];

export interface PromptChip { id: string; label: string; promptTemplate: string; intent: PromptChipIntent }
export interface VerificationItem { id: string; label: string; kind: VerificationKind; required: boolean }
export interface EvidenceCard { goalPrompt: string; changedReasonPrompt: string; verificationPrompt: string; nextRevisionPrompt: string; redactedPrompt?: string; promptSummary?: string; }
export interface TeacherRubricSignal { domain: TeacherRubricDomain; label: string; focus: string }

export interface AiLearningSpineConfig {
  lessonNumber: number; dayNumber: number; title: string;
  conceptCard: { headline: string; body: string; humanJudgementPoint: string };
  promptChips: PromptChip[]; verificationItems: VerificationItem[]; evidencePrompts: EvidenceCard;
  teacherRubricHints: TeacherRubricSignal[]; publishScopeDefault: PublishScope;
}

export interface AiLearningSpineDraft {
  lessonNumber: number; publishScope: PublishScope; verificationState: Record<string, boolean>;
  selectedChipIds?: string[];
  evidence?: Pick<EvidenceCard, "redactedPrompt" | "promptSummary"> & { changedReason?: string; verificationNotes?: string; nextRevision?: string };
}
