import test from "node:test";
import assert from "node:assert/strict";

import { loadLocalWorldHubAssetManifest, getLocalWorldHubAssetManifestSnapshot } from "@/lib/world-hub/assets/localAssetManifest";
import { resolveWorldHubSceneLoading } from "@/lib/world-hub/assets/sceneLoading";
import { buildDeterministicLocalWorldHubSessionBootstrap } from "@/lib/world-hub/bootstrap/localSingleUser";
import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";
import { readMetaverseLaunchControlState } from "@/lib/world-hub/launch/adapter";
import { loadLocalWorldHubManifest } from "@/lib/world-hub/manifest/loadManifest";
import { buildDeterministicLocalWorldHubAccessPolicy } from "@/lib/world-hub/policy/localPreview";
import { createBrowserMetaverseProgressPersistence } from "@/lib/world-hub/progress/browserPersistence";
import { createWorldHubRuntimeInputs } from "@/lib/world-hub/runtime/runtimeInputs";
import { buildFallbackWorldHubSceneBundle, parseWorldHubSceneBundle } from "@/lib/world-hub/runtime/sceneBundle";
import { createAuthoritativeSessionProjection, createLocalNoopPresenceSubscription } from "@/lib/world-hub/runtime/sessionProjection";

test("local world-hub asset manifest advertises the scene bundle role", () => {
  const manifest = getLocalWorldHubAssetManifestSnapshot("starter-world-hub");
  const hubScene = manifest.assets.find((asset) => asset.role === "hub-scene");

  assert.ok(hubScene);
  assert.equal(hubScene?.href, "/world-hub/starter-world-hub.scene.json");
  assert.equal(hubScene?.kind, "scene-bundle");
});

test("scene bundle parser accepts a minimal production scene payload", () => {
  const bundle = parseWorldHubSceneBundle({
    version: 1,
    palette: {
      skyTop: "#08203a",
      skyBottom: "#020617",
    },
    structures: [
      {
        id: "platform-a",
        kind: "platform",
        position: { x: 50, y: 50 },
        size: { x: 20, y: 2, z: 16 },
        color: "#162238",
      },
    ],
  });

  assert.equal(bundle.version, 1);
  assert.equal(bundle.structures[0]?.id, "platform-a");
  assert.equal(bundle.palette.skyTop, "#08203a");
});

test("scene bundle parser preserves optional prop labels for social plaza cues", () => {
  const bundle = parseWorldHubSceneBundle({
    version: 1,
    props: [
      {
        id: "gather-campfire",
        kind: "campfire",
        position: { x: 50, y: 50 },
        color: "#7c2d12",
        accent: "#fb923c",
        label: "Friends gather here",
      },
    ],
  });

  assert.equal(bundle.props[0]?.label, "Friends gather here");
});

test("fallback scene bundle deterministically reflects manifest portals and spawn", async () => {
  const manifest = getDefaultWorldHubManifest();
  const loadedManifest = await loadLocalWorldHubManifest();
  const bootstrap = buildDeterministicLocalWorldHubSessionBootstrap({ manifest });
  const session = createAuthoritativeSessionProjection({
    scope: "world-hub",
    runtimeId: bootstrap.bootstrap.sessionId,
    runtimeAuthority: bootstrap.bootstrap.authority,
    metadata: bootstrap.bootstrap.metadata,
  });
  const presenceSubscription = await createLocalNoopPresenceSubscription().subscribe({
    session,
    authorityPresence: bootstrap.bootstrap.presenceSnapshot,
  });
  const assets = await loadLocalWorldHubAssetManifest({ worldId: manifest.worldId });
  const sceneLoading = resolveWorldHubSceneLoading(assets);
  const policy = buildDeterministicLocalWorldHubAccessPolicy({ manifest });
  const progress = await createBrowserMetaverseProgressPersistence({ enabled: false, storage: null }).readSnapshot();
  const launchControls = await readMetaverseLaunchControlState({
    context: {
      classId: null,
      worldId: manifest.worldId,
      sessionId: bootstrap.bootstrap.sessionId,
    },
  });
  const runtime = createWorldHubRuntimeInputs({
    loadedManifest,
    bootstrap,
    session,
    presenceSubscription,
    assets,
    sceneLoading,
    policy,
    progress,
    launchControls,
  });

  const bundle = buildFallbackWorldHubSceneBundle(runtime);

  assert.equal(bundle.structures.some((structure) => structure.id === "kiosk-pillar"), true);
  assert.equal(bundle.structures.some((structure) => structure.id === "academy-lodge-arch"), true);
  assert.equal(bundle.decals.some((decal) => decal.id === "spawn-ring"), true);
  assert.equal(bundle.decals.some((decal) => decal.id === "academy-arrival-ring"), true);
  assert.equal(bundle.structures.some((structure) => structure.id === "mission-orbit-lab-arch"), true);
  assert.equal(bundle.props.some((prop) => prop.id === "plaza-gather-campfire"), true);
  assert.equal(bundle.props.some((prop) => prop.id === "academy-prep-campfire"), true);
  assert.equal(bundle.props.some((prop) => prop.id === "plaza-gather-photo-frame"), true);
});
