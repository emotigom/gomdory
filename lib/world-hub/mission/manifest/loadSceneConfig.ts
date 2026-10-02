import type {
  MissionRoomLoadedSceneConfig,
  MissionRoomRouteSeed,
  MissionRoomSceneConfigLoader,
} from "@/lib/world-hub/mission/contracts";
import { parseMissionRoomLoadedSceneConfig } from "@/lib/world-hub/mission/contracts";
import type { ConfigFallbackReason } from "@/lib/world-hub/config/sourceContracts";
import { getLocalMissionSceneSnapshot } from "@/lib/world-hub/mission/manifest/localSceneSnapshot";

function delay(ms: number) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

export function buildMissionRoomLoadedSceneConfig(args: {
  routeSeed: MissionRoomRouteSeed;
  source: MissionRoomLoadedSceneConfig["source"];
}): MissionRoomLoadedSceneConfig {
  return parseMissionRoomLoadedSceneConfig({
    config: getLocalMissionSceneSnapshot(args.routeSeed),
    source: args.source,
    loadedAtIso: new Date().toISOString(),
  });
}

export async function loadLocalMissionSceneConfig(
  routeSeed: MissionRoomRouteSeed,
  args?: {
    fallbackReason?: ConfigFallbackReason | null;
    detail?: string | null;
    label?: string;
  },
): Promise<MissionRoomLoadedSceneConfig> {
  await delay(90);

  return buildMissionRoomLoadedSceneConfig({
    routeSeed,
    source: {
      kind: "local-derived",
      label:
        args?.label ??
        (routeSeed.mode === "validated-handoff"
          ? "Local handoff-derived mission config"
          : "Local fallback mission config"),
      detail:
        args?.detail ??
        (routeSeed.mode === "validated-handoff"
          ? "Deterministic mission config derived locally from the validated handoff payload."
          : "Deterministic fallback mission config derived locally from the mission route seed."),
      fallbackReason: args?.fallbackReason ?? null,
    },
  });
}

export const localMissionSceneConfigLoader: MissionRoomSceneConfigLoader = {
  loadInitialSceneConfig: loadLocalMissionSceneConfig,
};
