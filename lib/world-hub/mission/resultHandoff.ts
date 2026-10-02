import { z } from "zod";

import type { MissionRoomRuntimeInputs } from "@/lib/world-hub/mission/contracts";

export const WORLD_HUB_MISSION_RESULT_QUERY_KEY = "missionResult";

const missionResultReturnContractVersion = 1 as const;
const missionResultReturnSource = "mission-room" as const;
const defaultMissionResultReturnMaxAgeMs = 1000 * 60 * 15;

export const worldHubMissionResultReturnPayloadSchema = z.object({
  version: z.literal(missionResultReturnContractVersion),
  source: z.literal(missionResultReturnSource),
  worldId: z.string().min(1).nullable(),
  sessionId: z.string().min(1).nullable(),
  missionId: z.string().min(1),
  missionTitle: z.string().min(1),
  returnHubPath: z.string().min(1),
  issuedAtIso: z.string().datetime(),
  completedAtIso: z.string().datetime(),
  outcome: z.object({
    status: z.literal("completed"),
    label: z.string().min(1),
  }),
  summary: z.object({
    completionLabel: z.string().min(1),
    objectiveCount: z.number().int().positive(),
    completedObjectives: z.number().int().nonnegative(),
    percentComplete: z.number().min(0).max(100),
    resultLabel: z.string().min(1),
    resultDetail: z.string().min(1),
  }),
  rewards: z.object({
    status: z.enum(["pending", "placeholder", "unavailable"]),
    summaryLabel: z.string().min(1),
    summaryDetail: z.string().min(1),
    highlightedRewardLabel: z.string().min(1).nullable(),
    placeholderCount: z.number().int().nonnegative(),
    inventoryUpdateCount: z.number().int().nonnegative(),
    sourceLabel: z.string().min(1),
    fallbackLabel: z.string().min(1),
  }),
  integrations: z.object({
    rewardHook: z.enum(["pending", "deterministic-local-placeholder"]),
    persistence: z.enum(["pending-write", "persisted", "fallback-local", "not-connected"]),
    reporting: z.enum(["not-connected"]),
  }),
});

export type WorldHubMissionResultReturnPayload = z.infer<typeof worldHubMissionResultReturnPayloadSchema>;

export const worldHubMissionResultReturnEnvelopeSchema = z.object({
  payload: worldHubMissionResultReturnPayloadSchema,
  freshness: z.object({
    status: z.enum(["recent", "stale"]),
    ageMs: z.number().int().nonnegative(),
    maxAgeMs: z.number().int().positive(),
  }),
  ack: z.object({
    title: z.string().min(1),
    detail: z.string().min(1),
    completionLabel: z.string().min(1),
    rewardLabel: z.string().min(1),
    integrationLabel: z.string().min(1),
  }),
});

export type WorldHubMissionResultReturnEnvelope = z.infer<typeof worldHubMissionResultReturnEnvelopeSchema>;

export function parseWorldHubMissionResultReturnPayload(input: unknown): WorldHubMissionResultReturnPayload {
  return worldHubMissionResultReturnPayloadSchema.parse(input);
}

export function createWorldHubMissionResultReturnPayload(args: {
  runtime: MissionRoomRuntimeInputs;
  now?: Date;
}): WorldHubMissionResultReturnPayload {
  const { runtime } = args;

  if (runtime.completion.outcome.status !== "completed" || !runtime.completion.metadata.completedAtIso) {
    throw new Error("Mission result return payload requires a completed mission result.");
  }

  return parseWorldHubMissionResultReturnPayload({
    version: missionResultReturnContractVersion,
    source: missionResultReturnSource,
    worldId: runtime.handoff.worldId,
    sessionId: runtime.handoff.sessionId,
    missionId: runtime.route.missionId,
    missionTitle: runtime.scene.title,
    returnHubPath: runtime.route.returnHubPath,
    issuedAtIso: (args.now ?? new Date()).toISOString(),
    completedAtIso: runtime.completion.metadata.completedAtIso,
    outcome: {
      status: "completed",
      label: runtime.completion.outcome.label,
    },
    summary: {
      completionLabel: `${runtime.completion.metadata.completedObjectives}/${runtime.completion.metadata.objectiveCount} objectives complete`,
      objectiveCount: runtime.completion.metadata.objectiveCount,
      completedObjectives: runtime.completion.metadata.completedObjectives,
      percentComplete: runtime.completion.metadata.percentComplete,
      resultLabel: runtime.completion.result.label,
      resultDetail: runtime.completion.result.detail,
    },
    rewards: {
      status: runtime.completion.rewards.summary.status,
      summaryLabel: runtime.completion.rewards.summary.summary.label,
      summaryDetail: runtime.completion.rewards.summary.summary.detail,
      highlightedRewardLabel: runtime.completion.rewards.summary.summary.highlightedRewardLabel,
      placeholderCount: runtime.completion.rewards.summary.summary.placeholderCount,
      inventoryUpdateCount: runtime.completion.rewards.summary.summary.inventoryUpdateCount,
      sourceLabel: runtime.completion.rewards.summary.source.label,
      fallbackLabel: runtime.completion.rewards.summary.fallback.label,
    },
    integrations: {
      rewardHook:
        runtime.completion.rewards.summary.source.kind === "deterministic-local"
          ? "deterministic-local-placeholder"
          : "pending",
      persistence: "pending-write",
      reporting: "not-connected",
    },
  });
}

