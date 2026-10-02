import { z } from "zod";

import type { WorldHubSceneManifest } from "@/lib/world-hub/contracts";
import type {
  MissionRoomLoadedSceneConfig,
  MissionRoomRouteSeed,
} from "@/lib/world-hub/mission/contracts";

export const accessPolicyResolutionSchema = z.enum(["resolved", "fallback"]);

export type AccessPolicyResolution = z.infer<typeof accessPolicyResolutionSchema>;

export const accessPolicyFallbackReasonSchema = z.enum([
  "policy-disabled",
  "unavailable-policy",
  "invalid-policy",
  "scope-mismatch",
]);

export type AccessPolicyFallbackReason = z.infer<typeof accessPolicyFallbackReasonSchema>;

export const accessPolicySourceSchema = z.object({
  kind: z.enum(["local-preview", "edge-policy"]),
  label: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
  fallbackReason: accessPolicyFallbackReasonSchema.nullable().default(null),
});

export type AccessPolicySource = z.infer<typeof accessPolicySourceSchema>;

export const accessPolicyScopeSchema = z.object({
  classId: z.string().min(1).nullable().default(null),
  sessionId: z.string().min(1).nullable().default(null),
  worldId: z.string().min(1),
  missionId: z.string().min(1).nullable().default(null),
});

export type AccessPolicyScope = z.infer<typeof accessPolicyScopeSchema>;

export const accessPolicyDecisionCodeSchema = z.enum([
  "allowed",
  "preview-allowed",
  "teacher-blocked",
  "class-inactive",
  "session-inactive",
  "world-mismatch",
  "mission-mismatch",
  "policy-unavailable",
  "invalid-policy",
  "unknown",
]);

export type AccessPolicyDecisionCode = z.infer<typeof accessPolicyDecisionCodeSchema>;

export const accessPolicyDecisionSchema = z.object({
  status: z.enum(["allowed", "blocked"]),
  code: accessPolicyDecisionCodeSchema,
  label: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
});

export type AccessPolicyDecision = z.infer<typeof accessPolicyDecisionSchema>;

export const accessPolicyPreviewBehaviorSchema = z.object({
  mode: z.enum(["allow-local-preview", "require-resolved-policy"]),
  fallback: z.enum(["allow", "block"]),
  label: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
});

export type AccessPolicyPreviewBehavior = z.infer<typeof accessPolicyPreviewBehaviorSchema>;

export const accessPolicyDiagnosticsSchema = z.object({
  adapterKind: z.enum(["local-preview-snapshot", "edge-policy-response", "edge-policy-fallback"]),
  resolution: accessPolicyResolutionSchema,
  scopeAlignment: z.enum(["matched", "unscoped", "world-mismatch", "mission-mismatch"]),
  evaluatedAtIso: z.string().datetime(),
  summary: z.string().min(1),
});

export type AccessPolicyDiagnostics = z.infer<typeof accessPolicyDiagnosticsSchema>;

export const worldHubMissionAccessPolicySchema = z.object({
  missionId: z.string().min(1),
  decision: accessPolicyDecisionSchema,
});

export type WorldHubMissionAccessPolicy = z.infer<typeof worldHubMissionAccessPolicySchema>;

export const worldHubResolvedAccessPolicySchema = z.object({
  runtime: z.literal("world-hub"),
  scope: accessPolicyScopeSchema.extend({
    missionId: z.null(),
  }),
  source: accessPolicySourceSchema,
  resolution: accessPolicyResolutionSchema,
  preview: accessPolicyPreviewBehaviorSchema,
  entry: accessPolicyDecisionSchema,
  missions: z.array(worldHubMissionAccessPolicySchema).readonly(),
  diagnostics: accessPolicyDiagnosticsSchema,
});

export type WorldHubResolvedAccessPolicy = z.infer<typeof worldHubResolvedAccessPolicySchema>;

export const missionRoomResolvedAccessPolicySchema = z.object({
  runtime: z.literal("mission-room"),
  scope: accessPolicyScopeSchema,
  source: accessPolicySourceSchema,
  resolution: accessPolicyResolutionSchema,
  preview: accessPolicyPreviewBehaviorSchema,
  entry: accessPolicyDecisionSchema,
  diagnostics: accessPolicyDiagnosticsSchema,
});

export type MissionRoomResolvedAccessPolicy = z.infer<typeof missionRoomResolvedAccessPolicySchema>;

export const worldHubAccessPolicyResponseSchema = z.object({
  scope: accessPolicyScopeSchema.extend({
    missionId: z.null(),
  }),
  preview: accessPolicyPreviewBehaviorSchema,
  entry: accessPolicyDecisionSchema,
  missions: z.array(worldHubMissionAccessPolicySchema).readonly(),
});

export type WorldHubAccessPolicyResponse = z.infer<typeof worldHubAccessPolicyResponseSchema>;

export const missionRoomAccessPolicyResponseSchema = z.object({
  scope: accessPolicyScopeSchema,
  preview: accessPolicyPreviewBehaviorSchema,
  entry: accessPolicyDecisionSchema,
});

export type MissionRoomAccessPolicyResponse = z.infer<typeof missionRoomAccessPolicyResponseSchema>;

export type WorldHubAccessPolicyPort = {
  resolvePolicy(manifest: WorldHubSceneManifest): Promise<WorldHubResolvedAccessPolicy>;
};

export type MissionRoomAccessPolicyPort = {
  resolvePolicy(args: {
    routeSeed: MissionRoomRouteSeed;
    loadedSceneConfig: MissionRoomLoadedSceneConfig;
  }): Promise<MissionRoomResolvedAccessPolicy>;
};

export function parseWorldHubResolvedAccessPolicy(input: unknown): WorldHubResolvedAccessPolicy {
  return worldHubResolvedAccessPolicySchema.parse(input);
}

export function parseMissionRoomResolvedAccessPolicy(input: unknown): MissionRoomResolvedAccessPolicy {
  return missionRoomResolvedAccessPolicySchema.parse(input);
}

export function parseWorldHubAccessPolicyResponse(input: unknown): WorldHubAccessPolicyResponse {
  return worldHubAccessPolicyResponseSchema.parse(input);
}

export function parseMissionRoomAccessPolicyResponse(input: unknown): MissionRoomAccessPolicyResponse {
  return missionRoomAccessPolicyResponseSchema.parse(input);
}

export function isWorldHubEntryBlocked(policy: WorldHubResolvedAccessPolicy) {
  return policy.entry.status === "blocked";
}

export function getWorldHubMissionPolicyDecision(args: {
  policy: WorldHubResolvedAccessPolicy;
  missionId: string;
}) {
  return args.policy.missions.find((mission) => mission.missionId === args.missionId)?.decision ?? null;
}

export function isMissionRoomEntryBlocked(policy: MissionRoomResolvedAccessPolicy) {
  return policy.entry.status === "blocked";
}
