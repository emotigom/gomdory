import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";
import { resolveWorldHubPortalRidgeAnticipationCues } from "@/lib/world-hub/runtime/portalRidgeAnticipationCues";

function buildRuntime() {
  const manifest = getDefaultWorldHubManifest();
  return {
    scene: {
      worldId: manifest.worldId,
      title: manifest.title,
      subtitle: manifest.subtitle,
      bounds: manifest.bounds,
    },
    manifestSource: {
      kind: "local-default",
      label: "Local",
      detail: null,
      fallbackReason: null,
    },
    bootstrapSource: {
      kind: "local-manifest-default",
      label: "Local bootstrap",
      detail: "Local deterministic bootstrap",
      fallbackReason: null,
    },
    assets: {
      worldId: manifest.worldId,
      world: {
        sceneBundle: null,
      },
      missions: [],
      source: {
        kind: "local-asset-manifest",
        label: "Local assets",
        detail: "Local",
        fallbackReason: null,
      },
      diagnostics: {
        adapterKind: "local-asset-manifest",
        resolvedAtIso: "2026-03-26T00:00:00.000Z",
      },
    },
    sceneLoading: {
      status: "ready",
      stage: "ready",
      summaryLabel: "Ready",
      detail: "Loaded",
      sources: [],
      assets: {
        sceneBundle: {
          availability: "ready",
          href: "/assets/world-hub/scene-bundle.json",
          label: "Scene bundle",
        },
      },
    },
    policy: {} as WorldHubRuntimeInputs["policy"],
    hud: manifest.hud,
    spawn: manifest.spawn,
    kiosk: manifest.kiosk,
    portals: manifest.portals.map((portal) =>
      portal.id === "mission-orbit-lab" ? { ...portal, entryCue: "suggested" as const } : portal),
    decorationAnchors: manifest.decorationAnchors,
    homeLane: manifest.homeLane,
    session: {
      requestedMode: "local-single-user" as const,
      mode: "local-single-user" as const,
      authority: "local-preview" as const,
      sessionId: "local",
      shardLabel: "Preview",
      occupancy: 3,
      reactionsEnabled: true,
      projection: {
        sessionId: "local",
        occupancy: 3,
        reactionsEnabled: true,
        occupantIds: [],
        hostId: "local",
        shardLabel: "Preview",
        source: "bootstrap",
      },
    },
    presence: {
      nearbyPeers: [],
      subscription: {
        status: "idle",
        source: "deterministic-local-fallback",
        authority: "none",
        subscribers: [],
        updatedAtIso: "2026-03-26T00:00:00.000Z",
      },
    },
    progress: {} as WorldHubRuntimeInputs["progress"],
    launchControls: {} as WorldHubRuntimeInputs["launchControls"],
    liveSession: {
      status: "mission-starting-soon",
      missionStart: "teacher-cued",
      cueState: "start_mission",
      label: "Start mission",
      detail: "Mission starts now",
      updatedAtIso: "2026-03-26T00:00:00.000Z",
      source: "teacher-live-controls",
      fallback: "none",
    },
    seasonalDecorations: {} as WorldHubRuntimeInputs["seasonalDecorations"],
  } as unknown as WorldHubRuntimeInputs;
}

test("resolveWorldHubPortalRidgeAnticipationCues projects launch/readiness/expectation cues for target portal", () => {
  const runtime = buildRuntime();
  const resolved = resolveWorldHubPortalRidgeAnticipationCues({
    runtime,
    homeReadinessCue: {
      status: "ready",
      source: "suggestion",
      targetPortalId: "mission-orbit-lab",
      targetPortalLabel: "Orbit Lab",
      eyebrow: "Home readiness",
      title: "Ready",
      detail: "Ready",
      markerLabel: "Ready",
      chipLabel: "Mission Ready",
    },
    journeyPathGuidance: {
      status: "active",
      source: "readiness",
      targetPortalId: "mission-orbit-lab",
      targetPortalLabel: "Orbit Lab",
      eyebrow: "Guidance",
      title: "Path active",
      detail: "Follow the ridge path",
      chipLabel: "Active path",
    },
  });

  assert.equal(resolved.cues.length, 3);
  assert.equal(resolved.cues[0]?.tone, "warm");
  assert.equal(resolved.cues[1]?.active, true);
  assert.equal(resolved.cues[2]?.kind, "nearby-expectation");
  assert.match(resolved.summary?.chips.join(" "), /출발 가능/);
});

test("resolveWorldHubPortalRidgeAnticipationCues returns deterministic resting summary when runtime is absent", () => {
  const resolved = resolveWorldHubPortalRidgeAnticipationCues({
    runtime: null,
    homeReadinessCue: {
      status: "warming",
      source: "deterministic-fallback",
      targetPortalId: null,
      targetPortalLabel: null,
      eyebrow: "Home readiness",
      title: "Warming",
      detail: "Warming",
      markerLabel: "Warming",
      chipLabel: "Warming",
    },
    journeyPathGuidance: {
      status: "idle",
      source: "deterministic-fallback",
      targetPortalId: null,
      targetPortalLabel: null,
      eyebrow: "Guidance",
      title: "Idle",
      detail: "Idle",
      chipLabel: "Idle",
    },
  });

  assert.deepEqual(resolved, { cues: [], summary: null });
});
