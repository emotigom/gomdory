import test from "node:test";
import assert from "node:assert/strict";

import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";
import { resolveWorldHubNearbyContextualCue } from "@/lib/world-hub/runtime/contextualPrompts";

const manifest = getDefaultWorldHubManifest();

test("returns the home cue near spawn when no higher-priority trail gate is nearby", () => {
  const cue = resolveWorldHubNearbyContextualCue({
    runtime: {
      spawn: manifest.spawn,
      kiosk: manifest.kiosk,
      portals: manifest.portals,
    },
    playerPosition: { x: manifest.spawn.position.x + 2, y: manifest.spawn.position.y + 1 },
  });

  assert.deepEqual(cue?.kind, "home");
});

test("returns the academy cue near the kiosk when home and portals are not closer", () => {
  const cue = resolveWorldHubNearbyContextualCue({
    runtime: {
      spawn: manifest.spawn,
      kiosk: manifest.kiosk,
      portals: manifest.portals,
    },
    playerPosition: { x: manifest.kiosk.position.x + 1, y: manifest.kiosk.position.y + 1 },
  });

  assert.deepEqual(cue?.kind, "academy");
});

test("returns only one nearby cue and honors an in-range selected portal", () => {
  const cue = resolveWorldHubNearbyContextualCue({
    runtime: {
      spawn: manifest.spawn,
      kiosk: manifest.kiosk,
      portals: [
        { ...manifest.portals[0], id: "near-a", position: { x: 50, y: 50 } },
        { ...manifest.portals[1], id: "near-b", position: { x: 54, y: 50 } },
      ],
    },
    playerPosition: { x: 51, y: 50 },
    selectedPortalId: "near-b",
  });

  assert.ok(cue);
  assert.equal(cue?.kind, "portal");
  if (cue?.kind === "portal") {
    assert.equal(cue.portal.id, "near-b");
  }
});
