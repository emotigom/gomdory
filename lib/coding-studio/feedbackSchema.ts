import { z } from "zod";

import { CODING_STUDIO_RUBRIC_CRITERION_IDS, type CodingStudioRubricCriterionId } from "./rubricSchema";
import { LESSON_IDS } from "./types";

export const CODING_STUDIO_FEEDBACK_SCHEMA_VERSION = 1 as const;

export const CODING_STUDIO_FEEDBACK_NOTE_TYPES = ["praise", "correction", "retry-focus", "next-step"] as const;
export type CodingStudioFeedbackNoteType = (typeof CODING_STUDIO_FEEDBACK_NOTE_TYPES)[number];

export const CODING_STUDIO_FEEDBACK_TARGET_AREAS = ["movement", "repeat", "sensor", "goal", "scene-outcome"] as const;
export type CodingStudioFeedbackTargetArea = (typeof CODING_STUDIO_FEEDBACK_TARGET_AREAS)[number];

export type CodingStudioFeedbackSource = {
  sourceType: "teacher-local";
  authorId: string;
  authorLabel: string;
};

export type CodingStudioFeedbackNote = {
  feedbackSchemaVersion: typeof CODING_STUDIO_FEEDBACK_SCHEMA_VERSION;
  feedbackId: string;
  submissionId: string;
  lessonId: (typeof LESSON_IDS)[number];
  createdAt: string;
  source: CodingStudioFeedbackSource;
  noteType: CodingStudioFeedbackNoteType;
  title: string;
  body: string;
  targetArea?: CodingStudioFeedbackTargetArea;
  criterionId?: CodingStudioRubricCriterionId;
  recommendedAction?: string;
};

const feedbackNoteSchemaV1 = z.object({
  feedbackSchemaVersion: z.literal(CODING_STUDIO_FEEDBACK_SCHEMA_VERSION),
  feedbackId: z.string().min(1),
  submissionId: z.string().min(1),
  lessonId: z.enum(LESSON_IDS),
  createdAt: z.string(),
  source: z.object({
    sourceType: z.literal("teacher-local"),
    authorId: z.string().min(1),
    authorLabel: z.string().min(1),
  }),
  noteType: z.enum(CODING_STUDIO_FEEDBACK_NOTE_TYPES),
  title: z.string().min(1).max(60),
  body: z.string().min(1).max(240),
  targetArea: z.enum(CODING_STUDIO_FEEDBACK_TARGET_AREAS).optional(),
  criterionId: z.enum(CODING_STUDIO_RUBRIC_CRITERION_IDS).optional(),
  recommendedAction: z.string().min(1).max(120).optional(),
});

type LegacyFeedbackNote = {
  feedbackId?: unknown;
  submissionId?: unknown;
  lessonId?: unknown;
  noteType?: unknown;
  title?: unknown;
  body?: unknown;
};

function migrateLegacyFeedback(input: LegacyFeedbackNote): CodingStudioFeedbackNote | null {
  if (typeof input.submissionId !== "string") return null;
  if (typeof input.lessonId !== "string" || !LESSON_IDS.includes(input.lessonId as (typeof LESSON_IDS)[number])) return null;
  return {
    feedbackSchemaVersion: CODING_STUDIO_FEEDBACK_SCHEMA_VERSION,
    feedbackId: typeof input.feedbackId === "string" ? input.feedbackId : `legacy-feedback-${input.submissionId}`,
    submissionId: input.submissionId,
    lessonId: input.lessonId as (typeof LESSON_IDS)[number],
    createdAt: new Date(0).toISOString(),
    source: { sourceType: "teacher-local", authorId: "teacher-local", authorLabel: "교사" },
    noteType: input.noteType === "praise" || input.noteType === "correction" || input.noteType === "retry-focus" || input.noteType === "next-step" ? input.noteType : "next-step",
    title: typeof input.title === "string" ? input.title : "이전 피드백 기록",
    body: typeof input.body === "string" ? input.body : "다음 제출에서는 핵심 조건 한 가지를 먼저 정확히 맞춰 보세요.",
  };
}

export function parseCodingStudioFeedbackNote(input: unknown): CodingStudioFeedbackNote | null {
  const parsed = feedbackNoteSchemaV1.safeParse(input);
  if (parsed.success) return parsed.data;
  if (!input || typeof input !== "object") return null;
  return migrateLegacyFeedback(input as LegacyFeedbackNote);
}
