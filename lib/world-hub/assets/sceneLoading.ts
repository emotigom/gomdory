import { z } from "zod";

import {
  assetManifestFallbackReasonSchema,
  assetManifestSourceKindSchema,
  missionRoomAssetRoleSchema,
  missionRoomResolvedAssetDescriptorSchema,
  parseMissionRoomResolvedAssetSet,
  parseWorldHubResolvedAssetSet,
  worldHubAssetRoleSchema,
  worldHubResolvedAssetDescriptorSchema,
  type MissionRoomAssetRole,
  type MissionRoomResolvedAssetDescriptor,
  type MissionRoomResolvedAssetSet,
  type WorldHubAssetRole,
  type WorldHubResolvedAssetDescriptor,
  type WorldHubResolvedAssetSet,
} from "@/lib/world-hub/assets/contracts";

export const sceneLoadingStageSchema = z.enum(["loading", "partial-ready", "ready", "fallback", "unavailable"]);

export type SceneLoadingStage = z.infer<typeof sceneLoadingStageSchema>;

const sceneLoadingDiagnosticsBaseSchema = z.object({
  sourceKind: assetManifestSourceKindSchema.nullable().default(null),
  fallbackReason: assetManifestFallbackReasonSchema.nullable().default(null),
  manifestVersion: z.string().min(1).nullable().default(null),
  totalAssetCount: z.number().int().nonnegative(),
  readyAssetCount: z.number().int().nonnegative(),
  unavailableAssetCount: z.number().int().nonnegative(),
  missingRoles: z.array(z.string().min(1)).readonly(),
  unavailableRoles: z.array(z.string().min(1)).readonly(),
  cacheKeys: z.array(z.string().min(1)).readonly(),
});

const worldHubSceneAssetSlotsSchema = z.object({
  hubScene: worldHubResolvedAssetDescriptorSchema.nullable().default(null),
  hubPreviewImage: worldHubResolvedAssetDescriptorSchema.nullable().default(null),
  portalPreviewImage: worldHubResolvedAssetDescriptorSchema.nullable().default(null),
  kioskSurface: worldHubResolvedAssetDescriptorSchema.nullable().default(null),
  ambientAudio: worldHubResolvedAssetDescriptorSchema.nullable().default(null),
});

const missionRoomSceneAssetSlotsSchema = z.object({
  missionScene: missionRoomResolvedAssetDescriptorSchema.nullable().default(null),
  missionPreviewImage: missionRoomResolvedAssetDescriptorSchema.nullable().default(null),
  missionBriefing: missionRoomResolvedAssetDescriptorSchema.nullable().default(null),
  ambientAudio: missionRoomResolvedAssetDescriptorSchema.nullable().default(null),
});

export const worldHubSceneLoadingSchema = z.object({
  scope: z.literal("world-hub"),
  runtimeId: z.string().min(1),
  stage: sceneLoadingStageSchema,
  summaryLabel: z.string().min(1),
  detail: z.string().min(1),
  assets: worldHubSceneAssetSlotsSchema,
  diagnostics: sceneLoadingDiagnosticsBaseSchema.extend({
    missingRoles: z.array(worldHubAssetRoleSchema).readonly(),
    unavailableRoles: z.array(worldHubAssetRoleSchema).readonly(),
  }),
  resolvedAtIso: z.string().datetime(),
});

export type WorldHubResolvedSceneLoading = z.infer<typeof worldHubSceneLoadingSchema>;

export const missionRoomSceneLoadingSchema = z.object({
  scope: z.literal("mission-room"),
  runtimeId: z.string().min(1),
  stage: sceneLoadingStageSchema,
  summaryLabel: z.string().min(1),
  detail: z.string().min(1),
  assets: missionRoomSceneAssetSlotsSchema,
  diagnostics: sceneLoadingDiagnosticsBaseSchema.extend({
    missingRoles: z.array(missionRoomAssetRoleSchema).readonly(),
    unavailableRoles: z.array(missionRoomAssetRoleSchema).readonly(),
  }),
  resolvedAtIso: z.string().datetime(),
});

export type MissionRoomResolvedSceneLoading = z.infer<typeof missionRoomSceneLoadingSchema>;

