import { z } from "zod";

import {
  type WorldHubMissionResultReturnPayload,
  worldHubMissionResultReturnPayloadSchema,
} from "@/lib/world-hub/mission/resultHandoff";

const metaverseProgressSnapshotVersion = 1 as const;

export const metaverseProgressPersistenceStatusSchema = z.enum(["none", "persisted", "fallback-persisted"]);

export type MetaverseProgressPersistenceStatus = z.infer<typeof metaverseProgressPersistenceStatusSchema>;

export const metaverseProgressFallbackReasonSchema = z.enum([
  "env-missing",
  "unauthenticated",
  "route-unavailable",
  "write-failed",
  "read-failed",
  "invalid-payload",
  "storage-unavailable",
]);

export type MetaverseProgressFallbackReason = z.infer<typeof metaverseProgressFallbackReasonSchema>;

export const metaverseProgressRewardSummarySchema = z.object({
  summaryLabel: z.string().min(1),
  summaryDetail: z.string().min(1),
  highlightedRewardLabel: z.string().min(1).nullable().default(null),
  placeholderCount: z.number().int().nonnegative(),
  inventoryUpdateCount: z.number().int().nonnegative(),
});

export type MetaverseProgressRewardSummary = z.infer<typeof metaverseProgressRewardSummarySchema>;

export const metaverseRecentMissionCompletionSummarySchema = z.object({
  missionId: z.string().min(1),
  missionTitle: z.string().min(1),
  completedAtIso: z.string().datetime(),
  completionLabel: z.string().min(1),
  objectiveCount: z.number().int().positive(),
  completedObjectives: z.number().int().nonnegative(),
  percentComplete: z.number().min(0).max(100),
  resultLabel: z.string().min(1),
  resultDetail: z.string().min(1),
  rewardSummary: metaverseProgressRewardSummarySchema.nullable().default(null),
  returnHubPath: z.string().min(1),
});

export type MetaverseRecentMissionCompletionSummary = z.infer<typeof metaverseRecentMissionCompletionSummarySchema>;

export const metaverseLastCompletedMissionMetadataSchema = z.object({
  worldId: z.string().min(1).nullable(),
  sessionId: z.string().min(1).nullable(),
  missionId: z.string().min(1),
  missionTitle: z.string().min(1),
  completedAtIso: z.string().datetime(),
  issuedAtIso: z.string().datetime(),
  outcomeLabel: z.string().min(1),
  persistenceStatus: metaverseProgressPersistenceStatusSchema,
});

export type MetaverseLastCompletedMissionMetadata = z.infer<typeof metaverseLastCompletedMissionMetadataSchema>;

export const metaverseProgressPersistenceAckSchema = z.object({
  status: metaverseProgressPersistenceStatusSchema,
  label: z.string().min(1),
  detail: z.string().min(1),
});

export type MetaverseProgressPersistenceAck = z.infer<typeof metaverseProgressPersistenceAckSchema>;

export const metaverseHomeAnchorAcknowledgementSchema = z.object({
  missionId: z.string().min(1),
  missionTitle: z.string().min(1),
  completedAtIso: z.string().datetime(),
  title: z.string().min(1),
  detail: z.string().min(1),
  completionLabel: z.string().min(1),
  rewardLabel: z.string().min(1).nullable().default(null),
  persistenceLabel: z.string().min(1),
});

export type MetaverseHomeAnchorAcknowledgement = z.infer<typeof metaverseHomeAnchorAcknowledgementSchema>;

export const metaverseProgressSourceSchema = z.object({
  kind: z.enum(["supabase", "local-storage-fallback", "empty-local", "unavailable"]),
  label: z.string().min(1),
  detail: z.string().min(1).nullable().default(null),
  fallbackReason: metaverseProgressFallbackReasonSchema.nullable().default(null),
  diagnostics: z.object({
    mode: z.enum(["supabase", "local-fallback", "unavailable"]),
    storageKey: z.string().min(1).nullable().default(null),
    endpoint: z.string().min(1).nullable().default(null),
    userScoped: z.boolean(),
    readStatus: z.enum(["not-requested", "succeeded", "fallback", "failed"]),
    writeStatus: z.enum(["not-requested", "succeeded", "fallback", "failed"]),
    syncedAtIso: z.string().datetime().nullable().default(null),
  }),
});

