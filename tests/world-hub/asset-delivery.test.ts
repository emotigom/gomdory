import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveMissionRoomSceneLoading,
  resolveWorldHubSceneLoading,
} from "@/lib/world-hub/assets/sceneLoading";
import { loadR2BackedMissionRoomAssets, loadR2BackedWorldHubAssets } from "@/lib/world-hub/assets/r2AssetDelivery";
import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";
import { readMetaverseLaunchControlState } from "@/lib/world-hub/launch/adapter";
import { createEmptyMetaverseProgressSnapshot } from "@/lib/world-hub/progress/contracts";
import { createWorldHubRuntimeInputs } from "@/lib/world-hub/runtime/runtimeInputs";
import {
  createAuthoritativeSessionProjection,
  createLocalNoopPresenceSubscription,
} from "@/lib/world-hub/runtime/sessionProjection";

const noopPresence = createLocalNoopPresenceSubscription();

test("world-hub asset delivery falls back to deterministic local manifest in preview mode", async () => {
  const assets = await loadR2BackedWorldHubAssets(
    { worldId: "starter-world-hub" },
    {
      enabled: false,
    },
  );
  const sceneLoading = resolveWorldHubSceneLoading(assets);

  assert.equal(assets.source.kind, "local-manifest");
  assert.equal(assets.source.fallbackReason, "local-preview-mode");
  assert.equal(assets.source.diagnostics.deliveryMode, "local-preview");
  assert.equal(sceneLoading.stage, "fallback");
  assert.ok(assets.descriptors.length > 0);
});