const WORLD_HUB_CORE_ROLES: readonly WorldHubAssetRole[] = ["hub-preview-image", "portal-preview-image", "kiosk-surface"];
const WORLD_HUB_STREAMING_ROLES: readonly WorldHubAssetRole[] = ["hub-scene"];
const MISSION_CORE_ROLES: readonly MissionRoomAssetRole[] = ["mission-preview-image", "mission-briefing"];
const MISSION_STREAMING_ROLES: readonly MissionRoomAssetRole[] = ["mission-scene"];

function findWorldHubAsset(
  descriptors: readonly WorldHubResolvedAssetDescriptor[],
  role: WorldHubAssetRole,
): WorldHubResolvedAssetDescriptor | null {
  return descriptors.find((descriptor) => descriptor.role === role) ?? null;
}

function findMissionAsset(
  descriptors: readonly MissionRoomResolvedAssetDescriptor[],
  role: MissionRoomAssetRole,
): MissionRoomResolvedAssetDescriptor | null {
  return descriptors.find((descriptor) => descriptor.role === role) ?? null;
}

function isReadyDescriptor<T extends { availability: "ready" | "unavailable" }>(descriptor: T | null) {
  return descriptor?.availability === "ready";
}

function buildDetail(args: {
  stage: SceneLoadingStage;
  sourceLabel: string;
  fallbackReason: string | null;
  missingRoles: readonly string[];
  unavailableRoles: readonly string[];
  streamingMissing: readonly string[];
  runtimeLabel: string;
}) {
  switch (args.stage) {
    case "loading":
      return `Resolving ${args.runtimeLabel} assets through the manifest seam.`;
    case "ready":
      return `${args.runtimeLabel} assets resolved from ${args.sourceLabel} and the staged scene bundle is ready.`;
    case "fallback":
      return `${args.runtimeLabel} assets are running from deterministic local fallback${args.fallbackReason ? ` (${args.fallbackReason})` : ""}.`;
    case "unavailable":
      return `${args.runtimeLabel} assets are unavailable because no ready references were resolved from ${args.sourceLabel}.`;
    case "partial-ready":
    default: {
      const blockers = [
        args.streamingMissing.length > 0 ? `streaming assets pending: ${args.streamingMissing.join(", ")}` : null,
        args.missingRoles.length > 0 ? `missing roles: ${args.missingRoles.join(", ")}` : null,
        args.unavailableRoles.length > 0 ? `unavailable roles: ${args.unavailableRoles.join(", ")}` : null,
      ].filter(Boolean);

      return blockers.length > 0
        ? `${args.runtimeLabel} assets resolved from ${args.sourceLabel} with staged fallthrough (${blockers.join(" · ")}).`
        : `${args.runtimeLabel} assets resolved from ${args.sourceLabel} but are still waiting on staged scene readiness.`;
    }
  }
}

function summarizeStage(stage: SceneLoadingStage) {
  switch (stage) {
    case "loading":
      return "Streaming assets…";
    case "ready":
      return "Scene assets ready";
    case "fallback":
      return "Local fallback assets";
    case "unavailable":
      return "Scene assets unavailable";
    case "partial-ready":
    default:
      return "Partial scene readiness";
  }
}

export function createLoadingWorldHubSceneLoading(args: { worldId: string }): WorldHubResolvedSceneLoading {
  return parseWorldHubResolvedSceneLoading({
    scope: "world-hub",
    runtimeId: args.worldId,
    stage: "loading",
    summaryLabel: summarizeStage("loading"),
    detail: buildDetail({
      stage: "loading",
      sourceLabel: "manifest seam",
      fallbackReason: null,
      missingRoles: [],
      unavailableRoles: [],
      streamingMissing: [],
      runtimeLabel: "World hub",
    }),
    assets: {
      hubScene: null,
      hubPreviewImage: null,
      portalPreviewImage: null,
      kioskSurface: null,
      ambientAudio: null,
    },
    diagnostics: {
      sourceKind: null,
      fallbackReason: null,
      manifestVersion: null,
      totalAssetCount: 0,
      readyAssetCount: 0,
      unavailableAssetCount: 0,
      missingRoles: [...WORLD_HUB_CORE_ROLES, ...WORLD_HUB_STREAMING_ROLES],
      unavailableRoles: [],
      cacheKeys: [],
    },
    resolvedAtIso: new Date().toISOString(),
  });
}

