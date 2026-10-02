import type { WorldHubSceneManifest } from "@/lib/world-hub/contracts";
import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";

export function getEdgeWorldHubManifest(worldId?: string | null): WorldHubSceneManifest | null {
  const manifest = getDefaultWorldHubManifest();

  if (worldId && worldId !== manifest.worldId) {
    return null;
  }

  return manifest;
}
