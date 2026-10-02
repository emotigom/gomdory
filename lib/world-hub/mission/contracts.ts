import { z } from "zod";

import type { MissionRoomResolvedAssetSet } from "@/lib/world-hub/assets/contracts";
import type { MissionRoomResolvedSceneLoading } from "@/lib/world-hub/assets/sceneLoading";
import {
  sessionRuntimeMetadataSchema,
  sessionWorkerExtensionsSchema,
} from "@/lib/world-hub/bootstrap/sessionMetadata";
import { configFallbackReasonSchema } from "@/lib/world-hub/config/sourceContracts";
import { missionRoomBootstrapSourceSchema } from "@/lib/world-hub/bootstrap/sourceContracts";
import {
  authoritativeSessionProjectionSchema,
  presenceSubscriptionSnapshotSchema,
} from "@/lib/world-hub/runtime/sessionProjection";

import {
  type WorldHubMissionHandoffPayload,
  worldHubMissionHandoffPayloadSchema,
  worldHubPortalAvailabilitySchema,
} from "@/lib/world-hub/contracts";
import { missionRoomResolvedAccessPolicySchema } from "@/lib/world-hub/policy/contracts";
import { missionGameplayStateSchema } from "@/lib/world-hub/mission/gameplay/contracts";
import { missionCompletionResolvedStateSchema } from "@/lib/world-hub/mission/completion/contracts";
import { authoritativePresenceSnapshotSchema } from "@/lib/world-hub/presence/contracts";
import { metaverseLiveSessionGuidanceSchema } from "@/lib/world-hub/classroom/liveSession/projection";

export const missionRoomRouteSeedSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("validated-handoff"),
    missionId: z.string().min(1),
    returnHubPath: z.string().min(1),
    handoff: worldHubMissionHandoffPayloadSchema,
  }),
  z.object({
    mode: z.literal("local-fallback"),
    missionId: z.string().min(1),
    returnHubPath: z.string().min(1),
    fallbackReason: z.enum(["missing-handoff", "invalid-handoff", "mission-mismatch", "unknown-mission"]),
    portal: z
      .object({
        id: z.string().min(1),
        label: z.string().min(1),
        summary: z.string().min(1),
        statusLabel: z.string().min(1),
        availability: worldHubPortalAvailabilitySchema,
        accent: z.string().min(1),
        missionRoute: z.string().min(1),
      })
      .nullable(),
  }),
]);

export type MissionRoomRouteSeed = z.infer<typeof missionRoomRouteSeedSchema>;

export const missionRoomBootstrapModeSchema = z.enum(["local-single-user", "edge-room"]);

export type MissionRoomBootstrapMode = z.infer<typeof missionRoomBootstrapModeSchema>;

export const missionRoomSceneConfigSchema = z.object({
  missionId: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  summary: z.string().min(1),
  accent: z.string().min(1),
  missionTypeLabel: z.string().min(1),
  environmentLabel: z.string().min(1),
  objectiveLabel: z.string().min(1),
  statusLabel: z.string().min(1),
  returnLabel: z.string().min(1),
  bootstrap: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("local-single-user"),
      roomId: z.string().min(1),
      roomLabel: z.string().min(1),
      objectiveState: z.enum(["briefing", "ready", "queued"]),
    }),
    z.object({
      mode: z.literal("edge-room"),
      bootstrapKey: z.string().min(1),
      roomHint: z.string().min(1).optional(),
    }),
  ]),
  scene: z.object({
    containerLabel: z.string().min(1),
    containerSummary: z.string().min(1),
    placeholderTitle: z.string().min(1),
    placeholderBody: z.string().min(1),
  }),
  metadata: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).readonly(),
});

export type MissionRoomSceneConfig = z.infer<typeof missionRoomSceneConfigSchema>;

export const missionRoomLoadedSceneConfigSchema = z.object({
  config: missionRoomSceneConfigSchema,
  source: z.object({
    kind: z.enum(["local-derived", "edge-config"]),
    label: z.string().min(1),
    detail: z.string().min(1).nullable().default(null),
    fallbackReason: configFallbackReasonSchema.nullable().default(null),
  }),
  loadedAtIso: z.string().datetime(),
});

export const missionRoomEdgeSceneTemplateSchema = missionRoomSceneConfigSchema
  .pick({
    missionId: true,
    subtitle: true,
    missionTypeLabel: true,
    environmentLabel: true,
    objectiveLabel: true,
    returnLabel: true,
    bootstrap: true,
    scene: true,
  })
  .extend({
    metadata: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).readonly().optional(),
  });

export type MissionRoomEdgeSceneTemplate = z.infer<typeof missionRoomEdgeSceneTemplateSchema>;

export type MissionRoomLoadedSceneConfig = z.infer<typeof missionRoomLoadedSceneConfigSchema>;

export type MissionRoomSceneConfigLoader = {
  loadInitialSceneConfig(routeSeed: MissionRoomRouteSeed): Promise<MissionRoomLoadedSceneConfig>;
};

export const missionRoomBootstrapSchema = z.object({
  mode: missionRoomBootstrapModeSchema,
  authority: z.enum(["local-preview", "edge-worker"]),
  roomId: z.string().min(1),
  roomLabel: z.string().min(1),
  seatLabel: z.string().min(1),
  connectionLabel: z.string().min(1),
  objectiveState: z.enum(["briefing", "ready", "queued"]),
  partySize: z.number().int().positive(),
  metadata: sessionRuntimeMetadataSchema,
  presenceSnapshot: authoritativePresenceSnapshotSchema.nullable().default(null),
});