export function createLoadingMissionRoomSceneLoading(args: { missionId: string }): MissionRoomResolvedSceneLoading {
  return parseMissionRoomResolvedSceneLoading({
    scope: "mission-room",
    runtimeId: args.missionId,
    stage: "loading",
    summaryLabel: summarizeStage("loading"),
    detail: buildDetail({
      stage: "loading",
      sourceLabel: "manifest seam",
      fallbackReason: null,
      missingRoles: [],
      unavailableRoles: [],
      streamingMissing: [],
      runtimeLabel: "Mission scene",
    }),
    assets: {
      missionScene: null,
      missionPreviewImage: null,
      missionBriefing: null,
      ambientAudio: null,
    },
    diagnostics: {
      sourceKind: null,
      fallbackReason: null,
      manifestVersion: null,
      totalAssetCount: 0,
      readyAssetCount: 0,
      unavailableAssetCount: 0,
      missingRoles: [...MISSION_CORE_ROLES, ...MISSION_STREAMING_ROLES],
      unavailableRoles: [],
      cacheKeys: [],
    },
    resolvedAtIso: new Date().toISOString(),
  });
}

export function resolveWorldHubSceneLoading(input: WorldHubResolvedAssetSet): WorldHubResolvedSceneLoading {
  const assets = parseWorldHubResolvedAssetSet(input);
  const slots = {
    hubScene: findWorldHubAsset(assets.descriptors, "hub-scene"),
    hubPreviewImage: findWorldHubAsset(assets.descriptors, "hub-preview-image"),
    portalPreviewImage: findWorldHubAsset(assets.descriptors, "portal-preview-image"),
    kioskSurface: findWorldHubAsset(assets.descriptors, "kiosk-surface"),
    ambientAudio: findWorldHubAsset(assets.descriptors, "ambient-audio"),
  };

  const roleEntries: Array<[WorldHubAssetRole, WorldHubResolvedAssetDescriptor | null]> = [
    ["hub-scene", slots.hubScene],
    ["hub-preview-image", slots.hubPreviewImage],
    ["portal-preview-image", slots.portalPreviewImage],
    ["kiosk-surface", slots.kioskSurface],
    ["ambient-audio", slots.ambientAudio],
  ];

  const missingRoles = roleEntries.filter(([, descriptor]) => descriptor === null).map(([role]) => role);
  const unavailableRoles = roleEntries
    .filter(([, descriptor]) => descriptor?.availability === "unavailable")
    .map(([role]) => role);
  const readyAssetCount = assets.descriptors.filter((descriptor) => descriptor.availability === "ready").length;
  const unavailableAssetCount = assets.descriptors.length - readyAssetCount;
  const coreReadyCount = WORLD_HUB_CORE_ROLES.filter((role) => isReadyDescriptor(findWorldHubAsset(assets.descriptors, role))).length;
  const streamingMissing = WORLD_HUB_STREAMING_ROLES.filter((role) => !isReadyDescriptor(findWorldHubAsset(assets.descriptors, role)));

  let stage: SceneLoadingStage;
  if (assets.source.kind === "local-manifest") {
    stage = "fallback";
  } else if (readyAssetCount === 0 || coreReadyCount === 0) {
    stage = "unavailable";
  } else if (
    coreReadyCount < WORLD_HUB_CORE_ROLES.length ||
    streamingMissing.length > 0 ||
    unavailableRoles.length > 0 ||
    assets.source.fallbackReason !== null
  ) {
    stage = "partial-ready";
  } else {
    stage = "ready";
  }

  return parseWorldHubResolvedSceneLoading({
    scope: "world-hub",
    runtimeId: assets.runtimeId,
    stage,
    summaryLabel: summarizeStage(stage),
    detail: buildDetail({
      stage,
      sourceLabel: assets.source.label,
      fallbackReason: assets.source.fallbackReason,
      missingRoles,
      unavailableRoles,
      streamingMissing,
      runtimeLabel: "World hub",
    }),
    assets: slots,
    diagnostics: {
      sourceKind: assets.source.kind,
      fallbackReason: assets.source.fallbackReason,
      manifestVersion: assets.manifestVersion,
      totalAssetCount: assets.descriptors.length,
      readyAssetCount,
      unavailableAssetCount,
      missingRoles,
      unavailableRoles,
      cacheKeys: assets.descriptors.flatMap((descriptor) => (descriptor.cacheKey ? [descriptor.cacheKey] : [])),
    },
    resolvedAtIso: assets.loadedAtIso,
  });
}

