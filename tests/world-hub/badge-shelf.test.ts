import assert from "node:assert/strict";
import test from "node:test";

import { parseMetaverseResolvedIdentitySummary } from "@/lib/world-hub/identity/contracts";
import { resolveWorldHubBadgeShelf } from "@/lib/world-hub/runtime/badgeShelf";

test("badge shelf resolves deterministic empty state when identity has no mission progress", () => {
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

  const shelf = resolveWorldHubBadgeShelf({
    identitySummary: identity,
    acknowledgement: null,
  });

  assert.equal(shelf.recentlyUpdated, false);
  assert.equal(shelf.statusLabel, "Empty shelf · deterministic fallback");
  assert.equal(shelf.slots.filter((slot) => slot.state === "locked").length, 3);
});

test("badge shelf resolves partial state from projected identity summary", () => {
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
      collectibleCount: 1,
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

  const shelf = resolveWorldHubBadgeShelf({
    identitySummary: identity,
    acknowledgement: null,
  });

  assert.equal(shelf.statusLabel, "Partially filled");
  assert.equal(shelf.slots.filter((slot) => slot.state === "filled").length, 2);
  assert.equal(shelf.slots.filter((slot) => slot.state === "locked").length, 1);
});

test("badge shelf marks state as recently updated when latest return is fresh", () => {
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
      inventoryUpdateCount: 1,
    },
    source: {
      kind: "resolved-metaverse-summary",
      label: "projection",
      detail: "projection",
      diagnostics: {
        deterministic: false,
        derivedFrom: "recent-mission-result",
        progressSourceKind: "supabase",
        rewardSourceKind: "mission-result",
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

  const shelf = resolveWorldHubBadgeShelf({
    identitySummary: identity,
    acknowledgement: {
      origin: "recent-return",
      emphasis: "fresh",
      eyebrow: "Welcome home",
      title: "Comet Run checked in",
      detail: "Basecamp tucked away your return and keepsakes.",
      statusLabel: "Comet Run complete",
      completionLabel: "4/4 complete · 100%",
      rewardLabel: "2 rewards · Comet badge",
    },
  });

  assert.equal(shelf.recentlyUpdated, true);
  assert.equal(shelf.statusLabel, "Recently updated from your latest return");
  assert.equal(shelf.slots.filter((slot) => slot.state === "recent").length, 1);
});
