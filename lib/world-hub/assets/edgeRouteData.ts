import type { MissionRoomAssetManifest, WorldHubAssetManifest } from "@/lib/world-hub/assets/contracts";
import {
  getLocalMissionRoomAssetManifestSnapshot,
  getLocalWorldHubAssetManifestSnapshot,
} from "@/lib/world-hub/assets/localAssetManifest";
import { getEdgeWorldHubManifest } from "@/lib/world-hub/manifest/edgeRouteData";
import { getEdgeMissionSceneTemplate } from "@/lib/world-hub/mission/manifest/edgeRouteData";

export function getEdgeWorldHubAssetManifest(worldId?: string | null): WorldHubAssetManifest | null {
  const manifest = getEdgeWorldHubManifest(worldId);
  if (!manifest) {
    return null;
  }

  return getLocalWorldHubAssetManifestSnapshot(manifest.worldId);
}

export function getEdgeMissionRoomAssetManifest(missionId: string): MissionRoomAssetManifest | null {
  if (!getEdgeMissionSceneTemplate(missionId)) {
    return null;
  }

  return getLocalMissionRoomAssetManifestSnapshot(missionId);
}