export function resolveMissionRoomSceneLoading(input: MissionRoomResolvedAssetSet): MissionRoomResolvedSceneLoading {
  const assets = parseMissionRoomResolvedAssetSet(input);
  const slots = {
    missionScene: findMissionAsset(assets.descriptors, "mission-scene"),
    missionPreviewImage: findMissionAsset(assets.descriptors, "mission-preview-image"),
    missionBriefing: findMissionAsset(assets.descriptors, "mission-briefing"),
    ambientAudio: findMissionAsset(assets.descriptors, "ambient-audio"),
  };

  const roleEntries: Array<[MissionRoomAssetRole, MissionRoomResolvedAssetDescriptor | null]> = [
    ["mission-scene", slots.missionScene],
    ["mission-preview-image", slots.missionPreviewImage],
    ["mission-briefing", slots.missionBriefing],
    ["ambient-audio", slots.ambientAudio],
  ];

  const missingRoles = roleEntries.filter(([, descriptor]) => descriptor === null).map(([role]) => role);
  const unavailableRoles = roleEntries
    .filter(([, descriptor]) => descriptor?.availability === "unavailable")
    .map(([role]) => role);
  const readyAssetCount = assets.descriptors.filter((descriptor) => descriptor.availability === "ready").length;
  const unavailableAssetCount = assets.descriptors.length - readyAssetCount;
  const coreReadyCount = MISSION_CORE_ROLES.filter((role) => isReadyDescriptor(findMissionAsset(assets.descriptors, role))).length;
  const streamingMissing = MISSION_STREAMING_ROLES.filter((role) => !isReadyDescriptor(findMissionAsset(assets.descriptors, role)));

  let stage: SceneLoadingStage;
  if (assets.source.kind === "local-manifest") {
    stage = "fallback";
  } else if (readyAssetCount === 0 || coreReadyCount === 0) {
    stage = "unavailable";
  } else if (
    coreReadyCount < MISSION_CORE_ROLES.length ||
    streamingMissing.length > 0 ||
    unavailableRoles.length > 0 ||
    assets.source.fallbackReason !== null
  ) {
    stage = "partial-ready";
  } else {
    stage = "ready";
  }

  return parseMissionRoomResolvedSceneLoading({
    scope: "mission-room",
    runtimeId: assets.runtimeId,
    stage,
    summaryLabel: summarizeStage(stage),
    detail: buildDetail({
      stage,
      sourceLabel: assets.source.label,
      fallbackReason: assets.source.fallbackReason,
      missingRoles,
      unavailableRoles,
      streamingMissing,
      runtimeLabel: "Mission scene",
    }),
    assets: slots,
    diagnostics: {
      sourceKind: assets.source.kind,
      fallbackReason: assets.source.fallbackReason,
      manifestVersion: assets.manifestVersion,
      totalAssetCount: assets.descriptors.length,
      readyAssetCount,
      unavailableAssetCount,
      missingRoles,
      unavailableRoles,
      cacheKeys: assets.descriptors.flatMap((descriptor) => (descriptor.cacheKey ? [descriptor.cacheKey] : [])),
    },
    resolvedAtIso: assets.loadedAtIso,
  });
}

export function parseWorldHubResolvedSceneLoading(input: unknown): WorldHubResolvedSceneLoading {
  return worldHubSceneLoadingSchema.parse(input);
}

export function parseMissionRoomResolvedSceneLoading(input: unknown): MissionRoomResolvedSceneLoading {
  return missionRoomSceneLoadingSchema.parse(input);
}
