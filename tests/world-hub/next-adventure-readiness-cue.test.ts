import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import { resolveWorldHubNextAdventureReadinessCue } from "@/lib/world-hub/runtime/nextAdventureReadinessCue";
import type { WorldHubNextAdventureSuggestionCue } from "@/lib/world-hub/runtime/nextAdventureSuggestionCue";
import type { WorldHubRecentJourneyView } from "@/lib/world-hub/runtime/recentJourney";

const recentJourneyReady: WorldHubRecentJourneyView = {
  status: "ready",
  eyebrow: "Recent journey",
  title: "Sunrise Trail is part of your path",
  detail: "Journey seam",
  missionLabel: "Sunrise Trail · Completed · 100%",
  rewardLabel: "Forest ribbon · Gold",
  continuityLabel: "4 gentle streak",
  chips: ["Saved"],
};

const suggestionFixture: WorldHubNextAdventureSuggestionCue = {
  status: "suggested",
  source: "resolved-runtime",
  eyebrow: "Next trail",
  title: "Lantern Grove is a gentle next step",
  detail: "After Sunrise Trail",
  hint: "Optional",
  chipLabel: "Next up · Lantern Grove",
  targetPortalId: "mission-lantern-grove",
  targetPortalLabel: "Lantern Grove",
};

const runtimeFixture = {
  portals: [
    {
      id: "mission-sunrise-trail",
      label: "Sunrise Trail",
      summary: "Warmup",
      statusLabel: "Complete",
      availability: "available",
      entryCue: "open",
      accent: "#22d3ee",
      position: { x: 0, y: 0 },
      missionRoute: "/world-hub/missions/mission-sunrise-trail",
    },
    {
      id: "mission-lantern-grove",
      label: "Lantern Grove",
      summary: "Next",
      statusLabel: "Ready",
      availability: "available",
      entryCue: "suggested",
      accent: "#c084fc",
      position: { x: 0, y: 0 },
      missionRoute: "/world-hub/missions/mission-lantern-grove",
    },
  ],
} as unknown as WorldHubRuntimeInputs;

test("resolveWorldHubNextAdventureReadinessCue returns deterministic fallback while runtime is missing", () => {
  const cue = resolveWorldHubNextAdventureReadinessCue({
    runtime: null,
    homeZoneState: "away",
    recentJourney: recentJourneyReady,
    suggestion: suggestionFixture,
  });

  assert.equal(cue.status, "warming");
  assert.equal(cue.source, "deterministic-fallback");
  assert.equal(cue.targetPortalId, null);
});

test("resolveWorldHubNextAdventureReadinessCue resolves ready state when suggested portal is available with journey momentum", () => {
  const cue = resolveWorldHubNextAdventureReadinessCue({
    runtime: runtimeFixture,
    homeZoneState: "arrived",
    recentJourney: recentJourneyReady,
    suggestion: suggestionFixture,
  });

  assert.equal(cue.status, "ready");
  assert.equal(cue.targetPortalId, "mission-lantern-grove");
  assert.match(cue.chipLabel, /출발 준비 완료/);
});

test("resolveWorldHubNextAdventureReadinessCue resolves warming state when target portal is queued", () => {
  const queuedRuntime = {
    ...runtimeFixture,
    portals: runtimeFixture.portals.map((portal) =>
      portal.id === "mission-lantern-grove"
        ? {
            ...portal,
            availability: "queued",
          }
        : portal,
    ),
  } as unknown as WorldHubRuntimeInputs;

  const cue = resolveWorldHubNextAdventureReadinessCue({
    runtime: queuedRuntime,
    homeZoneState: "approaching",
    recentJourney: recentJourneyReady,
    suggestion: suggestionFixture,
  });

  assert.equal(cue.status, "warming");
  assert.match(cue.markerLabel, /길 준비 중/);
});
