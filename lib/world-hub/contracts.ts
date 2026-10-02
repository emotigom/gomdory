import { z } from "zod";

import type { WorldHubResolvedAssetSet } from "@/lib/world-hub/assets/contracts";
import type { WorldHubResolvedSceneLoading } from "@/lib/world-hub/assets/sceneLoading";
import {
  sessionRuntimeMetadataSchema,
  sessionWorkerExtensionsSchema,
} from "@/lib/world-hub/bootstrap/sessionMetadata";
import { configFallbackReasonSchema } from "@/lib/world-hub/config/sourceContracts";
import { worldHubBootstrapSourceSchema } from "@/lib/world-hub/bootstrap/sourceContracts";
import {
  authoritativeSessionProjectionSchema,
  presenceSubscriptionSnapshotSchema,
} from "@/lib/world-hub/runtime/sessionProjection";
import { worldHubResolvedAccessPolicySchema } from "@/lib/world-hub/policy/contracts";
import { metaverseResolvedProgressSnapshotSchema } from "@/lib/world-hub/progress/contracts";
import { metaverseResolvedLaunchControlStateSchema } from "@/lib/world-hub/launch/contracts";
import { authoritativePresenceSnapshotSchema } from "@/lib/world-hub/presence/contracts";
import { metaverseLiveSessionGuidanceSchema } from "@/lib/world-hub/classroom/liveSession/projection";
import { worldHubResolvedSeasonalDecorationStateSchema } from "@/lib/world-hub/seasonal/contracts";

export const worldHubPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type WorldHubPoint = z.infer<typeof worldHubPointSchema>;

export const worldHubPortalAvailabilitySchema = z.enum(["available", "queued", "locked"]);

export type WorldHubPortalAvailability = z.infer<typeof worldHubPortalAvailabilitySchema>;

export const worldHubPortalEntryCueSchema = z.enum(["open", "suggested", "unavailable"]);

export type WorldHubPortalEntryCue = z.infer<typeof worldHubPortalEntryCueSchema>;

export const worldHubPortalManifestSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  summary: z.string().min(1),
  statusLabel: z.string().min(1),
  availability: worldHubPortalAvailabilitySchema,
  entryCue: worldHubPortalEntryCueSchema.default("open"),
  accent: z.string().min(1),
  position: worldHubPointSchema,
  missionRoute: z.string().min(1),
});

export type WorldHubPortalManifest = z.infer<typeof worldHubPortalManifestSchema>;

export const worldHubPresenceMoodSchema = z.enum(["wave", "queued", "ready"]);

export type WorldHubPresenceMood = z.infer<typeof worldHubPresenceMoodSchema>;

export const worldHubPresenceStubSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  position: worldHubPointSchema,
  mood: worldHubPresenceMoodSchema,
});

export type WorldHubPresenceStub = z.infer<typeof worldHubPresenceStubSchema>;

export const worldHubBootstrapModeSchema = z.enum(["local-single-user", "edge-session"]);

export type WorldHubBootstrapMode = z.infer<typeof worldHubBootstrapModeSchema>;

export const worldHubSpawnConfigSchema = z.object({
  position: worldHubPointSchema,
  heading: z.number(),
  speed: z.number().nonnegative(),
});

export type WorldHubSpawnConfig = z.infer<typeof worldHubSpawnConfigSchema>;

export const worldHubKioskSurfaceSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  hintLabel: z.string().min(1),
  position: worldHubPointSchema,
});

export type WorldHubKioskSurface = z.infer<typeof worldHubKioskSurfaceSchema>;

export const worldHubHudLabelsSchema = z.object({
  runtimeBadge: z.string().min(1),
  movementLabel: z.string().min(1),
  interactLabel: z.string().min(1),
  cameraLabel: z.string().min(1),
  panelTitle: z.string().min(1),
  presenceTitle: z.string().min(1),
  extensionTitle: z.string().min(1),
});

export type WorldHubHudLabels = z.infer<typeof worldHubHudLabelsSchema>;

