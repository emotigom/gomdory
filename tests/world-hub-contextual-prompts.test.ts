import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorldHubNearbyContextualCue } from "@/lib/world-hub/runtime/contextualPrompts";

test("academy cue resolves within lodge approach radius when portals are far", () => {
  const cue = resolveWorldHubNearbyContextualCue({
    runtime: {
      spawn: { position: { x: 22, y: 52 } },
      kiosk: { position: { x: 28, y: 30 } },
      portals: [
        {
          id: "portal-a",
          label: "Sunrise Trail",
          summary: "summary",
          statusLabel: "open",
          availability: "available",
          entryCue: "open",
          accent: "#22d3ee",
          position: { x: 74, y: 34 },
          missionRoute: "/world-hub/missions/portal-a",
        },
      ],
    },
    playerPosition: { x: 35.2, y: 36.6 },
    selectedPortalId: null,
  });

  assert.equal(cue?.kind, "academy");
});

test("selected nearby portal still takes priority over academy cue", () => {
  const cue = resolveWorldHubNearbyContextualCue({
    runtime: {
      spawn: { position: { x: 22, y: 52 } },
      kiosk: { position: { x: 28, y: 30 } },
      portals: [
        {
          id: "portal-a",
          label: "Sunrise Trail",
          summary: "summary",
          statusLabel: "open",
          availability: "available",
          entryCue: "open",
          accent: "#22d3ee",
          position: { x: 31, y: 33 },
          missionRoute: "/world-hub/missions/portal-a",
        },
      ],
    },
    playerPosition: { x: 30, y: 32 },
    selectedPortalId: "portal-a",
  });

  assert.equal(cue?.kind, "portal");
  if (cue?.kind === "portal") {
    assert.equal(cue.portal.id, "portal-a");
  }
});
