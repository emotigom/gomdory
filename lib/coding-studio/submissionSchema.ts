import { z } from "zod";

import { CODING_STUDIO_PROJECT_SCHEMA_VERSION, LESSON_IDS, type CodingStudioProject } from "./types";
import type { CodingStudioAssessmentResult, LessonId, StudioRuntimeState } from "./types";
import type { CodingStudioEntrySource } from "./studioEntry";

export const CODING_STUDIO_SUBMISSION_SCHEMA_VERSION = 1 as const;

export type CodingStudioSubmissionOutcome = "completed" | "attempted";

export type CodingStudioSubmissionEvidence = {
  outcome: CodingStudioSubmissionOutcome;
  runtime: {
    reachedGoal: boolean;
    blocked: boolean;
    stepCount: number;
    finalPosition: { x: number; z: number; heading: number };
  };
  structure: {
    blockCount: number;
    irInstructionCount: number;
    repeatCount: number;
    turnCount: number;
    sensorCount: number;
  };
  lessonSignal: {
    focus: string;
    successReason?: string;
    retryReason?: string;
  };
  scene: {
    goalDistance: number;
  };
};

export type CodingStudioSubmissionSnapshot = {
  submissionSchemaVersion: typeof CODING_STUDIO_SUBMISSION_SCHEMA_VERSION;
  submissionId: string;
  assignmentId: string | null;
  lessonId: LessonId;
  projectSchemaVersion: typeof CODING_STUDIO_PROJECT_SCHEMA_VERSION;
  submittedAt: string;
  entrySource: CodingStudioEntrySource;
  projectSnapshot: CodingStudioProject;
  assessment: {
    tone: CodingStudioAssessmentResult["tone"];
    summary: string;
    retryHint?: string;
    completionReflection?: string;
    keyCondition: string;
  };
  evidence: CodingStudioSubmissionEvidence;
  replay: {
    reviewModeSupported: boolean;
    runtimeState: Pick<StudioRuntimeState, "x" | "z" | "heading" | "stepCount" | "reachedGoal" | "blocked">;
    sceneId: LessonId;
  };
  revision: {
    previousSubmissionId: string | null;
    reworkSourceSubmissionId: string | null;
  };
};

const evidenceSchema = z.object({
  outcome: z.enum(["completed", "attempted"]),
  runtime: z.object({
    reachedGoal: z.boolean(),
    blocked: z.boolean(),
    stepCount: z.number(),
    finalPosition: z.object({ x: z.number(), z: z.number(), heading: z.number() }),
  }),
  structure: z.object({
    blockCount: z.number(),
    irInstructionCount: z.number(),
    repeatCount: z.number(),
    turnCount: z.number(),
    sensorCount: z.number(),
  }),
  lessonSignal: z.object({
    focus: z.string(),
    successReason: z.string().optional(),
    retryReason: z.string().optional(),
  }),
  scene: z.object({
    goalDistance: z.number(),
  }),
});

const submissionSchemaV1 = z.object({
  submissionSchemaVersion: z.literal(CODING_STUDIO_SUBMISSION_SCHEMA_VERSION),
  submissionId: z.string().min(1),
  assignmentId: z.string().nullable(),
  lessonId: z.enum(LESSON_IDS),
  projectSchemaVersion: z.literal(CODING_STUDIO_PROJECT_SCHEMA_VERSION),
  submittedAt: z.string(),
  entrySource: z.enum(["academy-free", "academy-assigned", "assigned-resume", "free-practice"]),
  projectSnapshot: z.any(),
  assessment: z.object({
    tone: z.enum(["success", "near-success", "retry"]),
    summary: z.string(),
    retryHint: z.string().optional(),
    completionReflection: z.string().optional(),
    keyCondition: z.string(),
  }),
  evidence: evidenceSchema,
  replay: z.object({
    reviewModeSupported: z.boolean(),
    runtimeState: z.object({
      x: z.number(),
      z: z.number(),
      heading: z.number(),
      stepCount: z.number(),
      reachedGoal: z.boolean(),
      blocked: z.boolean(),
    }),
    sceneId: z.enum(LESSON_IDS),
  }),
  revision: z.object({
    previousSubmissionId: z.string().nullable(),
    reworkSourceSubmissionId: z.string().nullable(),
  }),
});

type LegacySubmissionV0 = {
  submissionId?: unknown;
  lessonId?: unknown;
  submittedAt?: unknown;
  projectSnapshot?: unknown;
  assessment?: unknown;
  evidence?: unknown;
};

type SubmissionV1WithoutRevision = Omit<CodingStudioSubmissionSnapshot, "revision"> & {
  revision?: unknown;
};

function migrateLegacySubmission(input: LegacySubmissionV0): CodingStudioSubmissionSnapshot | null {
  if (typeof input.lessonId !== "string" || !LESSON_IDS.includes(input.lessonId as LessonId)) return null;
  if (!input.projectSnapshot || typeof input.projectSnapshot !== "object") return null;
  return {
    submissionSchemaVersion: CODING_STUDIO_SUBMISSION_SCHEMA_VERSION,
    submissionId: typeof input.submissionId === "string" ? input.submissionId : `legacy-${input.lessonId}`,
    assignmentId: null,
    lessonId: input.lessonId as LessonId,
    projectSchemaVersion: CODING_STUDIO_PROJECT_SCHEMA_VERSION,
    submittedAt: typeof input.submittedAt === "string" ? input.submittedAt : new Date(0).toISOString(),
    entrySource: "free-practice",
    projectSnapshot: input.projectSnapshot as CodingStudioProject,
    assessment: {
      tone: "retry",
      summary: "이전 제출 형식에서 옮겨온 기록입니다.",
      keyCondition: "기록 이전",
    },
    evidence: {
      outcome: "attempted",
      runtime: {
        reachedGoal: false,
        blocked: false,
        stepCount: 0,
        finalPosition: { x: 0, z: 0, heading: 0 },
      },
      structure: {
        blockCount: 0,
        irInstructionCount: 0,
        repeatCount: 0,
        turnCount: 0,
        sensorCount: 0,
      },
      lessonSignal: { focus: "기록 이전" },
      scene: { goalDistance: 0 },
    },
    replay: {
      reviewModeSupported: false,
      runtimeState: { x: 0, z: 0, heading: 0, stepCount: 0, reachedGoal: false, blocked: false },
      sceneId: input.lessonId as LessonId,
    },
    revision: {
      previousSubmissionId: null,
      reworkSourceSubmissionId: null,
    },
  };
}

export function parseCodingStudioSubmissionSnapshot(input: unknown): CodingStudioSubmissionSnapshot | null {
  const parsed = submissionSchemaV1.safeParse(input);
  if (parsed.success) {
    return parsed.data as CodingStudioSubmissionSnapshot;
  }
  if (input && typeof input === "object" && "submissionSchemaVersion" in input) {
    const candidate = input as SubmissionV1WithoutRevision;
    const migrated = submissionSchemaV1.safeParse({
      ...candidate,
      revision: {
        previousSubmissionId: null,
        reworkSourceSubmissionId: null,
      },
    });
    if (migrated.success) {
      return migrated.data as CodingStudioSubmissionSnapshot;
    }
  }
  if (!input || typeof input !== "object") return null;
  return migrateLegacySubmission(input as LegacySubmissionV0);
}