export const worldHubDecorationAnchorZoneSchema = z.enum([
  "central-plaza",
  "home-lane",
  "portal-ridge",
  "academy-lodge-approach",
]);

export type WorldHubDecorationAnchorZone = z.infer<typeof worldHubDecorationAnchorZoneSchema>;

export const worldHubDecorationAnchorCategorySchema = z.enum([
  "banner-overhead",
  "ground-accent",
  "prop-plinth",
  "light-string",
  "wayfinding-marker",
]);

export type WorldHubDecorationAnchorCategory = z.infer<typeof worldHubDecorationAnchorCategorySchema>;

export const worldHubDecorationAnchorPrioritySchema = z.enum(["primary", "secondary"]).default("secondary");

export type WorldHubDecorationAnchorPriority = z.infer<typeof worldHubDecorationAnchorPrioritySchema>;

export const worldHubDecorationAnchorManifestSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  zone: worldHubDecorationAnchorZoneSchema,
  category: worldHubDecorationAnchorCategorySchema,
  position: worldHubPointSchema,
  rotationDeg: z.number().default(0),
  footprintRadius: z.number().positive().max(16).default(3.5),
  priority: worldHubDecorationAnchorPrioritySchema,
});

export type WorldHubDecorationAnchorManifest = z.infer<typeof worldHubDecorationAnchorManifestSchema>;

export const worldHubHomeLanePlaceholderKindSchema = z.enum([
  "achievement-display",
  "badge-display",
  "message-hook",
  "reward-marker",
  "trophy-plinth",
  "recent-achievement",
  "collectible-expansion",
  "visitor-signal",
  "collectible-signal",
]);

export type WorldHubHomeLanePlaceholderKind = z.infer<typeof worldHubHomeLanePlaceholderKindSchema>;

export const worldHubHomeLanePlaceholderManifestSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: worldHubHomeLanePlaceholderKindSchema,
  position: worldHubPointSchema,
});

export type WorldHubHomeLanePlaceholderManifest = z.infer<typeof worldHubHomeLanePlaceholderManifestSchema>;

export const worldHubHomeLaneConfigSchema = z.object({
  title: z.string().min(1).default("Home lane keepsakes"),
  summary: z
    .string()
    .min(1)
    .default("Small markers around home keep your achievements, notes, and future signals emotionally readable."),
  placeholders: z.array(worldHubHomeLanePlaceholderManifestSchema).readonly().default([]),
});

export type WorldHubHomeLaneConfig = z.infer<typeof worldHubHomeLaneConfigSchema>;

export const worldHubSceneManifestSchema = z.object({
  worldId: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  bounds: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  spawn: worldHubSpawnConfigSchema,
  kiosk: worldHubKioskSurfaceSchema,
  hud: worldHubHudLabelsSchema,
  portals: z.array(worldHubPortalManifestSchema).readonly(),
  decorationAnchors: z.array(worldHubDecorationAnchorManifestSchema).readonly().default([]),
  homeLane: worldHubHomeLaneConfigSchema.default({}),
  bootstrap: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("local-single-user"),
      sessionId: z.string().min(1),
      shardLabel: z.string().min(1),
      occupancy: z.number().int().nonnegative(),
      reactionsEnabled: z.boolean(),
      nearbyPeers: z.array(worldHubPresenceStubSchema).readonly(),
    }),
    z.object({
      mode: z.literal("edge-session"),
      bootstrapKey: z.string().min(1),
      shardHint: z.string().min(1).optional(),
    }),
  ]),
});

export type WorldHubSceneManifest = z.infer<typeof worldHubSceneManifestSchema>;
export type WorldHubBootstrapConfig = WorldHubSceneManifest["bootstrap"];

export const worldHubManifestSourceKindSchema = z.enum(["local-default", "edge-config"]);

export type WorldHubManifestSourceKind = z.infer<typeof worldHubManifestSourceKindSchema>;

export const worldHubLoadedManifestSchema = z.object({
  manifest: worldHubSceneManifestSchema,
  source: z.object({
    kind: worldHubManifestSourceKindSchema,
    label: z.string().min(1),
    detail: z.string().min(1).nullable().default(null),
    fallbackReason: configFallbackReasonSchema.nullable().default(null),
  }),
  loadedAtIso: z.string().datetime(),
});

