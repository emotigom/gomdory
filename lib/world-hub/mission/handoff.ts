import {
  parseWorldHubMissionHandoffPayload,
  type WorldHubMissionHandoffPayload,
  type WorldHubPortalManifest,
} from "@/lib/world-hub/contracts";
import { parseMissionRoomRouteSeed, type MissionRoomRouteSeed } from "@/lib/world-hub/mission/contracts";
import { getLocalWorldHubPortalById } from "@/lib/world-hub/manifest/localManifestSnapshot";

export const WORLD_HUB_MISSION_HANDOFF_QUERY_KEY = "handoff";

export function createWorldHubMissionHandoffPayload(args: {
  worldId: string;
  sessionId: string;
  portal: WorldHubPortalManifest;
  launchMode: WorldHubMissionHandoffPayload["launchMode"];
  bootstrapMode: WorldHubMissionHandoffPayload["bootstrapMode"];
}): WorldHubMissionHandoffPayload {
  const { worldId, sessionId, portal, launchMode, bootstrapMode } = args;

  return parseWorldHubMissionHandoffPayload({
    version: 1,
    worldId,
    sessionId,
    missionId: portal.id,
    launchMode,
    bootstrapMode,
    issuedAtIso: new Date().toISOString(),
    portal: {
      id: portal.id,
      label: portal.label,
      summary: portal.summary,
      statusLabel: portal.statusLabel,
      availability: portal.availability,
      accent: portal.accent,
      missionRoute: portal.missionRoute,
    },
  });
}

export function serializeWorldHubMissionHandoff(payload: WorldHubMissionHandoffPayload): string {
  return JSON.stringify(payload);
}

export function createMissionRouteWithHandoff(args: {
  missionRoute: string;
  handoff: WorldHubMissionHandoffPayload;
}): string {
  const params = new URLSearchParams({
    [WORLD_HUB_MISSION_HANDOFF_QUERY_KEY]: serializeWorldHubMissionHandoff(args.handoff),
  });

  return `${args.missionRoute}?${params.toString()}`;
}

export function parseMissionRouteSeedFromSearchParams(args: {
  missionId: string;
  handoffParam: string | string[] | undefined;
}): MissionRoomRouteSeed {
  const localPortal = getLocalWorldHubPortalById(args.missionId);
  const returnHubPath = "/world-hub";
  const handoffText = Array.isArray(args.handoffParam) ? args.handoffParam[0] : args.handoffParam;

  if (!handoffText) {
    return parseMissionRoomRouteSeed({
      mode: "local-fallback",
      missionId: args.missionId,
      returnHubPath,
      fallbackReason: localPortal ? "missing-handoff" : "unknown-mission",
      portal: localPortal,
    });
  }

  try {
    const handoff = parseWorldHubMissionHandoffPayload(JSON.parse(handoffText));
    if (handoff.missionId !== args.missionId || handoff.portal.id !== args.missionId) {
      return parseMissionRoomRouteSeed({
        mode: "local-fallback",
        missionId: args.missionId,
        returnHubPath,
        fallbackReason: "mission-mismatch",
        portal: localPortal,
      });
    }

    return parseMissionRoomRouteSeed({
      mode: "validated-handoff",
      missionId: args.missionId,
      returnHubPath,
      handoff,
    });
  } catch {
    return parseMissionRoomRouteSeed({
      mode: "local-fallback",
      missionId: args.missionId,
      returnHubPath,
      fallbackReason: localPortal ? "invalid-handoff" : "unknown-mission",
      portal: localPortal,
    });
  }
}