export type MetaverseProgressSource = z.infer<typeof metaverseProgressSourceSchema>;

export const metaverseResolvedProgressSnapshotSchema = z.object({
  version: z.literal(metaverseProgressSnapshotVersion),
  state: z.enum(["empty", "ready"]),
  recentMissionCompletion: metaverseRecentMissionCompletionSummarySchema.nullable().default(null),
  lastCompletedMission: metaverseLastCompletedMissionMetadataSchema.nullable().default(null),
  persistedCompletion: metaverseProgressPersistenceAckSchema.nullable().default(null),
  homeAcknowledgement: metaverseHomeAnchorAcknowledgementSchema.nullable().default(null),
  source: metaverseProgressSourceSchema,
});

export type MetaverseResolvedProgressSnapshot = z.infer<typeof metaverseResolvedProgressSnapshotSchema>;

export const metaverseProgressWriteResultSchema = z.object({
  status: z.enum(["persisted", "fallback-persisted", "unavailable"]),
  snapshot: metaverseResolvedProgressSnapshotSchema,
});

export type MetaverseProgressWriteResult = z.infer<typeof metaverseProgressWriteResultSchema>;

export const metaverseProgressWriteRequestSchema = z.object({
  payload: worldHubMissionResultReturnPayloadSchema,
});

export type MetaverseProgressWriteRequest = z.infer<typeof metaverseProgressWriteRequestSchema>;

export type MetaverseProgressPersistencePort = {
  readSnapshot(): Promise<MetaverseResolvedProgressSnapshot>;
  persistCompletion(args: { payload: WorldHubMissionResultReturnPayload }): Promise<MetaverseProgressWriteResult>;
};

function createPersistenceAck(args: {
  missionTitle: string;
  status: MetaverseProgressPersistenceStatus;
}): MetaverseProgressPersistenceAck {
  switch (args.status) {
    case "persisted":
      return {
        status: "persisted",
        label: `${args.missionTitle} saved`,
        detail: "Mission completion snapshot persisted for the next world-hub visit.",
      };
    case "fallback-persisted":
      return {
        status: "fallback-persisted",
        label: `${args.missionTitle} saved locally`,
        detail: "Preview-safe local persistence stored this completion until Supabase is available.",
      };
    default:
      return {
        status: "none",
        label: `${args.missionTitle} not saved`,
        detail: "Persistence remains optional for this completion handoff.",
      };
  }
}

function createHomeAnchorAcknowledgement(args: {
  payload: WorldHubMissionResultReturnPayload;
  persistenceAck: MetaverseProgressPersistenceAck;
}): MetaverseHomeAnchorAcknowledgement {
  const rewardLabel =
    args.payload.rewards.status === "placeholder"
      ? `${args.payload.rewards.summaryLabel}${args.payload.rewards.highlightedRewardLabel ? ` · ${args.payload.rewards.highlightedRewardLabel}` : ""}`
      : args.payload.rewards.summaryLabel;

  const detail =
    args.persistenceAck.status === "persisted"
      ? `Basecamp tucked away your return from ${args.payload.missionTitle}. ${args.payload.rewards.summaryDetail}`
      : args.persistenceAck.status === "fallback-persisted"
        ? `Basecamp kept your return from ${args.payload.missionTitle} on this device for now. ${args.payload.rewards.summaryDetail}`
        : `Basecamp noticed your return from ${args.payload.missionTitle}. ${args.payload.rewards.summaryDetail}`;

  return metaverseHomeAnchorAcknowledgementSchema.parse({
    missionId: args.payload.missionId,
    missionTitle: args.payload.missionTitle,
    completedAtIso: args.payload.completedAtIso,
    title: `${args.payload.missionTitle} made it home`,
    detail,
    completionLabel: `${args.payload.summary.completionLabel} · ${args.payload.summary.percentComplete}%`,
    rewardLabel,
    persistenceLabel: args.persistenceAck.label,
  });
}

