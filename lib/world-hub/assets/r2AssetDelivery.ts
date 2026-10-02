import { ZodError } from "zod";

import type {
  MetaverseAssetDeliveryPort,
  MissionRoomAssetManifest,
  MissionRoomResolvedAssetDescriptor,
  MissionRoomResolvedAssetSet,
  WorldHubAssetManifest,
  WorldHubResolvedAssetDescriptor,
  WorldHubResolvedAssetSet,
} from "@/lib/world-hub/assets/contracts";
import {
  parseMissionRoomAssetManifest,
  parseMissionRoomResolvedAssetSet,
  parseWorldHubAssetManifest,
  parseWorldHubResolvedAssetSet,
} from "@/lib/world-hub/assets/contracts";
import {
  loadLocalMissionRoomAssetManifest,
  loadLocalWorldHubAssetManifest,
} from "@/lib/world-hub/assets/localAssetManifest";

type FetchLike = typeof fetch;

type R2AssetDeliveryOptions = {
  enabled?: boolean;
  fetcher?: FetchLike;
  timeoutMs?: number;
  endpointBuilder?: (args: { scope: "world-hub" | "mission-room"; runtimeId: string }) => string;
  publicBaseUrl?: string | null;
};

const DEFAULT_TIMEOUT_MS = 1500;

function defaultEndpointBuilder(args: { scope: "world-hub" | "mission-room"; runtimeId: string }) {
  const encodedRuntimeId = encodeURIComponent(args.runtimeId);
  return args.scope === "world-hub"
    ? `/world-hub/api/assets/worlds/${encodedRuntimeId}/manifest`
    : `/world-hub/api/assets/missions/${encodedRuntimeId}/manifest`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException ? error.name === "AbortError" : false;
}

function normalizeBaseUrl(value?: string | null) {
  return value?.trim().replace(/\/+$/, "") || null;
}

function resolveAssetHref(href: string, publicBaseUrl: string | null) {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  if (!href.startsWith("/")) {
    return null;
  }

  return publicBaseUrl ? `${publicBaseUrl}${href}` : href;
}

