import type {
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

const LOCAL_ASSET_MANIFEST_VERSION = "local-preview-v1";
const LOCAL_ASSET_VERSION = "dev-local";
const LOCAL_CACHE_KEY = "local-preview";

export function getLocalWorldHubAssetManifestSnapshot(worldId: string): WorldHubAssetManifest {
  return parseWorldHubAssetManifest({
    version: 1,
    scope: "world-hub",
    runtimeId: worldId,
    manifestVersion: LOCAL_ASSET_MANIFEST_VERSION,
    assets: [
      {
        assetId: `${worldId}:hub-scene`,
        role: "hub-scene",
        label: "World hub scene bundle",
        kind: "scene-bundle",
        href: "/world-hub/starter-world-hub.scene.json",
        contentType: "application/json",
        version: LOCAL_ASSET_VERSION,
        cacheKey: LOCAL_CACHE_KEY,
      },
      {
        assetId: `${worldId}:hub-preview`,
        role: "hub-preview-image",
        label: "World hub preview image",
        kind: "scene-preview-image",
        href: "/logo/gom.svg",
        contentType: "image/svg+xml",
        version: LOCAL_ASSET_VERSION,
        cacheKey: LOCAL_CACHE_KEY,
      },
      {
        assetId: `${worldId}:kiosk-surface`,
        role: "kiosk-surface",
        label: "World hub kiosk surface",
        kind: "data",
        href: "/logo/gom-low.png",
        contentType: "image/png",
        version: LOCAL_ASSET_VERSION,
        cacheKey: LOCAL_CACHE_KEY,
      },
      {
        assetId: `${worldId}:portal-preview`,
        role: "portal-preview-image",
        label: "Portal preview placeholder",
        kind: "scene-preview-image",
        href: "/demo/gallery/cover-1.svg",
        contentType: "image/svg+xml",
        version: LOCAL_ASSET_VERSION,
        cacheKey: LOCAL_CACHE_KEY,
      },
    ],
  });
}

export function getLocalMissionRoomAssetManifestSnapshot(missionId: string): MissionRoomAssetManifest {
  return parseMissionRoomAssetManifest({
    version: 1,
    scope: "mission-room",
    runtimeId: missionId,
    manifestVersion: LOCAL_ASSET_MANIFEST_VERSION,
    assets: [
      {
        assetId: `${missionId}:mission-preview`,
        role: "mission-preview-image",
        label: "Mission preview image",
        kind: "scene-preview-image",
        href: "/demo/gallery/cover-2.svg",
        contentType: "image/svg+xml",
        version: LOCAL_ASSET_VERSION,
        cacheKey: LOCAL_CACHE_KEY,
      },
      {
        assetId: `${missionId}:briefing`,
        role: "mission-briefing",
        label: "Mission briefing placeholder",
        kind: "mission-briefing",
        href: "/logo/gom-low-wo-srgb-profile.png",
        contentType: "image/png",
        version: LOCAL_ASSET_VERSION,
        cacheKey: LOCAL_CACHE_KEY,
      },
    ],
  });
}

function toWorldHubDescriptor(asset: WorldHubAssetManifest["assets"][number]): WorldHubResolvedAssetDescriptor {
  return {
    assetId: asset.assetId,
    role: asset.role,
    label: asset.label,
    kind: asset.kind,
    href: asset.href,
    availability: "ready",
    contentType: asset.contentType,
    bytes: asset.bytes,
    integrity: asset.integrity,
    version: asset.version,
    cacheKey: asset.cacheKey,
  };
}

function toMissionRoomDescriptor(asset: MissionRoomAssetManifest["assets"][number]): MissionRoomResolvedAssetDescriptor {
  return {
    assetId: asset.assetId,
    role: asset.role,
    label: asset.label,
    kind: asset.kind,
    href: asset.href,
    availability: "ready",
    contentType: asset.contentType,
    bytes: asset.bytes,
    integrity: asset.integrity,
    version: asset.version,
    cacheKey: asset.cacheKey,
  };
}

export async function loadLocalWorldHubAssetManifest(args: {
  worldId: string;
  detail?: string | null;
  fallbackReason?: WorldHubResolvedAssetSet["source"]["fallbackReason"];
}): Promise<WorldHubResolvedAssetSet> {
  const manifest = getLocalWorldHubAssetManifestSnapshot(args.worldId);
  const descriptors = manifest.assets.map(toWorldHubDescriptor);

  return parseWorldHubResolvedAssetSet({
    scope: "world-hub",
    runtimeId: manifest.runtimeId,
    manifestVersion: manifest.manifestVersion,
    descriptors,
    source: {
      kind: "local-manifest",
      label: "Local preview asset manifest",
      detail: args.detail ?? "Deterministic local asset manifest bundled for preview-safe world-hub delivery.",
      fallbackReason: args.fallbackReason ?? null,
      diagnostics: {
        scope: "world-hub",
        runtimeId: manifest.runtimeId,
        deliveryMode: "local-preview",
        baseUrl: null,
        manifestVersion: manifest.manifestVersion,
        assetCount: descriptors.length,
        readyAssetCount: descriptors.length,
        unavailableAssetCount: 0,
      },
    },
    loadedAtIso: new Date().toISOString(),
  });
}

export async function loadLocalMissionRoomAssetManifest(args: {
  missionId: string;
  detail?: string | null;
  fallbackReason?: MissionRoomResolvedAssetSet["source"]["fallbackReason"];
}): Promise<MissionRoomResolvedAssetSet> {
  const manifest = getLocalMissionRoomAssetManifestSnapshot(args.missionId);
  const descriptors = manifest.assets.map(toMissionRoomDescriptor);

  return parseMissionRoomResolvedAssetSet({
    scope: "mission-room",
    runtimeId: manifest.runtimeId,
    manifestVersion: manifest.manifestVersion,
    descriptors,
    source: {
      kind: "local-manifest",
      label: "Local preview asset manifest",
      detail: args.detail ?? "Deterministic local asset manifest bundled for preview-safe mission delivery.",
      fallbackReason: args.fallbackReason ?? null,
      diagnostics: {
        scope: "mission-room",
        runtimeId: manifest.runtimeId,
        deliveryMode: "local-preview",
        baseUrl: null,
        manifestVersion: manifest.manifestVersion,
        assetCount: descriptors.length,
        readyAssetCount: descriptors.length,
        unavailableAssetCount: 0,
      },
    },
    loadedAtIso: new Date().toISOString(),
  });
}