test("world-hub asset delivery falls back locally when the remote manifest payload is invalid", async () => {
  const assets = await loadR2BackedWorldHubAssets(
    { worldId: "starter-world-hub" },
    {
      enabled: true,
      fetcher: async () =>
        new Response(JSON.stringify({ version: 1, scope: "world-hub", runtimeId: "starter-world-hub" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    },
  );

  assert.equal(assets.source.kind, "local-manifest");
  assert.equal(assets.source.fallbackReason, "invalid-payload");
  assert.equal(resolveWorldHubSceneLoading(assets).stage, "fallback");
});

test("world-hub scene loading resolves partial-ready when only core assets are ready", async () => {
  const assets = await loadR2BackedWorldHubAssets(
    { worldId: "starter-world-hub" },
    {
      enabled: true,
      publicBaseUrl: "https://cdn.example.com/world-hub",
      fetcher: async () =>
        new Response(
          JSON.stringify({
            version: 1,
            scope: "world-hub",
            runtimeId: "starter-world-hub",
            manifestVersion: "world-v42",
            assets: [
              {
                assetId: "hub-preview",
                role: "hub-preview-image",
                label: "Hub preview",
                kind: "scene-preview-image",
                href: "/worlds/starter-world-hub/hub-preview.webp",
                cacheKey: "hub-preview-v42",
                version: "42",
              },
              {
                assetId: "portal-preview",
                role: "portal-preview-image",
                label: "Portal preview",
                kind: "scene-preview-image",
                href: "/worlds/starter-world-hub/portal-preview.webp",
                cacheKey: "portal-preview-v42",
                version: "42",
              },
              {
                assetId: "kiosk-surface",
                role: "kiosk-surface",
                label: "Kiosk surface",
                kind: "data",
                href: "/worlds/starter-world-hub/kiosk.png",
                cacheKey: "kiosk-v42",
                version: "42",
              },
              {
                assetId: "broken-audio",
                role: "ambient-audio",
                label: "Broken audio ref",
                kind: "ambient-audio",
                href: "r2://starter-world-hub/audio.ogg",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    },
  );
  const sceneLoading = resolveWorldHubSceneLoading(assets);

  assert.equal(assets.source.kind, "r2-manifest");
  assert.equal(assets.source.fallbackReason, "unavailable-reference");
  assert.equal(assets.source.diagnostics.readyAssetCount, 3);
  assert.equal(assets.source.diagnostics.unavailableAssetCount, 1);
  assert.equal(sceneLoading.stage, "partial-ready");
  assert.deepEqual(sceneLoading.diagnostics.missingRoles, ["hub-scene"]);
  assert.deepEqual(sceneLoading.diagnostics.unavailableRoles, ["ambient-audio"]);
  assert.equal(assets.descriptors[0]?.href, "https://cdn.example.com/world-hub/worlds/starter-world-hub/hub-preview.webp");
});

test("world-hub scene loading resolves ready when staged scene assets are present", async () => {
  const assets = await loadR2BackedWorldHubAssets(
    { worldId: "starter-world-hub" },
    {
      enabled: true,
      publicBaseUrl: "https://cdn.example.com/world-hub",
      fetcher: async () =>
        new Response(
          JSON.stringify({
            version: 1,
            scope: "world-hub",
            runtimeId: "starter-world-hub",
            manifestVersion: "world-v43",
            assets: [
              {
                assetId: "hub-scene",
                role: "hub-scene",
                label: "Hub scene bundle",
                kind: "scene-bundle",
                href: "/worlds/starter-world-hub/scene.glb",
                cacheKey: "scene-v43",
                version: "43",
              },
              {
                assetId: "hub-preview",
                role: "hub-preview-image",
                label: "Hub preview",
                kind: "scene-preview-image",
                href: "/worlds/starter-world-hub/hub-preview.webp",
              },
              {
                assetId: "portal-preview",
                role: "portal-preview-image",
                label: "Portal preview",
                kind: "scene-preview-image",
                href: "/worlds/starter-world-hub/portal-preview.webp",
              },
              {
                assetId: "kiosk-surface",
                role: "kiosk-surface",
                label: "Kiosk surface",
                kind: "data",
                href: "/worlds/starter-world-hub/kiosk.png",
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    },
  );

  const sceneLoading = resolveWorldHubSceneLoading(assets);

  assert.equal(sceneLoading.stage, "ready");
  assert.equal(sceneLoading.assets.hubScene?.href, "https://cdn.example.com/world-hub/worlds/starter-world-hub/scene.glb");
});

test("mission asset delivery falls back locally when the remote manifest is missing", async () => {
  const assets = await loadR2BackedMissionRoomAssets(
    { missionId: "mission-orbit-lab" },
    {
      enabled: true,
      fetcher: async () => new Response(null, { status: 404 }),
    },
  );
  const sceneLoading = resolveMissionRoomSceneLoading(assets);

  assert.equal(assets.source.kind, "local-manifest");
  assert.equal(assets.source.fallbackReason, "missing-manifest");
  assert.equal(sceneLoading.stage, "fallback");
  assert.ok(assets.descriptors.length > 0);
});

test("world-hub runtime inputs expose stable scene loading instead of raw storage responses", async () => {
  const manifest = getDefaultWorldHubManifest();
  const session = createAuthoritativeSessionProjection({
    scope: "world-hub",
    runtimeId: manifest.bootstrap.mode === "local-single-user" ? manifest.bootstrap.sessionId : "fallback-session",
    runtimeAuthority: "local-preview",
    metadata: {
      authority: {
        scope: "world-hub",
        authorityKind: "local-preview",
        authorityEpochIso: null,
        ownerId: null,
        transferable: false,
      },
      presence: {
        scope: "world-hub",
        status: "inactive",
        transport: "none",
        channelKey: null,
        subscriptionToken: null,
      },
      reservation: {
        scope: "world-hub",
        status: "not-required",
        joinTicket: null,
        reservationId: null,
        confirmationRequired: false,
        expiresAtIso: null,
      },
    },
  });
  const presenceSubscription = await noopPresence.subscribe({ session });
  const assets = await loadR2BackedWorldHubAssets({ worldId: manifest.worldId }, { enabled: false });
  const sceneLoading = resolveWorldHubSceneLoading(assets);
  const launchControls = await readMetaverseLaunchControlState({
    context: {
      classId: null,
      worldId: manifest.worldId,
      sessionId: session.runtimeId,
    },
  });

  const runtime = createWorldHubRuntimeInputs({
    loadedManifest: {
      manifest,
      source: {
        kind: "local-default",
        label: "Bundled local manifest",
        detail: null,
        fallbackReason: null,
      },
      loadedAtIso: "2026-03-21T00:00:00.000Z",
    },
    bootstrap: {
      requestedMode: "local-single-user",
      bootstrap: {
        mode: "local-single-user",
        authority: "local-preview",
        sessionId: session.runtimeId,
        shardLabel: "Local preview",
        occupancy: 1,
        reactionsEnabled: true,
        nearbyPeers: manifest.bootstrap.mode === "local-single-user" ? manifest.bootstrap.nearbyPeers : [],
        metadata: {
          authority: {
            scope: "world-hub",
            authorityKind: "local-preview",
            authorityEpochIso: null,
            ownerId: null,
            transferable: false,
          },
          presence: {
            scope: "world-hub",
            status: "inactive",
            transport: "none",
            channelKey: null,
            subscriptionToken: null,
          },
          reservation: {
            scope: "world-hub",
            status: "not-required",
            joinTicket: null,
            reservationId: null,
            confirmationRequired: false,
            expiresAtIso: null,
          },
        },
      },
      source: {
        kind: "local-default",
        label: "Deterministic local session bootstrap",
        detail: null,
        fallbackReason: null,
        diagnostics: {
          scope: "world-hub",
          strategy: "local-default",
          requestedMode: "local-single-user",
          resolvedMode: "local-single-user",
          endpoint: null,
          hasReservedPresenceChannel: false,
          hasReservedReservation: false,
        },
      },
    },
    session,
    presenceSubscription,
    assets,
    sceneLoading,
    progress: createEmptyMetaverseProgressSnapshot(),
    launchControls,
  });

  assert.equal(runtime.assets.source.kind, "local-manifest");
  assert.equal(runtime.sceneLoading.stage, "fallback");
  assert.equal(runtime.sceneLoading.assets.hubPreviewImage?.href, "/logo/gom.svg");
  assert.equal(runtime.sceneLoading.diagnostics.sourceKind, "local-manifest");
});
