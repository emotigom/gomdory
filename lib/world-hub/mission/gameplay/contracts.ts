import { z } from "zod";

import type {
  MissionRoomLoadedSceneConfig,
  MissionRoomResolvedBootstrap,
  MissionRoomRouteSeed,
} from "@/lib/world-hub/mission/contracts";
import type { MissionRoomResolvedAccessPolicy } from "@/lib/world-hub/policy/contracts";
import type { AuthoritativeSessionProjection } from "@/lib/world-hub/runtime/sessionProjection";

export const missionGameplayLifecycleStatusSchema = z.enum([
  "queued",
  "briefing",
  "active",
  "completed",
  "failed",
]);

export type MissionGameplayLifecycleStatus = z.infer<typeof missionGameplayLifecycleStatusSchema>;

export const missionGameplayResolutionStatusSchema = z.enum(["pending", "completed", "failed"]);

export type MissionGameplayResolutionStatus = z.infer<typeof missionGameplayResolutionStatusSchema>;

export const missionGameplaySourceKindSchema = z.enum(["deterministic-local", "worker-owned"]);

export type MissionGameplaySourceKind = z.infer<typeof missionGameplaySourceKindSchema>;

export const missionGameplayDiagnosticsSchema = z.object({
  adapterKind: missionGameplaySourceKindSchema,
  owner: z.enum(["local-preview", "worker-pending"]),
  deterministic: z.boolean(),
  progressionMode: z.enum(["local-sequence", "authoritative-placeholder"]),
  sequence: z.number().int().nonnegative(),
  transitionCount: z.number().int().nonnegative(),
  bootstrapObjectiveState: z.enum(["briefing", "ready", "queued"]),
  policyStatus: z.enum(["allowed", "blocked"]),
  lastEvent: z.enum(["initialized", "advanced", "completed", "failed"]),
  lastUpdatedAtIso: z.string().datetime(),
});

export type MissionGameplayDiagnostics = z.infer<typeof missionGameplayDiagnosticsSchema>;

export const missionGameplaySourceSchema = z.object({
  kind: missionGameplaySourceKindSchema,
  label: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
  diagnostics: missionGameplayDiagnosticsSchema,
});

export type MissionGameplaySource = z.infer<typeof missionGameplaySourceSchema>;

export const missionGameplayObjectiveSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().min(1),
  stepIndex: z.number().int().positive(),
  totalSteps: z.number().int().positive(),
  status: z.enum(["pending", "active", "completed"]),
  callToAction: z.string().min(1).nullable().default(null),
});

export type MissionGameplayObjective = z.infer<typeof missionGameplayObjectiveSchema>;

export const missionGameplayProgressSchema = z.object({
  completedObjectives: z.number().int().nonnegative(),
  totalObjectives: z.number().int().positive(),
  percent: z.number().min(0).max(100),
  remainingObjectives: z.number().int().nonnegative(),
  statusLabel: z.string().min(1),
});

export type MissionGameplayProgress = z.infer<typeof missionGameplayProgressSchema>;

export const missionGameplayResolutionSchema = z.object({
  status: missionGameplayResolutionStatusSchema,
  label: z.string().min(1),
  detail: z.string().min(1),
  occurredAtIso: z.string().datetime().nullable().default(null),
});

export type MissionGameplayResolution = z.infer<typeof missionGameplayResolutionSchema>;

export const missionGameplayStateSchema = z.object({
  missionId: z.string().min(1),
  lifecycle: z.object({
    status: missionGameplayLifecycleStatusSchema,
    label: z.string().min(1),
    detail: z.string().min(1),
  }),
  objective: missionGameplayObjectiveSchema,
  progress: missionGameplayProgressSchema,
  resolution: missionGameplayResolutionSchema,
  source: missionGameplaySourceSchema,
});

export type MissionGameplayState = z.infer<typeof missionGameplayStateSchema>;

export type MissionGameplayStatePort = {
  resolveInitialState(args: {
    routeSeed: MissionRoomRouteSeed;
    loadedSceneConfig: MissionRoomLoadedSceneConfig;
    bootstrap: MissionRoomResolvedBootstrap;
    session: AuthoritativeSessionProjection;
    policy: MissionRoomResolvedAccessPolicy;
  }): Promise<MissionGameplayState>;
  advance(args: {
    current: MissionGameplayState;
    routeSeed: MissionRoomRouteSeed;
    loadedSceneConfig: MissionRoomLoadedSceneConfig;
    bootstrap: MissionRoomResolvedBootstrap;
    session: AuthoritativeSessionProjection;
    policy: MissionRoomResolvedAccessPolicy;
  }): Promise<MissionGameplayState>;
};

export function parseMissionGameplayState(input: unknown): MissionGameplayState {
  return missionGameplayStateSchema.parse(input);
}