export function createEmptyMetaverseProgressSnapshot(args?: {
  source?: Partial<MetaverseProgressSource>;
}): MetaverseResolvedProgressSnapshot {
  return metaverseResolvedProgressSnapshotSchema.parse({
    version: metaverseProgressSnapshotVersion,
    state: "empty",
    recentMissionCompletion: null,
    lastCompletedMission: null,
    persistedCompletion: null,
    homeAcknowledgement: null,
    source: {
      kind: args?.source?.kind ?? "unavailable",
      label: args?.source?.label ?? "Progress persistence unavailable",
      detail: args?.source?.detail ?? "No persisted metaverse progress snapshot is currently available.",
      fallbackReason: args?.source?.fallbackReason ?? null,
      diagnostics: {
        mode: "unavailable",
        storageKey: null,
        endpoint: null,
        userScoped: false,
        readStatus: "not-requested",
        writeStatus: "not-requested",
        syncedAtIso: null,
        ...args?.source?.diagnostics,
      },
    },
  });
}

export function createMetaverseProgressSnapshotFromMissionResult(args: {
  payload: WorldHubMissionResultReturnPayload;
  persistenceStatus: Extract<MetaverseProgressWriteResult["status"], "persisted" | "fallback-persisted">;
  source: MetaverseProgressSource;
}): MetaverseResolvedProgressSnapshot {
  const persistenceStatus =
    args.persistenceStatus === "persisted" ? "persisted" : "fallback-persisted";
  const persistenceAck = createPersistenceAck({
    missionTitle: args.payload.missionTitle,
    status: persistenceStatus,
  });

  return metaverseResolvedProgressSnapshotSchema.parse({
    version: metaverseProgressSnapshotVersion,
    state: "ready",
    recentMissionCompletion: {
      missionId: args.payload.missionId,
      missionTitle: args.payload.missionTitle,
      completedAtIso: args.payload.completedAtIso,
      completionLabel: args.payload.summary.completionLabel,
      objectiveCount: args.payload.summary.objectiveCount,
      completedObjectives: args.payload.summary.completedObjectives,
      percentComplete: args.payload.summary.percentComplete,
      resultLabel: args.payload.summary.resultLabel,
      resultDetail: args.payload.summary.resultDetail,
      rewardSummary: {
        summaryLabel: args.payload.rewards.summaryLabel,
        summaryDetail: args.payload.rewards.summaryDetail,
        highlightedRewardLabel: args.payload.rewards.highlightedRewardLabel,
        placeholderCount: args.payload.rewards.placeholderCount,
        inventoryUpdateCount: args.payload.rewards.inventoryUpdateCount,
      },
      returnHubPath: args.payload.returnHubPath,
    },
    lastCompletedMission: {
      worldId: args.payload.worldId,
      sessionId: args.payload.sessionId,
      missionId: args.payload.missionId,
      missionTitle: args.payload.missionTitle,
      completedAtIso: args.payload.completedAtIso,
      issuedAtIso: args.payload.issuedAtIso,
      outcomeLabel: args.payload.outcome.label,
      persistenceStatus,
    },
    persistedCompletion: persistenceAck,
    homeAcknowledgement: createHomeAnchorAcknowledgement({
      payload: args.payload,
      persistenceAck,
    }),
    source: args.source,
  });
}

export function parseMetaverseResolvedProgressSnapshot(input: unknown): MetaverseResolvedProgressSnapshot {
  return metaverseResolvedProgressSnapshotSchema.parse(input);
}

export function parseMetaverseProgressWriteResult(input: unknown): MetaverseProgressWriteResult {
  return metaverseProgressWriteResultSchema.parse(input);
}

export function parseMetaverseProgressWriteRequest(input: unknown): MetaverseProgressWriteRequest {
  return metaverseProgressWriteRequestSchema.parse(input);
}

export function parseStoredMetaverseMissionResultPayload(input: unknown): WorldHubMissionResultReturnPayload {
  return worldHubMissionResultReturnPayloadSchema.parse(input);
}