export type WorldHubLoadedManifest = z.infer<typeof worldHubLoadedManifestSchema>;

export type WorldHubManifestLoader = {
  loadInitialManifest(): Promise<WorldHubLoadedManifest>;
};

export const worldHubSessionBootstrapSchema = z.object({
  mode: worldHubBootstrapModeSchema,
  authority: z.enum(["local-preview", "edge-worker"]),
  sessionId: z.string().min(1),
  shardLabel: z.string().min(1),
  occupancy: z.number().int().nonnegative(),
  reactionsEnabled: z.boolean(),
  nearbyPeers: z.array(worldHubPresenceStubSchema).readonly(),
  metadata: sessionRuntimeMetadataSchema,
  presenceSnapshot: authoritativePresenceSnapshotSchema.nullable().default(null),
});

export type WorldHubSessionBootstrap = z.infer<typeof worldHubSessionBootstrapSchema>;

export const worldHubWorkerSessionBootstrapPayloadSchema = z.object({
  sessionId: z.string().min(1),
  shardLabel: z.string().min(1),
  occupancy: z.number().int().nonnegative(),
  reactionsEnabled: z.boolean(),
  nearbyPeers: z.array(worldHubPresenceStubSchema).readonly(),
  extensions: sessionWorkerExtensionsSchema.optional(),
});

export type WorldHubWorkerSessionBootstrapPayload = z.infer<typeof worldHubWorkerSessionBootstrapPayloadSchema>;

export const worldHubResolvedSessionBootstrapSchema = z.object({
  requestedMode: worldHubBootstrapModeSchema,
  bootstrap: worldHubSessionBootstrapSchema,
  source: worldHubBootstrapSourceSchema,
});

export type WorldHubResolvedSessionBootstrap = z.infer<typeof worldHubResolvedSessionBootstrapSchema>;

export type WorldHubSessionBootstrapPort = {
  bootstrap(manifest: WorldHubSceneManifest): Promise<WorldHubResolvedSessionBootstrap>;
};

export const worldHubWorkerBootstrapRequestSchema = z.object({
  worldId: z.string().min(1),
  requestedMode: worldHubBootstrapModeSchema,
  bootstrap: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("local-single-user"),
      sessionId: z.string().min(1),
      shardLabel: z.string().min(1),
      occupancy: z.number().int().nonnegative(),
      reactionsEnabled: z.boolean(),
      nearbyPeers: z.array(worldHubPresenceStubSchema).readonly(),
    }),
    z.object({
      mode: z.literal("edge-session"),
      bootstrapKey: z.string().min(1),
      shardHint: z.string().min(1).optional(),
    }),
  ]),
});

export type WorldHubWorkerBootstrapRequest = z.infer<typeof worldHubWorkerBootstrapRequestSchema>;

export const worldHubMissionLaunchModeSchema = z.enum(["placeholder-route", "edge-bootstrap"]);

export type WorldHubMissionLaunchMode = z.infer<typeof worldHubMissionLaunchModeSchema>;

export const worldHubMissionBootstrapModeSchema = z.enum(["local-preview", "edge-bootstrap"]);

export type WorldHubMissionBootstrapMode = z.infer<typeof worldHubMissionBootstrapModeSchema>;

export const worldHubMissionPortalSnapshotSchema = worldHubPortalManifestSchema.pick({
  id: true,
  label: true,
  summary: true,
  statusLabel: true,
  availability: true,
  accent: true,
  missionRoute: true,
});

export type WorldHubMissionPortalSnapshot = z.infer<typeof worldHubMissionPortalSnapshotSchema>;

export const worldHubMissionHandoffPayloadSchema = z.object({
  version: z.literal(1),
  worldId: z.string().min(1),
  sessionId: z.string().min(1),
  missionId: z.string().min(1),
  launchMode: worldHubMissionLaunchModeSchema,
  bootstrapMode: worldHubMissionBootstrapModeSchema,
  issuedAtIso: z.string().datetime(),
  portal: worldHubMissionPortalSnapshotSchema,
});

