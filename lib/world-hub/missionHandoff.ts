import { z } from "zod";

import type { WorldHubPortalManifest, WorldHubSessionBootstrap } from "@/lib/world-hub/contracts";

const WORLD_HUB_MISSION_HANDOFF_QUERY_KEY = "handoff";
const WORLD_HUB_MISSION_HANDOFF_VERSION = "1" as const;
const DEFAULT_WORLD_HUB_RETURN_ROUTE = "/world-hub";

export const worldHubMissionHandoffQueryKey = WORLD_HUB_MISSION_HANDOFF_QUERY_KEY;
export const worldHubMissionHandoffVersion = WORLD_HUB_MISSION_HANDOFF_VERSION;
export const defaultWorldHubReturnRoute = DEFAULT_WORLD_HUB_RETURN_ROUTE;

export const worldHubMissionLaunchModeSchema = z.enum(["local-preview", "edge-bootstrap"]);

export type WorldHubMissionLaunchMode = z.infer<typeof worldHubMissionLaunchModeSchema>;

export const worldHubMissionHandoffSchema = z.object({
  version: z.literal(WORLD_HUB_MISSION_HANDOFF_VERSION),
  source: z.literal("world-hub"),
  worldId: z.string().min(1),
  missionId: z.string().min(1),
  portalId: z.string().min(1),
  portalLabel: z.string().min(1),
  sessionId: z.string().min(1),
  returnRoute: z.string().startsWith("/"),
  issuedAtIso: z.string().datetime(),
  launchMode: worldHubMissionLaunchModeSchema,
  bootstrap: z.object({
    authority: z.enum(["local-preview", "edge-worker"]),
    shardLabel: z.string().min(1),
  }),
  room: z
    .object({
      joinKind: z.enum(["direct", "queued", "edge-resolved"]),
      roomKey: z.string().min(1).optional(),
      ticket: z.string().min(1).optional(),
    })
    .optional(),
});

export type WorldHubMissionHandoff = z.infer<typeof worldHubMissionHandoffSchema>;

export type CreateWorldHubMissionHandoffArgs = {
  worldId: string;
  portal: WorldHubPortalManifest;
  session: Pick<WorldHubSessionBootstrap, "sessionId" | "authority" | "shardLabel">;
  launchMode: WorldHubMissionLaunchMode;
  returnRoute?: string;
};

export function createWorldHubMissionHandoff(args: CreateWorldHubMissionHandoffArgs): WorldHubMissionHandoff {
  return worldHubMissionHandoffSchema.parse({
    version: WORLD_HUB_MISSION_HANDOFF_VERSION,
    source: "world-hub",
    worldId: args.worldId,
    missionId: args.portal.id,
    portalId: args.portal.id,
    portalLabel: args.portal.label,
    sessionId: args.session.sessionId,
    returnRoute: args.returnRoute ?? DEFAULT_WORLD_HUB_RETURN_ROUTE,
    issuedAtIso: new Date().toISOString(),
    launchMode: args.launchMode,
    bootstrap: {
      authority: args.session.authority,
      shardLabel: args.session.shardLabel,
    },
    room: {
      joinKind: args.launchMode === "edge-bootstrap" ? "edge-resolved" : "direct",
    },
  });
}

export function encodeWorldHubMissionHandoff(handoff: WorldHubMissionHandoff): string {
  return encodeURIComponent(JSON.stringify(worldHubMissionHandoffSchema.parse(handoff)));
}

export function decodeWorldHubMissionHandoff(value: string): WorldHubMissionHandoff {
  const decoded = decodeURIComponent(value);
  return worldHubMissionHandoffSchema.parse(JSON.parse(decoded));
}

export function readWorldHubMissionHandoff(input: string | null | undefined): WorldHubMissionHandoff | null {
  if (!input) return null;

  try {
    return decodeWorldHubMissionHandoff(input);
  } catch {
    return null;
  }
}

export function createWorldHubMissionHref(args: {
  missionRoute: string;
  handoff: WorldHubMissionHandoff;
}): string {
  const params = new URLSearchParams({
    [WORLD_HUB_MISSION_HANDOFF_QUERY_KEY]: encodeWorldHubMissionHandoff(args.handoff),
  });

  return `${args.missionRoute}?${params.toString()}`;
}
