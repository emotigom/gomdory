import assert from "node:assert/strict";
import test from "node:test";

import { createWorldHubMissionHandoffPayload } from "@/lib/world-hub/mission/handoff";
import { loadEdgeBackedMissionSceneConfig } from "@/lib/world-hub/mission/manifest/edgeSceneConfig";
import { loadEdgeBackedWorldHubManifest } from "@/lib/world-hub/manifest/edgeManifest";

const orbitPortal = {
  id: "mission-orbit-lab",
  label: "Orbit Lab",
  summary: "Typed mission handoff target",
  statusLabel: "Join mission",
  availability: "available",
  accent: "#22d3ee",
  position: { x: 0, y: 0 },
  missionRoute: "/world-hub/missions/mission-orbit-lab",
} as const;

const validatedRouteSeed = {
  mode: "validated-handoff",
  missionId: orbitPortal.id,
  returnHubPath: "/world-hub",
  handoff: createWorldHubMissionHandoffPayload({
    worldId: "starter-world-hub",
    sessionId: "session-local-1",
    portal: orbitPortal,
    launchMode: "placeholder-route",
    bootstrapMode: "local-preview",
  }),
} as const;

test("edge-backed world-hub manifest loader returns edge-config source when payload is valid", async () => {
  const loadedManifest = await loadEdgeBackedWorldHubManifest({
    fetcher: async () =>
      new Response(
        JSON.stringify({
          worldId: "starter-world-hub",
          title: "Edge World Hub",
          subtitle: "Edge sourced manifest",
          bounds: { width: 100, height: 100 },
          spawn: { position: { x: 12, y: 20 }, heading: 0, speed: 0 },
          kiosk: {
            title: "Edge kiosk",
            summary: "Edge summary",
            hintLabel: "Press E",
            position: { x: 20, y: 20 },
          },
          hud: {
            runtimeBadge: "Edge config",
            movementLabel: "WASD",
            interactLabel: "E",
            cameraLabel: "Drag",
            panelTitle: "Portal panel",
            presenceTitle: "Presence",
            extensionTitle: "Future seams",
          },
          portals: [orbitPortal],
          bootstrap: {
            mode: "local-single-user",
            sessionId: "edge-local-session",
            shardLabel: "Edge local",
            occupancy: 1,
            reactionsEnabled: true,
            nearbyPeers: [],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  });

  assert.equal(loadedManifest.source.kind, "edge-config");
  assert.equal(loadedManifest.source.fallbackReason, null);
  assert.equal(loadedManifest.manifest.title, "Edge World Hub");
});

test("edge-backed world-hub manifest loader falls back locally on invalid payload", async () => {
  const loadedManifest = await loadEdgeBackedWorldHubManifest({
    fetcher: async () =>
      new Response(JSON.stringify({ title: "broken" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });

  assert.equal(loadedManifest.source.kind, "local-default");
  assert.equal(loadedManifest.source.fallbackReason, "invalid-payload");
  assert.match(loadedManifest.source.detail ?? "", /expected schema/i);
});

test("edge-backed mission scene loader merges edge template into local handoff-derived config", async () => {
  const loadedSceneConfig = await loadEdgeBackedMissionSceneConfig(validatedRouteSeed, {
    fetcher: async () =>
      new Response(
        JSON.stringify({
          missionId: orbitPortal.id,
          subtitle: "Edge briefing deck",
          missionTypeLabel: "Edge systems check",
          environmentLabel: "Edge relay deck",
          objectiveLabel: "Complete the edge objective.",
          returnLabel: "Return to world hub",
          bootstrap: {
            mode: "local-single-user",
            roomId: "edge-orbit-room",
            roomLabel: "Edge Orbit Room",
            objectiveState: "ready",
          },
          scene: {
            containerLabel: "Edge Mission Scene",
            containerSummary: "Edge template summary",
            placeholderTitle: "Edge placeholder",
            placeholderBody: "Edge placeholder body",
          },
          metadata: [{ label: "Config", value: "edge-template" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  });

  assert.equal(loadedSceneConfig.source.kind, "edge-config");
  assert.equal(loadedSceneConfig.config.title, "Orbit Lab");
  assert.equal(loadedSceneConfig.config.scene.containerLabel, "Edge Mission Scene");
  assert.equal(loadedSceneConfig.config.metadata.at(-1)?.value, "edge-template");
});

test("edge-backed mission scene loader falls back locally when config is unavailable", async () => {
  const loadedSceneConfig = await loadEdgeBackedMissionSceneConfig(validatedRouteSeed, {
    fetcher: async () => new Response(null, { status: 404 }),
  });

  assert.equal(loadedSceneConfig.source.kind, "local-derived");
  assert.equal(loadedSceneConfig.source.fallbackReason, "unavailable-config");
  assert.equal(loadedSceneConfig.config.title, "Orbit Lab");
});


test("edge-backed mission scene loader falls back locally on timeout", async () => {
  const loadedSceneConfig = await loadEdgeBackedMissionSceneConfig(validatedRouteSeed, {
    timeoutMs: 1,
    fetcher: async (_input, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Timed out", "AbortError"));
        });
      }),
  });

  assert.equal(loadedSceneConfig.source.kind, "local-derived");
  assert.equal(loadedSceneConfig.source.fallbackReason, "timeout");
});
