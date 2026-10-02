import { z } from "zod";

import { metaverseProgressPersistenceStatusSchema } from "@/lib/world-hub/progress/contracts";

const teacherDashboardMetaverseSummaryVersion = 1 as const;

export const teacherDashboardMetaverseFallbackReasonSchema = z.enum([
  "classroom-context-unavailable",
  "preview-mode",
  "env-missing",
  "read-failed",
  "invalid-payload",
]);

export type TeacherDashboardMetaverseFallbackReason = z.infer<typeof teacherDashboardMetaverseFallbackReasonSchema>;

export const teacherDashboardStudentReferenceSchema = z.object({
  studentId: z.string().min(1),
  studentLabel: z.string().min(1),
});

export type TeacherDashboardStudentReference = z.infer<typeof teacherDashboardStudentReferenceSchema>;

export const teacherDashboardMetaverseScopeSchema = z.object({
  classId: z.string().min(1).nullable().default(null),
  worldId: z.string().min(1),
  sessionId: z.string().min(1).nullable().default(null),
  studentCount: z.number().int().nonnegative(),
  context: z.enum(["classroom", "preview-fallback"]),
});

export type TeacherDashboardMetaverseScope = z.infer<typeof teacherDashboardMetaverseScopeSchema>;

export const teacherDashboardRecentMissionCompletionSchema = z.object({
  studentId: z.string().min(1),
  studentLabel: z.string().min(1),
  worldId: z.string().min(1).nullable(),
  sessionId: z.string().min(1).nullable(),
  missionId: z.string().min(1),
  missionTitle: z.string().min(1),
  completedAtIso: z.string().datetime(),
  completionLabel: z.string().min(1),
  percentComplete: z.number().min(0).max(100),
  resultLabel: z.string().min(1),
  persistenceStatus: metaverseProgressPersistenceStatusSchema,
});

export type TeacherDashboardRecentMissionCompletion = z.infer<typeof teacherDashboardRecentMissionCompletionSchema>;

export const teacherDashboardStudentActivitySchema = z.object({
  studentId: z.string().min(1),
  studentLabel: z.string().min(1),
  status: z.enum(["active", "no-activity"]),
  lastActivityAtIso: z.string().datetime().nullable().default(null),
  worldId: z.string().min(1).nullable().default(null),
  sessionId: z.string().min(1).nullable().default(null),
  missionId: z.string().min(1).nullable().default(null),
  missionTitle: z.string().min(1).nullable().default(null),
  persistenceStatus: metaverseProgressPersistenceStatusSchema.nullable().default(null),
});

export type TeacherDashboardStudentActivity = z.infer<typeof teacherDashboardStudentActivitySchema>;

export const teacherDashboardMissionAggregateSchema = z.object({
  missionId: z.string().min(1),
  missionTitle: z.string().min(1),
  completionCount: z.number().int().nonnegative(),
  uniqueStudentCount: z.number().int().nonnegative(),
  latestCompletedAtIso: z.string().datetime().nullable().default(null),
});

export type TeacherDashboardMissionAggregate = z.infer<typeof teacherDashboardMissionAggregateSchema>;

export const teacherDashboardWorldAggregateSchema = z.object({
  worldId: z.string().min(1),
  completionCount: z.number().int().nonnegative(),
  uniqueStudentCount: z.number().int().nonnegative(),
  latestCompletedAtIso: z.string().datetime().nullable().default(null),
});

export type TeacherDashboardWorldAggregate = z.infer<typeof teacherDashboardWorldAggregateSchema>;

export const teacherDashboardAggregateMetadataSchema = z.object({
  studentCount: z.number().int().nonnegative(),
  activeStudentCount: z.number().int().nonnegative(),
  completionCount: z.number().int().nonnegative(),
  latestActivityAtIso: z.string().datetime().nullable().default(null),
  missions: z.array(teacherDashboardMissionAggregateSchema).readonly(),
  worlds: z.array(teacherDashboardWorldAggregateSchema).readonly(),
});

export type TeacherDashboardAggregateMetadata = z.infer<typeof teacherDashboardAggregateMetadataSchema>;

export const teacherDashboardMetaverseSourceSchema = z.object({
  kind: z.enum(["supabase-class-summary", "deterministic-local-preview"]),
  label: z.string().min(1),
  detail: z.string().min(1),
  fallbackReason: teacherDashboardMetaverseFallbackReasonSchema.nullable().default(null),
  diagnostics: z.object({
    mode: z.enum(["supabase", "local-preview"]),
    endpoint: z.string().min(1).nullable().default(null),
    classroomContext: z.enum(["resolved", "missing", "preview"]),
    queriedStudentCount: z.number().int().nonnegative(),
    matchedStudentCount: z.number().int().nonnegative(),
    readStatus: z.enum(["succeeded", "fallback", "failed"]),
    syncedAtIso: z.string().datetime().nullable().default(null),
  }),
});

export type TeacherDashboardMetaverseSource = z.infer<typeof teacherDashboardMetaverseSourceSchema>;

export const teacherDashboardMetaverseSummarySchema = z.object({
  version: z.literal(teacherDashboardMetaverseSummaryVersion),
  state: z.enum(["empty", "ready"]),
  scope: teacherDashboardMetaverseScopeSchema,
  recentMissionCompletions: z.array(teacherDashboardRecentMissionCompletionSchema).readonly(),
  studentActivity: z.array(teacherDashboardStudentActivitySchema).readonly(),
  aggregates: teacherDashboardAggregateMetadataSchema,
  source: teacherDashboardMetaverseSourceSchema,
});

export type TeacherDashboardMetaverseSummary = z.infer<typeof teacherDashboardMetaverseSummarySchema>;

export const teacherDashboardMetaverseContextSchema = z.object({
  classId: z.string().min(1).nullable().default(null),
  worldId: z.string().min(1).default("local-preview-world"),
  sessionId: z.string().min(1).nullable().default(null),
  students: z.array(teacherDashboardStudentReferenceSchema).readonly(),
});

export type TeacherDashboardMetaverseContext = z.infer<typeof teacherDashboardMetaverseContextSchema>;

export type TeacherDashboardMetaverseProgressPort = {
  readClassSummary(args: { classroom?: TeacherDashboardMetaverseContext | null }): Promise<TeacherDashboardMetaverseSummary>;
};

export function parseTeacherDashboardMetaverseContext(input: unknown): TeacherDashboardMetaverseContext {
  return teacherDashboardMetaverseContextSchema.parse(input);
}

export function parseTeacherDashboardMetaverseSummary(input: unknown): TeacherDashboardMetaverseSummary {
  return teacherDashboardMetaverseSummarySchema.parse(input);
}