export function withWorldHubMissionResultPersistenceStatus(
  payload: WorldHubMissionResultReturnPayload,
  status: "pending-write" | "persisted" | "fallback-local" | "not-connected",
): WorldHubMissionResultReturnPayload {
  return worldHubMissionResultReturnPayloadSchema.parse({
    ...payload,
    integrations: {
      ...payload.integrations,
      persistence: status,
    },
  });
}

export function serializeWorldHubMissionResultReturnPayload(payload: WorldHubMissionResultReturnPayload): string {
  return JSON.stringify(payload);
}

export function createWorldHubReturnRouteWithMissionResult(args: {
  hubPath: string;
  payload: WorldHubMissionResultReturnPayload;
}): string {
  const params = new URLSearchParams({
    [WORLD_HUB_MISSION_RESULT_QUERY_KEY]: serializeWorldHubMissionResultReturnPayload(args.payload),
  });

  return `${args.hubPath}?${params.toString()}`;
}

function createMissionResultAck(payload: WorldHubMissionResultReturnPayload) {
  return {
    title: `${payload.missionTitle} complete`,
    detail: payload.rewards.summaryDetail,
    completionLabel: `${payload.summary.completionLabel} · ${payload.summary.percentComplete}%`,
    rewardLabel:
      payload.rewards.status === "placeholder"
        ? `${payload.rewards.summaryLabel}${payload.rewards.highlightedRewardLabel ? ` · ${payload.rewards.highlightedRewardLabel}` : ""}`
        : payload.rewards.summaryLabel,
    integrationLabel:
      payload.integrations.persistence === "persisted"
        ? `Progress saved. ${payload.rewards.fallbackLabel} remains a replaceable seam.`
        : payload.integrations.persistence === "fallback-local"
          ? `Progress saved in local fallback mode. ${payload.rewards.fallbackLabel} remains preview-safe.`
          : payload.integrations.persistence === "pending-write"
            ? `Progress persistence is still pending. ${payload.rewards.sourceLabel} is ready for the next seam.`
            : `${payload.rewards.sourceLabel} remains replaceable alongside persistence and reporting.`,
  };
}

export function normalizeRecentWorldHubMissionResultReturn(args: {
  payload: WorldHubMissionResultReturnPayload;
  now?: Date;
  maxAgeMs?: number;
}): WorldHubMissionResultReturnEnvelope | null {
  const nowMs = (args.now ?? new Date()).getTime();
  const issuedAtMs = new Date(args.payload.issuedAtIso).getTime();
  const ageMs = Math.max(0, nowMs - issuedAtMs);
  const maxAgeMs = args.maxAgeMs ?? defaultMissionResultReturnMaxAgeMs;
  const freshnessStatus = ageMs <= maxAgeMs ? "recent" : "stale";

  if (freshnessStatus !== "recent") {
    return null;
  }

  return worldHubMissionResultReturnEnvelopeSchema.parse({
    payload: args.payload,
    freshness: {
      status: freshnessStatus,
      ageMs,
      maxAgeMs,
    },
    ack: createMissionResultAck(args.payload),
  });
}

export function parseRecentMissionResultReturnFromSearchParams(args: {
  resultParam: string | string[] | undefined;
  now?: Date;
  maxAgeMs?: number;
}): WorldHubMissionResultReturnEnvelope | null {
  const resultText = Array.isArray(args.resultParam) ? args.resultParam[0] : args.resultParam;

  if (!resultText) {
    return null;
  }

  try {
    const payload = parseWorldHubMissionResultReturnPayload(JSON.parse(resultText));
    return normalizeRecentWorldHubMissionResultReturn({
      payload,
      now: args.now,
      maxAgeMs: args.maxAgeMs,
    });
  } catch {
    return null;
  }
}
