import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import { parseMetaverseResolvedIdentitySummary } from "@/lib/world-hub/identity/contracts";
import { resolveWorldHubHomeReturnMemoryMarkerState } from "@/lib/world-hub/runtime/homeReturnMemoryMarkers";
import type { WorldHubRecentJourneyView } from "@/lib/world-hub/runtime/recentJourney";

const runtimeFixture = {
  spawn: {
    position: { x: 42, y: 18 },
  },
} as unknown as WorldHubRuntimeInputs;

const emptyJourney: WorldHubRecentJourneyView = {
  status: "empty",
  eyebrow: "Recent journey",
  title: "No recent journey yet",
  detail: "Pending",
  missionLabel: "No recent mission logged yet",
  rewardLabel: "Reward placeholder shelf is ready",
  continuityLabel: "Return rhythm starts with your first visit",
  chips: ["fallback"],
};

test("resolveWorldHubHomeReturnMemoryMarkerState returns deterministic fallback without runtime", () => {
  const identity = parseMetaverseResolvedIdentitySummary({
    profile: {
      status: "empty",
      title: "Identity pending",
      detail: "Pending",
      hasCompletedMission: false,
      hasRecentReward: false,
    },
    collectible: {
      status: "empty",
      summaryLabel: "No collectibles",
      summaryDetail: "Pending",
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
        resolvedAtIso: "2026-03-24T00:00:00.000Z",
      },
    },
    fallback: {
      mode: "deterministic-local",
      reason: "progress-unavailable",
      label: "fallback",
      detail: "fallback",
    },
  });

  const resolved = resolveWorldHubHomeReturnMemoryMarkerState({
    runtime: null,
    identitySummary: identity,
    recentJourney: emptyJourney,
    homeRepeatVisitCue: null,
  });

  assert.equal(resolved.source, "deterministic-fallback");
  assert.equal(resolved.activeCount, 0);
  assert.equal(resolved.markers.length, 0);
});

test("resolveWorldHubHomeReturnMemoryMarkerState resolves cumulative active markers from journey continuity", () => {
  const identity = parseMetaverseResolvedIdentitySummary({
    profile: {
      status: "ready",
      title: "Mission complete",
      detail: "Projected",
      hasCompletedMission: true,
      hasRecentReward: true,
      completionLabel: "Completed · 100%",
      rewardLabel: "Forest ribbon · Gold",
    },
    collectible: {
      status: "placeholder",
      summaryLabel: "Collectibles",
      summaryDetail: "Projected",
      highlightedCollectibleLabel: "Sunleaf trophy",
      collectibleCount: 2,
      inventoryUpdateCount: 0,
    },
    source: {
      kind: "resolved-metaverse-summary",
      label: "projection",
      detail: "projection",
      diagnostics: {
        deterministic: false,
        derivedFrom: "persisted-progress",
        progressSourceKind: "supabase",
        rewardSourceKind: "progress-snapshot",
        resolvedAtIso: "2026-03-24T00:00:00.000Z",
      },
    },
    fallback: {
      mode: "authoritative-hybrid",
      reason: "not-needed",
      label: "none",
      detail: "none",
    },
  });

  const resolved = resolveWorldHubHomeReturnMemoryMarkerState({
    runtime: runtimeFixture,
    identitySummary: identity,
    recentJourney: {
      ...emptyJourney,
      status: "ready",
      missionLabel: "Moonlit Trail · Completed · 100%",
      rewardLabel: "Forest ribbon · Gold",
    },
    homeRepeatVisitCue: {
      status: "steady",
      eyebrow: "Campfire rhythm",
      label: "6-visit warm streak",
      detail: "Warm streak",
      chipLabel: "6 gentle streak",
      streakDays: 6,
      totalVisits: 9,
      emphasis: "warm",
    },
  });

  assert.equal(resolved.source, "resolved-runtime");
  assert.equal(resolved.markers.length, 3);
  assert.equal(resolved.activeCount, 3);
  assert.equal(resolved.markers[0]?.tone, "warm");
  assert.match(resolved.detail, /currently settled near your porch/);
});
