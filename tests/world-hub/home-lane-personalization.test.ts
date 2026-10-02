import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import { parseMetaverseResolvedIdentitySummary } from "@/lib/world-hub/identity/contracts";
import { resolveWorldHubHomeLanePersonalization } from "@/lib/world-hub/runtime/homeLanePersonalization";

const runtimeFixture = {
  homeLane: {
    title: "Porch keepsakes",
    summary: "Fallback keepsakes summary",
    placeholders: [
      { id: "recent", label: "Recent post", kind: "recent-achievement", position: { x: 1, y: 1 } },
      { id: "badge", label: "Badge rail", kind: "badge-display", position: { x: 2, y: 1 } },
      { id: "trophy", label: "Trophy", kind: "trophy-plinth", position: { x: 3, y: 1 } },
      { id: "expansion", label: "Shelf", kind: "collectible-expansion", position: { x: 4, y: 1 } },
    ],
  },
} as unknown as WorldHubRuntimeInputs;

test("resolveWorldHubHomeLanePersonalization returns deterministic fallback when runtime is missing", () => {
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

  const resolved = resolveWorldHubHomeLanePersonalization({
    runtime: null,
    identitySummary: identity,
    homeZoneState: "away",
  });

  assert.equal(resolved.title, "Home lane keepsakes");
  assert.equal(resolved.readyCount, 0);
  assert.equal(resolved.signals.length, 0);
});

test("resolveWorldHubHomeLanePersonalization projects badge and collectible hooks from summary", () => {
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
      collectibleCount: 3,
      inventoryUpdateCount: 1,
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

  const resolved = resolveWorldHubHomeLanePersonalization({
    runtime: runtimeFixture,
    identitySummary: identity,
    homeZoneState: "arrived",
  });

  assert.equal(resolved.readyCount, 4);
  assert.equal(resolved.detail, "4 home markers currently glowing.");
  assert.deepEqual(
    resolved.signals.map((signal) => signal.kind),
    ["recent-achievement", "badge-display", "trophy-plinth", "collectible-expansion"],
  );
  assert.equal(resolved.signals[0]?.projectionValue, "Completed · 100%");
  assert.equal(resolved.signals[1]?.projectionValue, "Forest ribbon · Gold");
  assert.equal(resolved.signals[2]?.projectionValue, "Sunleaf trophy");
});
