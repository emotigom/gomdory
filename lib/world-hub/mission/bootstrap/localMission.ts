import type {
  MissionRoomLoadedSceneConfig,
  MissionRoomResolvedBootstrap,
  MissionRoomRouteSeed,
  MissionRoomBootstrapPort,
} from "@/lib/world-hub/mission/contracts";
import { parseMissionRoomResolvedBootstrap } from "@/lib/world-hub/mission/contracts";
import type { BootstrapFallbackReason } from "@/lib/world-hub/bootstrap/sourceContracts";
import {
  createBootstrapSourceDiagnostics,
  createLocalSessionRuntimeMetadata,
} from "@/lib/world-hub/bootstrap/sessionMetadata";

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function sanitizeBootstrapToken(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 48) || "local";
}

export function buildDeterministicLocalMissionRoomBootstrap(args: {
  routeSeed: MissionRoomRouteSeed;
  loadedSceneConfig: MissionRoomLoadedSceneConfig;
  label?: string;
  detail?: string | null;
  fallbackReason?: BootstrapFallbackReason | null;
}): MissionRoomResolvedBootstrap {
  const { routeSeed, loadedSceneConfig } = args;
  const { bootstrap, missionId, title } = loadedSceneConfig.config;
  const metadata = createLocalSessionRuntimeMetadata("mission-room");

  if (bootstrap.mode === "local-single-user") {
    return parseMissionRoomResolvedBootstrap({
      requestedMode: bootstrap.mode,
      bootstrap: {
        mode: bootstrap.mode,
        authority: "local-preview",
        roomId: bootstrap.roomId,
        roomLabel: bootstrap.roomLabel,
        seatLabel: routeSeed.mode === "validated-handoff" ? "Solo preview seat" : "Fallback preview seat",
        connectionLabel:
          routeSeed.mode === "validated-handoff" ? `${title} local bootstrap ready` : `${missionId} fallback bootstrap ready`,
        objectiveState: bootstrap.objectiveState,
        partySize: 1,
        metadata,
        presenceSnapshot: null,
      },
      source: {
        kind: "local-derived",
        label: args.label ?? "Deterministic local mission bootstrap",
        detail:
          args.detail ??
          "Mission room booted from the canonical deterministic local preview path derived from the typed route seed.",
        fallbackReason: args.fallbackReason ?? null,
        diagnostics: createBootstrapSourceDiagnostics({
          strategy: "local-default",
          requestedMode: bootstrap.mode,
          resolvedMode: bootstrap.mode,
          metadata,
        }),
      },
    });
  }

  const token = sanitizeBootstrapToken(`${missionId}-${bootstrap.bootstrapKey}`);

  return parseMissionRoomResolvedBootstrap({
    requestedMode: bootstrap.mode,
    bootstrap: {
      mode: "local-single-user",
      authority: "local-preview",
      roomId: `local-room-${token}`,
      roomLabel: bootstrap.roomHint ?? "Local worker fallback room",
      seatLabel: routeSeed.mode === "validated-handoff" ? "Worker fallback seat" : "Fallback preview seat",
      connectionLabel: `${missionId} local fallback bootstrap ready`,
      objectiveState: "briefing",
      partySize: 1,
      metadata,
      presenceSnapshot: null,
    },
    source: {
      kind: "local-derived",
      label: args.label ?? "Deterministic local mission fallback",
      detail:
        args.detail ??
        `Mission worker bootstrap was unavailable, so the runtime fell back to a deterministic local mission room for ${missionId}.`,
      fallbackReason: args.fallbackReason ?? null,
      diagnostics: createBootstrapSourceDiagnostics({
        strategy: args.fallbackReason ? "worker-fallback" : "local-default",
        requestedMode: bootstrap.mode,
        resolvedMode: "local-single-user",
        metadata,
      }),
    },
  });
}

export async function bootstrapLocalMissionRoom(args: {
  routeSeed: MissionRoomRouteSeed;
  loadedSceneConfig: MissionRoomLoadedSceneConfig;
}): Promise<MissionRoomResolvedBootstrap> {
  await delay(110);
  return buildDeterministicLocalMissionRoomBootstrap(args);
}

export const localMissionRoomBootstrap: MissionRoomBootstrapPort = {
  bootstrap: bootstrapLocalMissionRoom,
};
