import type {
  WorldHubResolvedSessionBootstrap,
  WorldHubSceneManifest,
  WorldHubSessionBootstrapPort,
} from "@/lib/world-hub/contracts";
import { parseWorldHubResolvedSessionBootstrap } from "@/lib/world-hub/contracts";
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

export function buildDeterministicLocalWorldHubSessionBootstrap(args: {
  manifest: WorldHubSceneManifest;
  label?: string;
  detail?: string | null;
  fallbackReason?: BootstrapFallbackReason | null;
}): WorldHubResolvedSessionBootstrap {
  const { manifest } = args;
  const metadata = createLocalSessionRuntimeMetadata("world-hub");

  if (manifest.bootstrap.mode === "local-single-user") {
    return parseWorldHubResolvedSessionBootstrap({
      requestedMode: manifest.bootstrap.mode,
      bootstrap: {
        mode: manifest.bootstrap.mode,
        authority: "local-preview",
        sessionId: manifest.bootstrap.sessionId,
        shardLabel: manifest.bootstrap.shardLabel,
        occupancy: manifest.bootstrap.occupancy,
        reactionsEnabled: manifest.bootstrap.reactionsEnabled,
        nearbyPeers: manifest.bootstrap.nearbyPeers,
        metadata,
        presenceSnapshot: null,
      },
      source: {
        kind: "local-default",
        label: args.label ?? "Deterministic local session bootstrap",
        detail:
          args.detail ?? "World-hub session booted from the canonical deterministic local preview bootstrap.",
        fallbackReason: args.fallbackReason ?? null,
        diagnostics: createBootstrapSourceDiagnostics({
          strategy: "local-default",
          requestedMode: manifest.bootstrap.mode,
          resolvedMode: manifest.bootstrap.mode,
          metadata,
        }),
      },
    });
  }

  const token = sanitizeBootstrapToken(`${manifest.worldId}-${manifest.bootstrap.bootstrapKey}`);

  return parseWorldHubResolvedSessionBootstrap({
    requestedMode: manifest.bootstrap.mode,
    bootstrap: {
      mode: "local-single-user",
      authority: "local-preview",
      sessionId: `local-${token}`,
      shardLabel: manifest.bootstrap.shardHint ?? "Local worker fallback",
      occupancy: 1,
      reactionsEnabled: false,
      nearbyPeers: [],
      metadata,
      presenceSnapshot: null,
    },
    source: {
      kind: "local-default",
      label: args.label ?? "Deterministic local session fallback",
      detail:
        args.detail ??
        `World-hub worker bootstrap was unavailable, so the runtime fell back to a deterministic local session for ${manifest.worldId}.`,
      fallbackReason: args.fallbackReason ?? null,
      diagnostics: createBootstrapSourceDiagnostics({
        strategy: args.fallbackReason ? "worker-fallback" : "local-default",
        requestedMode: manifest.bootstrap.mode,
        resolvedMode: "local-single-user",
        metadata,
      }),
    },
  });
}

export async function bootstrapLocalSingleUserWorldHub(
  manifest: WorldHubSceneManifest,
): Promise<WorldHubResolvedSessionBootstrap> {
  await delay(120);
  return buildDeterministicLocalWorldHubSessionBootstrap({ manifest });
}

export const localSingleUserWorldHubSessionBootstrap: WorldHubSessionBootstrapPort = {
  bootstrap: bootstrapLocalSingleUserWorldHub,
};