export type WorldHubMissionHandoffPayload = z.infer<typeof worldHubMissionHandoffPayloadSchema>;

export type WorldHubPortalHandoffRequest = {
  worldId: string;
  portal: WorldHubPortalManifest;
  session: Pick<WorldHubSessionBootstrap, "sessionId" | "authority" | "shardLabel">;
};

export type WorldHubPortalHandoffResult = {
  missionRoute: string;
  launchMode: WorldHubMissionLaunchMode;
  handoff: WorldHubMissionHandoffPayload;
};

export type WorldHubPortalHandoffPort = {
  handoff(request: WorldHubPortalHandoffRequest): Promise<WorldHubPortalHandoffResult>;
};

export type WorldHubPlayerState = {
  position: WorldHubPoint;
  heading: number;
  speed: number;
  activePortalId: string | null;
};

export type WorldHubCameraState = {
  orbitDeg: number;
  distance: number;
  followLag: number;
};

export type WorldHubRuntimeInputs = {
  scene: Pick<WorldHubSceneManifest, "worldId" | "title" | "subtitle" | "bounds">;
  manifestSource: WorldHubLoadedManifest["source"];
  bootstrapSource: z.infer<typeof worldHubBootstrapSourceSchema>;
  assets: WorldHubResolvedAssetSet;
  sceneLoading: WorldHubResolvedSceneLoading;
  policy: z.infer<typeof worldHubResolvedAccessPolicySchema>;
  hud: WorldHubHudLabels;
  spawn: WorldHubSpawnConfig;
  kiosk: WorldHubKioskSurface;
  portals: readonly WorldHubPortalManifest[];
  decorationAnchors: readonly WorldHubDecorationAnchorManifest[];
  homeLane: WorldHubHomeLaneConfig;
  session: {
    requestedMode: WorldHubBootstrapMode;
    mode: WorldHubSessionBootstrap["mode"];
    authority: WorldHubSessionBootstrap["authority"];
    sessionId: string;
    shardLabel: string;
    occupancy: number;
    reactionsEnabled: boolean;
    projection: z.infer<typeof authoritativeSessionProjectionSchema>;
  };
  presence: {
    nearbyPeers: readonly WorldHubPresenceStub[];
    subscription: z.infer<typeof presenceSubscriptionSnapshotSchema>;
  };
  progress: z.infer<typeof metaverseResolvedProgressSnapshotSchema>;
  launchControls: z.infer<typeof metaverseResolvedLaunchControlStateSchema>;
  liveSession: z.infer<typeof metaverseLiveSessionGuidanceSchema>;
  seasonalDecorations: z.infer<typeof worldHubResolvedSeasonalDecorationStateSchema>;
};

export function parseWorldHubSceneManifest(input: unknown): WorldHubSceneManifest {
  return worldHubSceneManifestSchema.parse(input);
}

export function parseWorldHubLoadedManifest(input: unknown): WorldHubLoadedManifest {
  return worldHubLoadedManifestSchema.parse(input);
}

export function parseWorldHubSessionBootstrap(input: unknown): WorldHubSessionBootstrap {
  return worldHubSessionBootstrapSchema.parse(input);
}

export function parseWorldHubWorkerSessionBootstrapPayload(input: unknown): WorldHubWorkerSessionBootstrapPayload {
  return worldHubWorkerSessionBootstrapPayloadSchema.parse(input);
}

export function parseWorldHubResolvedSessionBootstrap(input: unknown): WorldHubResolvedSessionBootstrap {
  return worldHubResolvedSessionBootstrapSchema.parse(input);
}

export function parseWorldHubWorkerBootstrapRequest(input: unknown): WorldHubWorkerBootstrapRequest {
  return worldHubWorkerBootstrapRequestSchema.parse(input);
}

export function parseWorldHubMissionHandoffPayload(input: unknown): WorldHubMissionHandoffPayload {
  return worldHubMissionHandoffPayloadSchema.parse(input);
}
