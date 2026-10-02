import type { WorldHubLoadedManifest, WorldHubManifestLoader, WorldHubSceneManifest } from "@/lib/world-hub/contracts";
import { parseWorldHubLoadedManifest } from "@/lib/world-hub/contracts";
import type { ConfigFallbackReason } from "@/lib/world-hub/config/sourceContracts";
import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";

function delay(ms: number) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

export function buildWorldHubLoadedManifest(args: {
  manifest: WorldHubSceneManifest;
  source: WorldHubLoadedManifest["source"];
}): WorldHubLoadedManifest {
  return parseWorldHubLoadedManifest({
    manifest: args.manifest,
    source: args.source,
    loadedAtIso: new Date().toISOString(),
  });
}

export async function loadLocalWorldHubManifest(args?: {
  fallbackReason?: ConfigFallbackReason | null;
  detail?: string | null;
  label?: string;
}): Promise<WorldHubLoadedManifest> {
  await delay(120);

  return buildWorldHubLoadedManifest({
    manifest: getDefaultWorldHubManifest(),
    source: {
      kind: "local-default",
      label: args?.label ?? "Bundled local manifest",
      detail: args?.detail ?? "Deterministic local world-hub manifest bundled with the client.",
      fallbackReason: args?.fallbackReason ?? null,
    },
  });
}

export const localWorldHubManifestLoader: WorldHubManifestLoader = {
  loadInitialManifest: loadLocalWorldHubManifest,
};
