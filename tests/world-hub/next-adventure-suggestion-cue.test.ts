import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import { parseMetaverseResolvedIdentitySummary } from "@/lib/world-hub/identity/contracts";
import { resolveWorldHubNextAdventureSuggestionCue } from "@/lib/world-hub/runtime/nextAdventureSuggestionCue";
import type { WorldHubRecentJourneyView } from "@/lib/world-hub/runtime/recentJourney";

const recentJourneyFixture: WorldHubRecentJourneyView = {
  status: "ready",
  eyebrow: "Recent journey",
  title: "Sunrise Trail is part of your path",
  detail: "Journey seam",
  missionLabel: "Sunrise Trail · Completed · 100%",
  rewardLabel: "Forest ribbon · Gold",
  continuityLabel: "4 gentle streak",
  chips: ["Saved"],
};

const runtimeFixture = {
  portals: [
    {
      id: "mission-orbit-lab",
      label: "Sunrise Trail",
      summary: "Start here",
      statusLabel: "Ready",
      availability: "available",
      entryCue: "open",
      accent: "#22d3ee",
      position: { x: 0, y: 0 },
      missionRoute: "/world-hub/missions/mission-orbit-lab",
    },
    {
      id: "mission-creative-arcade",
      label: "Lantern Grove",
      summary: "Next",
      statusLabel: "Warming up",
      availability: "queued",
      entryCue: "suggested",
      accent: "#c084fc",
      position: { x: 0, y: 0 },
      missionRoute: "/world-hub/missions/mission-creative-arcade",
    },
  ],
  progress: {
    recentMissionCompletion: {
      missionId: "mission-orbit-lab",
      missionTitle: "Sunrise Trail",
      completedAtIso: "2026-03-25T12:00:00.000Z",
      completionLabel: "Completed",
      objectiveCount: 3,
      completedObjectives: 3,
      percentComplete: 100,
      resultLabel: "Great",
      resultDetail: "Great",
      rewardSummary: {
        summaryLabel: "Forest ribbon",
        summaryDetail: "Reward summary",
        highlightedRewardLabel: "Gold",
        placeholderCount: 0,
        inventoryUpdateCount: 1,
      },
      returnHubPath: "/world-hub",
    },
  },
} as unknown as WorldHubRuntimeInputs;

test("resolveWorldHubNextAdventureSuggestionCue returns deterministic fallback when runtime is unavailable", () => {
  const identity = parseMetaverseResolvedIdentitySummary({
    profile: {
      status: "empty",
      title: "Pending",
      detail: "Pending",
      hasCompletedMission: false,
      hasRecentReward: false,
    },
    collectible: {
      status: "empty",
      summaryLabel: "None",
      summaryDetail: "None",
      collectibleCount: 0,
      inventoryUpdateCount: 0,
    },
    source: {
      kind: "deterministic-local",
      label: "local",
      detail: "fallback",
      diagnostics: {
        deterministic: true,
        derivedFrom: "deterministic-local-fallback",
        progressSourceKind: "unavailable",
        rewardSourceKind: "none",
        resolvedAtIso: "2026-03-25T12:00:00.000Z",
      },
    },
    fallback: {
      mode: "deterministic-local",
      reason: "progress-unavailable",
      label: "fallback",
      detail: "fallback",
    },
  });

  const cue = resolveWorldHubNextAdventureSuggestionCue({
    runtime: null,
    identitySummary: identity,
    recentJourney: recentJourneyFixture,
  });

  assert.equal(cue.status, "idle");
  assert.equal(cue.source, "deterministic-fallback");
  assert.equal(cue.targetPortalId, null);
});

test("resolveWorldHubNextAdventureSuggestionCue projects the next portal from recent mission progress", () => {
  const identity = parseMetaverseResolvedIdentitySummary({
    profile: {
      status: "ready",
      title: "Ready",
      detail: "Ready",
      hasCompletedMission: true,
      hasRecentReward: true,
      lastMissionId: "mission-orbit-lab",
      lastMissionTitle: "Sunrise Trail",
      rewardLabel: "Forest ribbon · Gold",
    },
    collectible: {
      status: "placeholder",
      summaryLabel: "Collectibles",
      summaryDetail: "Projected",
      collectibleCount: 2,
      inventoryUpdateCount: 1,
    },
    source: {
      kind: "resolved-metaverse-summary",
      label: "resolved",
      detail: "resolved",
      diagnostics: {
        deterministic: false,
        derivedFrom: "persisted-progress",
        progressSourceKind: "supabase",
        rewardSourceKind: "progress-snapshot",
        resolvedAtIso: "2026-03-25T12:00:00.000Z",
      },
    },
    fallback: {
      mode: "authoritative-hybrid",
      reason: "not-needed",
      label: "none",
      detail: "none",
    },
  });

  const cue = resolveWorldHubNextAdventureSuggestionCue({
    runtime: runtimeFixture,
    identitySummary: identity,
    recentJourney: recentJourneyFixture,
  });

  assert.equal(cue.status, "suggested");
  assert.equal(cue.targetPortalId, "mission-creative-arcade");
  assert.equal(cue.targetPortalLabel, "Lantern Grove");
  assert.match(cue.detail, /After Sunrise Trail/);
});
