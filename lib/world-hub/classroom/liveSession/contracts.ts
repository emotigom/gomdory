import { z } from "zod";

import { sessionAuthorityScopeSchema } from "@/lib/world-hub/bootstrap/sessionMetadata";
import { configFallbackReasonSchema } from "@/lib/world-hub/config/sourceContracts";
import {
  classScheduledLaunchContextSchema,
  resolvedClassScheduledLaunchTimingSchema,
} from "@/lib/world-hub/classroom/scheduledLaunch/contracts";

export const teacherLiveSessionControlStateSchema = z.object({
  phase: z.enum(["open-exploration", "guided-briefing", "mission-transition"]),
  missionStartPolicy: z.enum(["open", "teacher-cued"]),
  guidanceLevel: z.enum(["ambient", "focused"]),
  guidanceVariant: z.enum(["trail", "campfire", "launchpad"]),
});

export type TeacherLiveSessionControlState = z.infer<typeof teacherLiveSessionControlStateSchema>;

export const studentLiveSessionGuidanceSchema = z.object({
  status: z.enum(["self-paced-open", "teacher-guided", "mission-starting-soon"]),
  missionStart: z.enum(["self-serve", "teacher-cued"]),
  cueState: z.enum(["none", "gather_at_plaza", "prepare_at_academy", "start_mission"]),
  title: z.string().min(1),
  detail: z.string().min(1),
  hint: z.string().min(1),
  guidanceVariant: teacherLiveSessionControlStateSchema.shape.guidanceVariant,
});

export type StudentLiveSessionGuidance = z.infer<typeof studentLiveSessionGuidanceSchema>;

export const teacherLiveSessionControlContextSchema = classScheduledLaunchContextSchema;

export type TeacherLiveSessionControlContext = z.infer<typeof teacherLiveSessionControlContextSchema>;

export const resolvedTeacherLiveSessionSnapshotSchema = z.object({
  state: teacherLiveSessionControlStateSchema,
  studentGuidance: studentLiveSessionGuidanceSchema,
  scheduledLaunch: resolvedClassScheduledLaunchTimingSchema,
  source: z.object({
    kind: z.enum(["local-preview", "authoritative-worker"]),
    label: z.string().min(1),
    detail: z.string().min(1).nullable().default(null),
    fallbackReason: configFallbackReasonSchema.nullable().default(null),
    diagnostics: z.object({
      adapterKind: z.enum(["local-preview", "worker-orchestrated"]),
      scope: sessionAuthorityScopeSchema,
      hasClassContext: z.boolean(),
      hasMissionContext: z.boolean(),
      resolvedAtIso: z.string().datetime(),
    }),
  }),
});

export type ResolvedTeacherLiveSessionSnapshot = z.infer<typeof resolvedTeacherLiveSessionSnapshotSchema>;

export type TeacherLiveSessionControlPort = {
  resolveSnapshot(args: { context: TeacherLiveSessionControlContext }): Promise<ResolvedTeacherLiveSessionSnapshot>;
};

export function parseResolvedTeacherLiveSessionSnapshot(input: unknown): ResolvedTeacherLiveSessionSnapshot {
  return resolvedTeacherLiveSessionSnapshotSchema.parse(input);
}
