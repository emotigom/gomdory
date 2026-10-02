import { z } from "zod";

import { metaverseMissionRewardHookResolvedSchema } from "@/lib/world-hub/rewards/contracts";

import type {
  MissionRoomLoadedSceneConfig,
  MissionRoomResolvedBootstrap,
  MissionRoomRouteSeed,
} from "@/lib/world-hub/mission/contracts";
import type { MissionGameplayState } from "@/lib/world-hub/mission/gameplay/contracts";
import type { MissionRoomResolvedAccessPolicy } from "@/lib/world-hub/policy/contracts";
import type { AuthoritativeSessionProjection } from "@/lib/world-hub/runtime/sessionProjection";

export const missionCompletionOutcomeStatusSchema = z.enum(["pending", "completed", "failed"]);

export type MissionCompletionOutcomeStatus = z.infer<typeof missionCompletionOutcomeStatusSchema>;

export const missionCompletionRewardStatusSchema = z.enum(["pending", "placeholder", "unavailable"]);

export type MissionCompletionRewardStatus = z.infer<typeof missionCompletionRewardStatusSchema>;

export const missionCompletionResultKindSchema = z.enum(["preview", "validated-placeholder", "failed-placeholder"]);

export type MissionCompletionResultKind = z.infer<typeof missionCompletionResultKindSchema>;

export const missionCompletionSourceKindSchema = z.enum(["deterministic-local", "worker-validated-placeholder"]);

export type MissionCompletionSourceKind = z.infer<typeof missionCompletionSourceKindSchema>;

export const missionCompletionMetadataSchema = z.object({
  completedAtIso: z.string().datetime().nullable().default(null),
  objectiveCount: z.number().int().positive(),
  completedObjectives: z.number().int().nonnegative(),
  percentComplete: z.number().min(0).max(100),
  routeMode: z.enum(["validated-handoff", "local-fallback"]),
  runtimeAuthority: z.enum(["local-preview", "edge-worker"]),
  validationState: z.enum(["not-requested", "worker-pending", "authoritative-placeholder"]),
  returnFlow: z.object({
    available: z.boolean(),
    hubPath: z.string().min(1),
    label: z.string().min(1),
  }),
});

export type MissionCompletionMetadata = z.infer<typeof missionCompletionMetadataSchema>;

export const missionCompletionRewardPlaceholderSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["badge", "inventory", "report", "hub-return"]),
  label: z.string().min(1),
  detail: z.string().min(1),
  quantity: z.number().int().positive().nullable().default(null),
  status: missionCompletionRewardStatusSchema,
});

export type MissionCompletionRewardPlaceholder = z.infer<typeof missionCompletionRewardPlaceholderSchema>;

export const missionCompletionDiagnosticsSchema = z.object({
  adapterKind: missionCompletionSourceKindSchema,
  deterministic: z.boolean(),
  derivedFrom: z.enum(["gameplay-state", "worker-snapshot-placeholder"]),
  lastEvent: z.enum(["initialized", "progress-updated", "completion-ready", "failure-ready"]),
  sequence: z.number().int().nonnegative(),
  transitionCount: z.number().int().nonnegative(),
  resultVersion: z.string().min(1),
  rewardIntegration: z.enum(["not-connected", "placeholder-only"]),
  persistence: z.enum(["none", "supabase-placeholder"]),
  reporting: z.enum(["none", "teacher-placeholder"]),
  validatedBy: z.enum(["local-preview", "worker-pending"]),
  emittedAtIso: z.string().datetime(),
});

export type MissionCompletionDiagnostics = z.infer<typeof missionCompletionDiagnosticsSchema>;

export const missionCompletionSourceSchema = z.object({
  kind: missionCompletionSourceKindSchema,
  label: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
  diagnostics: missionCompletionDiagnosticsSchema,
});

export type MissionCompletionSource = z.infer<typeof missionCompletionSourceSchema>;

export const missionCompletionOutcomeSchema = z.object({
  status: missionCompletionOutcomeStatusSchema,
  label: z.string().min(1),
  detail: z.string().min(1),
});

export type MissionCompletionOutcome = z.infer<typeof missionCompletionOutcomeSchema>;

export const missionCompletionResultSchema = z.object({
  kind: missionCompletionResultKindSchema,
  label: z.string().min(1),
  detail: z.string().min(1),
  teacherReportStatus: z.enum(["not-generated", "placeholder-ready"]),
  inventoryStatus: z.enum(["not-issued", "placeholder-ready", "unavailable"]),
  nextActionLabel: z.string().min(1).nullable().default(null),
});

export type MissionCompletionResult = z.infer<typeof missionCompletionResultSchema>;

export const missionCompletionResolvedStateSchema = z.object({
  missionId: z.string().min(1),
  outcome: missionCompletionOutcomeSchema,
  metadata: missionCompletionMetadataSchema,
  result: missionCompletionResultSchema,
  rewards: z.object({
    status: missionCompletionRewardStatusSchema,
    placeholders: z.array(missionCompletionRewardPlaceholderSchema).readonly(),
    summary: metaverseMissionRewardHookResolvedSchema,
  }),
  source: missionCompletionSourceSchema,
});

export type MissionCompletionResolvedState = z.infer<typeof missionCompletionResolvedStateSchema>;

export type MissionCompletionPort = {
  resolveInitialResult(args: {
    routeSeed: MissionRoomRouteSeed;
    loadedSceneConfig: MissionRoomLoadedSceneConfig;
    bootstrap: MissionRoomResolvedBootstrap;
    session: AuthoritativeSessionProjection;
    policy: MissionRoomResolvedAccessPolicy;
    gameplay: MissionGameplayState;
  }): Promise<MissionCompletionResolvedState>;
  syncResolvedResult(args: {
    current: MissionCompletionResolvedState | null;
    routeSeed: MissionRoomRouteSeed;
    loadedSceneConfig: MissionRoomLoadedSceneConfig;
    bootstrap: MissionRoomResolvedBootstrap;
    session: AuthoritativeSessionProjection;
    policy: MissionRoomResolvedAccessPolicy;
    gameplay: MissionGameplayState;
  }): Promise<MissionCompletionResolvedState>;
};

export function parseMissionCompletionResolvedState(input: unknown): MissionCompletionResolvedState {
  return missionCompletionResolvedStateSchema.parse(input);
}