async function fetchJsonWithTimeout(args: {
  endpoint: string;
  fetcher: FetchLike;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    return await args.fetcher(args.endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function resolveWorldHubDescriptors(
  manifest: WorldHubAssetManifest,
  publicBaseUrl: string | null,
): { descriptors: WorldHubResolvedAssetDescriptor[]; unavailableCount: number } {
  let unavailableCount = 0;

  const descriptors = manifest.assets.map((asset) => {
    const href = resolveAssetHref(asset.href, publicBaseUrl);
    const availability = href ? "ready" : "unavailable";
    if (availability === "unavailable") {
      unavailableCount += 1;
    }

    return {
      assetId: asset.assetId,
      role: asset.role,
      label: asset.label,
      kind: asset.kind,
      href,
      availability,
      contentType: asset.contentType,
      bytes: asset.bytes,
      integrity: asset.integrity,
      version: asset.version,
      cacheKey: asset.cacheKey,
    } satisfies WorldHubResolvedAssetDescriptor;
  });

  return { descriptors, unavailableCount };
}

function resolveMissionRoomDescriptors(
  manifest: MissionRoomAssetManifest,
  publicBaseUrl: string | null,
): { descriptors: MissionRoomResolvedAssetDescriptor[]; unavailableCount: number } {
  let unavailableCount = 0;

  const descriptors = manifest.assets.map((asset) => {
    const href = resolveAssetHref(asset.href, publicBaseUrl);
    const availability = href ? "ready" : "unavailable";
    if (availability === "unavailable") {
      unavailableCount += 1;
    }

    return {
      assetId: asset.assetId,
      role: asset.role,
      label: asset.label,
      kind: asset.kind,
      href,
      availability,
      contentType: asset.contentType,
      bytes: asset.bytes,
      integrity: asset.integrity,
      version: asset.version,
      cacheKey: asset.cacheKey,
    } satisfies MissionRoomResolvedAssetDescriptor;
  });

  return { descriptors, unavailableCount };
}

async function loadWorldHubFallback(args: {
  worldId: string;
  detail: string;
  fallbackReason: WorldHubResolvedAssetSet["source"]["fallbackReason"];
}) {
  return loadLocalWorldHubAssetManifest(args);
}

async function loadMissionFallback(args: {
  missionId: string;
  detail: string;
  fallbackReason: MissionRoomResolvedAssetSet["source"]["fallbackReason"];
}) {
  return loadLocalMissionRoomAssetManifest(args);
}

export async function loadR2BackedWorldHubAssets(
  args: { worldId: string },
  options: R2AssetDeliveryOptions = {},
): Promise<WorldHubResolvedAssetSet> {
  if (!options.enabled) {
    return loadWorldHubFallback({
      worldId: args.worldId,
      detail: "Asset delivery stayed on the local preview manifest because remote asset delivery is disabled.",
      fallbackReason: "local-preview-mode",
    });
  }

  const endpoint = (options.endpointBuilder ?? defaultEndpointBuilder)({
    scope: "world-hub",
    runtimeId: args.worldId,
  });
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const publicBaseUrl = normalizeBaseUrl(options.publicBaseUrl);

  try {
    const response = await fetchJsonWithTimeout({ endpoint, fetcher, timeoutMs });

    if (response.status === 404 || response.status === 204) {
      return loadWorldHubFallback({
        worldId: args.worldId,
        detail: `Remote asset manifest is unavailable from ${endpoint} (${response.status}).`,
        fallbackReason: "missing-manifest",
      });
    }

    if (!response.ok) {
      return loadWorldHubFallback({
        worldId: args.worldId,
        detail: `Remote asset manifest request failed from ${endpoint} (${response.status}).`,
        fallbackReason: "unavailable-manifest",
      });
    }

    const manifest = parseWorldHubAssetManifest(await response.json());
    const { descriptors, unavailableCount } = resolveWorldHubDescriptors(manifest, publicBaseUrl);

    return parseWorldHubResolvedAssetSet({
      scope: "world-hub",
      runtimeId: manifest.runtimeId,
      manifestVersion: manifest.manifestVersion,
      descriptors,
      source: {
        kind: "r2-manifest",
        label: "R2/CDN asset manifest",
        detail:
          unavailableCount > 0
            ? `Loaded remote asset manifest from ${endpoint} with ${unavailableCount} unavailable reference(s).`
            : `Loaded remote asset manifest from ${endpoint}.`,
        fallbackReason: unavailableCount > 0 ? "unavailable-reference" : null,
        diagnostics: {
          scope: "world-hub",
          runtimeId: manifest.runtimeId,
          deliveryMode: "r2-manifest",
          baseUrl: publicBaseUrl,
          manifestVersion: manifest.manifestVersion,
          assetCount: descriptors.length,
          readyAssetCount: descriptors.length - unavailableCount,
          unavailableAssetCount: unavailableCount,
        },
      },
      loadedAtIso: new Date().toISOString(),
    });
  } catch (error) {
    if (isAbortError(error)) {
      return loadWorldHubFallback({
        worldId: args.worldId,
        detail: `Remote asset manifest request to ${endpoint} timed out after ${timeoutMs}ms.`,
        fallbackReason: "unavailable-manifest",
      });
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      return loadWorldHubFallback({
        worldId: args.worldId,
        detail: `Remote asset manifest from ${endpoint} did not match the expected schema.`,
        fallbackReason: "invalid-payload",
      });
    }

    return loadWorldHubFallback({
      worldId: args.worldId,
      detail: `Remote asset manifest request failed from ${endpoint}: ${error instanceof Error ? error.message : "unknown error"}`,
      fallbackReason: "unavailable-manifest",
    });
  }
}

export async function loadR2BackedMissionRoomAssets(
  args: { missionId: string },
  options: R2AssetDeliveryOptions = {},
): Promise<MissionRoomResolvedAssetSet> {
  if (!options.enabled) {
    return loadMissionFallback({
      missionId: args.missionId,
      detail: "Asset delivery stayed on the local preview manifest because remote asset delivery is disabled.",
      fallbackReason: "local-preview-mode",
    });
  }

  const endpoint = (options.endpointBuilder ?? defaultEndpointBuilder)({
    scope: "mission-room",
    runtimeId: args.missionId,
  });
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const publicBaseUrl = normalizeBaseUrl(options.publicBaseUrl);

  try {
    const response = await fetchJsonWithTimeout({ endpoint, fetcher, timeoutMs });

    if (response.status === 404 || response.status === 204) {
      return loadMissionFallback({
        missionId: args.missionId,
        detail: `Remote asset manifest is unavailable from ${endpoint} (${response.status}).`,
        fallbackReason: "missing-manifest",
      });
    }

    if (!response.ok) {
      return loadMissionFallback({
        missionId: args.missionId,
        detail: `Remote asset manifest request failed from ${endpoint} (${response.status}).`,
        fallbackReason: "unavailable-manifest",
      });
    }

    const manifest = parseMissionRoomAssetManifest(await response.json());
    const { descriptors, unavailableCount } = resolveMissionRoomDescriptors(manifest, publicBaseUrl);

    return parseMissionRoomResolvedAssetSet({
      scope: "mission-room",
      runtimeId: manifest.runtimeId,
      manifestVersion: manifest.manifestVersion,
      descriptors,
      source: {
        kind: "r2-manifest",
        label: "R2/CDN asset manifest",
        detail:
          unavailableCount > 0
            ? `Loaded remote asset manifest from ${endpoint} with ${unavailableCount} unavailable reference(s).`
            : `Loaded remote asset manifest from ${endpoint}.`,
        fallbackReason: unavailableCount > 0 ? "unavailable-reference" : null,
        diagnostics: {
          scope: "mission-room",
          runtimeId: manifest.runtimeId,
          deliveryMode: "r2-manifest",
          baseUrl: publicBaseUrl,
          manifestVersion: manifest.manifestVersion,
          assetCount: descriptors.length,
          readyAssetCount: descriptors.length - unavailableCount,
          unavailableAssetCount: unavailableCount,
        },
      },
      loadedAtIso: new Date().toISOString(),
    });
  } catch (error) {
    if (isAbortError(error)) {
      return loadMissionFallback({
        missionId: args.missionId,
        detail: `Remote asset manifest request to ${endpoint} timed out after ${timeoutMs}ms.`,
        fallbackReason: "unavailable-manifest",
      });
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      return loadMissionFallback({
        missionId: args.missionId,
        detail: `Remote asset manifest from ${endpoint} did not match the expected schema.`,
        fallbackReason: "invalid-payload",
      });
    }

    return loadMissionFallback({
      missionId: args.missionId,
      detail: `Remote asset manifest request failed from ${endpoint}: ${error instanceof Error ? error.message : "unknown error"}`,
      fallbackReason: "unavailable-manifest",
    });
  }
}

export function createR2BackedMetaverseAssetDelivery(
  options: R2AssetDeliveryOptions = {},
): MetaverseAssetDeliveryPort {
  return {
    loadWorldHubAssets: (args) => loadR2BackedWorldHubAssets(args, options),
    loadMissionRoomAssets: (args) => loadR2BackedMissionRoomAssets(args, options),
  };
}
