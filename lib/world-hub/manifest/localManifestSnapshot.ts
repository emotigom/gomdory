import type { WorldHubPortalManifest, WorldHubSceneManifest } from "@/lib/world-hub/contracts";
import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";

export function getLocalWorldHubManifestSnapshot(): WorldHubSceneManifest {
  return getDefaultWorldHubManifest();
}

export function getLocalWorldHubPortalById(portalId: string): WorldHubPortalManifest | null {
  return getLocalWorldHubManifestSnapshot().portals.find((portal) => portal.id === portalId) ?? null;
}
