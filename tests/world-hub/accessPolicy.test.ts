import assert from "node:assert/strict";
import test from "node:test";

import { parseWorldHubSceneManifest } from "@/lib/world-hub/contracts";
import { parseMissionRoomRouteSeed } from "@/lib/world-hub/mission/contracts";
import { getLocalMissionSceneSnapshot } from "@/lib/world-hub/mission/manifest/localSceneSnapshot";
import {
  createEdgeMissionRoomAccessPolicyPort,
  createEdgeWorldHubAccessPolicyPort,
} from "@/lib/world-hub/policy/edgePolicy";
import {
  buildDeterministicLocalMissionRoomAccessPolicy,
  buildDeterministicLocalWorldHubAccessPolicy,
} from "@/lib/world-hub/policy/localPreview";

function createJsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

test("local world-hub preview policy blocks locked portals while allowing hub entry", () => {
  const manifest = parseWorldHubSceneManifest({
    worldId: "teacher-preview-world",
    title: "Teacher Preview",
    subtitle: "local",
    bounds: { width: 100, height: 100 },
    spawn: { position: { x: 10, y: 10 }, heading: 0, speed: 0 },
    kiosk: { title: "Kiosk", summary: "summary", hintLabel: "hint", position: { x: 12, y: 12 } },
    hud: {
      runtimeBadge: "Local",
      movementLabel: "Move",
      interactLabel: "Interact",
      cameraLabel: "Camera",
      panelTitle: "Panel",
      presenceTitle: "Presence",
      extensionTitle: "Extension",
    },
    portals: [
      {
        id: "mission-open",
        label: "Open Mission",
        summary: "summary",
        statusLabel: "Join",
        availability: "available",
        accent: "#22d3ee",
        position: { x: 40, y: 40 },
        missionRoute: "/world-hub/missions/mission-open",
      },
      {
        id: "mission-locked",
        label: "Locked Mission",
        summary: "summary",
        statusLabel: "Locked",
        availability: "locked",
        accent: "#f43f5e",
        position: { x: 60, y: 60 },
        missionRoute: "/world-hub/missions/mission-locked",
      },
    ],
    bootstrap: {
      mode: "local-single-user",
      sessionId: "preview-session",
      shardLabel: "local",
      occupancy: 1,
      reactionsEnabled: true,
      nearbyPeers: [],
    },
  });

  const policy = buildDeterministicLocalWorldHubAccessPolicy({ manifest });

  assert.equal(policy.entry.status, "allowed");
  assert.equal(policy.missions.find((mission) => mission.missionId === "mission-open")?.decision.status, "allowed");
  assert.equal(policy.missions.find((mission) => mission.missionId === "mission-locked")?.decision.status, "blocked");
});

test("edge world-hub policy falls back to deterministic local snapshot on invalid payload", async () => {
  const manifest = parseWorldHubSceneManifest({
    worldId: "teacher-preview-world",
    title: "Teacher Preview",
    subtitle: "local",
    bounds: { width: 100, height: 100 },
    spawn: { position: { x: 10, y: 10 }, heading: 0, speed: 0 },
    kiosk: { title: "Kiosk", summary: "summary", hintLabel: "hint", position: { x: 12, y: 12 } },
    hud: {
      runtimeBadge: "Local",
      movementLabel: "Move",
      interactLabel: "Interact",
      cameraLabel: "Camera",
      panelTitle: "Panel",
      presenceTitle: "Presence",
      extensionTitle: "Extension",
    },
    portals: [],
    bootstrap: {
      mode: "local-single-user",
      sessionId: "preview-session",
      shardLabel: "local",
      occupancy: 1,
      reactionsEnabled: true,
      nearbyPeers: [],
    },
  });

  const policyPort = createEdgeWorldHubAccessPolicyPort({
    fetcher: async () => createJsonResponse({ bad: true }),
  });

  const policy = await policyPort.resolvePolicy(manifest);

  assert.equal(policy.source.kind, "local-preview");
  assert.equal(policy.source.fallbackReason, "invalid-policy");
  assert.equal(policy.resolution, "fallback");
});

test("edge mission policy blocks mismatched mission scope", async () => {
  const routeSeed = parseMissionRoomRouteSeed({
    mode: "validated-handoff",
    missionId: "mission-orbit-lab",
    returnHubPath: "/world-hub",
    handoff: {
      version: 1,
      worldId: "starter-world-hub",
      sessionId: "edge-session-1",
      missionId: "mission-orbit-lab",
      launchMode: "placeholder-route",
      bootstrapMode: "edge-bootstrap",
      issuedAtIso: new Date().toISOString(),
      portal: {
        id: "mission-orbit-lab",
        label: "Orbit Lab",
        summary: "summary",
        statusLabel: "Join",
        availability: "available",
        accent: "#22d3ee",
        missionRoute: "/world-hub/missions/mission-orbit-lab",
      },
    },
  });
  const loadedSceneConfig = {
    config: getLocalMissionSceneSnapshot(routeSeed),
    source: {
      kind: "local-derived",
      label: "Local",
      detail: null,
      fallbackReason: null,
    },
    loadedAtIso: new Date().toISOString(),
  } as const;

  const port = createEdgeMissionRoomAccessPolicyPort({
    fetcher: async () =>
      createJsonResponse({
        scope: {
          classId: "class-1",
          sessionId: "session-1",
          worldId: "starter-world-hub",
          missionId: "mission-other",
        },
        preview: {
          mode: "require-resolved-policy",
          fallback: "block",
          label: "Teacher policy",
          detail: "detail",
        },
        entry: {
          status: "allowed",
          code: "allowed",
          label: "Allowed",
          detail: null,
        },
      }),
  });

  const policy = await port.resolvePolicy({ routeSeed, loadedSceneConfig });

  assert.equal(policy.entry.status, "blocked");
  assert.equal(policy.entry.code, "mission-mismatch");
  assert.equal(policy.source.fallbackReason, "scope-mismatch");
});

test("local mission preview policy preserves validated handoff session scope", () => {
  const routeSeed = parseMissionRoomRouteSeed({
    mode: "validated-handoff",
    missionId: "mission-orbit-lab",
    returnHubPath: "/world-hub",
    handoff: {
      version: 1,
      worldId: "starter-world-hub",
      sessionId: "edge-session-1",
      missionId: "mission-orbit-lab",
      launchMode: "placeholder-route",
      bootstrapMode: "local-preview",
      issuedAtIso: new Date().toISOString(),
      portal: {
        id: "mission-orbit-lab",
        label: "Orbit Lab",
        summary: "summary",
        statusLabel: "Join",
        availability: "available",
        accent: "#22d3ee",
        missionRoute: "/world-hub/missions/mission-orbit-lab",
      },
    },
  });
  const loadedSceneConfig = {
    config: getLocalMissionSceneSnapshot(routeSeed),
    source: {
      kind: "local-derived",
      label: "Local",
      detail: null,
      fallbackReason: null,
    },
    loadedAtIso: new Date().toISOString(),
  } as const;

  const policy = buildDeterministicLocalMissionRoomAccessPolicy({ routeSeed, loadedSceneConfig });

  assert.equal(policy.scope.worldId, "starter-world-hub");
  assert.equal(policy.scope.sessionId, "edge-session-1");
  assert.equal(policy.entry.status, "allowed");
});
