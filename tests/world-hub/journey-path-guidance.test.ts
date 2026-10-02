import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import { resolveWorldHubJourneyPathGuidance } from "@/lib/world-hub/runtime/journeyPathGuidance";
import type { WorldHubNextAdventureReadinessCue } from "@/lib/world-hub/runtime/nextAdventureReadinessCue";
import type { WorldHubNextAdventureSuggestionCue } from "@/lib/world-hub/runtime/nextAdventureSuggestionCue";

const runtimeFixture = {
  spawn: { position: { x: 22, y: 52 } },
  portals: [
    {
      id: "mission-sunrise-trail",
      label: "Sunrise Trail",
      summary: "Warmup",
      statusLabel: "Open",
      availability: "available",
      entryCue: "open",
      accent: "#22d3ee",
      position: { x: 60, y: 40 },
      missionRoute: "/world-hub/missions/mission-sunrise-trail",
    },
    {
      id: "mission-lantern-ridge",
      label: "Lantern Ridge",
      summary: "Next",
      statusLabel: "Suggested",
      availability: "available",
      entryCue: "suggested",
      accent: "#34d399",
      position: { x: 72, y: 30 },
      missionRoute: "/world-hub/missions/mission-lantern-ridge",
    },
  ],
} as unknown as WorldHubRuntimeInputs;

const suggestedCue: WorldHubNextAdventureSuggestionCue = {
  status: "suggested",
  source: "resolved-runtime",
  eyebrow: "Next trail",
  title: "Lantern Ridge is a gentle next step",
  detail: "After your last mission",
  hint: "Optional",
  chipLabel: "Next up · Lantern Ridge",
  targetPortalId: "mission-lantern-ridge",
  targetPortalLabel: "Lantern Ridge",
};

const readyCue: WorldHubNextAdventureReadinessCue = {
  status: "ready",
  source: "resolved-runtime",
  eyebrow: "Home readiness",
  title: "Lantern Ridge is ready when you are",
  detail: "Ready",
  chipLabel: "Ready · Lantern Ridge",
  markerLabel: "Ready",
  accent: "#34d399",
  targetPortalId: "mission-lantern-ridge",
  targetPortalLabel: "Lantern Ridge",
};

test("resolveWorldHubJourneyPathGuidance returns deterministic fallback while runtime is missing", () => {
  const guidance = resolveWorldHubJourneyPathGuidance({
    runtime: null,
    suggestion: suggestedCue,
    readiness: readyCue,
    homeZoneState: "away",
  });

  assert.equal(guidance.status, "resting");
  assert.equal(guidance.source, "deterministic-fallback");
  assert.equal(guidance.trailProgress.length, 0);
});

test("resolveWorldHubJourneyPathGuidance resolves active path when readiness is ready", () => {
  const guidance = resolveWorldHubJourneyPathGuidance({
    runtime: runtimeFixture,
    suggestion: suggestedCue,
    readiness: readyCue,
    homeZoneState: "arrived",
  });

  assert.equal(guidance.status, "active");
  assert.equal(guidance.targetPortalId, "mission-lantern-ridge");
  assert.equal(guidance.trailProgress.length, 5);
  assert.match(guidance.chipLabel, /길 밝힘/);
});

test("resolveWorldHubJourneyPathGuidance resolves suggested path when readiness is warming", () => {
  const warmingReadiness: WorldHubNextAdventureReadinessCue = {
    ...readyCue,
    status: "warming",
    chipLabel: "Warming · Lantern Ridge",
  };

  const guidance = resolveWorldHubJourneyPathGuidance({
    runtime: runtimeFixture,
    suggestion: suggestedCue,
    readiness: warmingReadiness,
    homeZoneState: "approaching",
  });

  assert.equal(guidance.status, "suggested");
  assert.match(guidance.title, /은은하게 안내/);
  assert.ok(guidance.trailProgress.every((point) => point > 0.1 && point < 0.95));
});