export type MissionRoomBootstrap = z.infer<typeof missionRoomBootstrapSchema>;

export const missionRoomWorkerBootstrapPayloadSchema = z.object({
  roomId: z.string().min(1),
  roomLabel: z.string().min(1),
  seatLabel: z.string().min(1),
  connectionLabel: z.string().min(1),
  objectiveState: z.enum(["briefing", "ready", "queued"]),
  partySize: z.number().int().positive(),
  extensions: sessionWorkerExtensionsSchema.optional(),
});

export type MissionRoomWorkerBootstrapPayload = z.infer<typeof missionRoomWorkerBootstrapPayloadSchema>;

export const missionRoomResolvedBootstrapSchema = z.object({
  requestedMode: missionRoomBootstrapModeSchema,
  bootstrap: missionRoomBootstrapSchema,
  source: missionRoomBootstrapSourceSchema,
});

export type MissionRoomResolvedBootstrap = z.infer<typeof missionRoomResolvedBootstrapSchema>;

export type MissionRoomBootstrapPort = {
  bootstrap(args: {
    routeSeed: MissionRoomRouteSeed;
    loadedSceneConfig: MissionRoomLoadedSceneConfig;
  }): Promise<MissionRoomResolvedBootstrap>;
};

export const missionRoomWorkerBootstrapRequestSchema = z.object({
  missionId: z.string().min(1),
  routeMode: z.enum(["validated-handoff", "local-fallback"]),
  requestedMode: missionRoomBootstrapModeSchema,
  worldId: z.string().min(1).nullable(),
  sessionId: z.string().min(1).nullable(),
  bootstrap: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("local-single-user"),
      roomId: z.string().min(1),
      roomLabel: z.string().min(1),
      objectiveState: z.enum(["briefing", "ready", "queued"]),
    }),
    z.object({
      mode: z.literal("edge-room"),
      bootstrapKey: z.string().min(1),
      roomHint: z.string().min(1).optional(),
    }),
  ]),
});

export type MissionRoomWorkerBootstrapRequest = z.infer<typeof missionRoomWorkerBootstrapRequestSchema>;

export type MissionRoomRuntimeInputs = {
  route: {
    missionId: string;
    mode: MissionRoomRouteSeed["mode"];
    returnHubPath: string;
    fallbackReason: string | null;
  };
  handoff: {
    missionId: string;
    worldId: string | null;
    sessionId: string | null;
    launchMode: WorldHubMissionHandoffPayload["launchMode"] | "local-fallback";
    bootstrapMode: WorldHubMissionHandoffPayload["bootstrapMode"] | "local-fallback";
    issuedAtIso: string | null;
    portalLabel: string;
    portalStatusLabel: string;
    portalAvailability: string;
  };
  scene: Omit<MissionRoomSceneConfig, "bootstrap">;
  assets: MissionRoomResolvedAssetSet;
  sceneLoading: MissionRoomResolvedSceneLoading;
  policy: z.infer<typeof missionRoomResolvedAccessPolicySchema>;
  bootstrapSource: z.infer<typeof missionRoomBootstrapSourceSchema>;
  bootstrap: Omit<MissionRoomResolvedBootstrap["bootstrap"], "metadata" | "presenceSnapshot"> & { requestedMode: MissionRoomBootstrapMode };
  session: z.infer<typeof authoritativeSessionProjectionSchema>;
  presence: z.infer<typeof presenceSubscriptionSnapshotSchema>;
  gameplay: z.infer<typeof missionGameplayStateSchema>;
  completion: z.infer<typeof missionCompletionResolvedStateSchema>;
  liveSession: z.infer<typeof metaverseLiveSessionGuidanceSchema>;
  source: MissionRoomLoadedSceneConfig["source"];
};

export function parseMissionRoomRouteSeed(input: unknown): MissionRoomRouteSeed {
  return missionRoomRouteSeedSchema.parse(input);
}

export function parseMissionRoomSceneConfig(input: unknown): MissionRoomSceneConfig {
  return missionRoomSceneConfigSchema.parse(input);
}

export function parseMissionRoomLoadedSceneConfig(input: unknown): MissionRoomLoadedSceneConfig {
  return missionRoomLoadedSceneConfigSchema.parse(input);
}

export function parseMissionRoomEdgeSceneTemplate(input: unknown): MissionRoomEdgeSceneTemplate {
  return missionRoomEdgeSceneTemplateSchema.parse(input);
}

export function parseMissionRoomBootstrap(input: unknown): MissionRoomBootstrap {
  return missionRoomBootstrapSchema.parse(input);
}

export function parseMissionRoomWorkerBootstrapPayload(input: unknown): MissionRoomWorkerBootstrapPayload {
  return missionRoomWorkerBootstrapPayloadSchema.parse(input);
}

export function parseMissionRoomResolvedBootstrap(input: unknown): MissionRoomResolvedBootstrap {
  return missionRoomResolvedBootstrapSchema.parse(input);
}

export function parseMissionRoomWorkerBootstrapRequest(input: unknown): MissionRoomWorkerBootstrapRequest {
  return missionRoomWorkerBootstrapRequestSchema.parse(input);
}
