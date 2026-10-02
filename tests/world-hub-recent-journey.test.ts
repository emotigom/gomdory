import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorldHubRecentJourneyView } from "@/lib/world-hub/runtime/recentJourney";
import { resolveMetaverseIdentitySummary } from "@/lib/world-hub/identity/adapter";

test("resolveWorldHubRecentJourneyView returns deterministic empty fallback without progress", () => {
  const identitySummary = resolveMetaverseIdentitySummary({
    runtime: null,
    recentMissionResult: null,
    now: new Date("2026-03-26T10:00:00.000Z"),
  });

  const view = resolveWorldHubRecentJourneyView({
    runtime: null,
    identitySummary,
    homeRepeatVisitCue: null,
  });

  assert.equal(view.status, "empty");
  assert.match(view.title, /camp journal/i);
  assert.equal(view.missionLabel, "No recent mission logged yet");
  assert.equal(view.continuityLabel, "Return rhythm starts with your first visit");
});

test("resolveWorldHubRecentJourneyView projects mission and reward labels from resolved summary seams", () => {
  const identitySummary = resolveMetaverseIdentitySummary({
    runtime: {
      progress: {
        recentMissionCompletion: {
          missionId: "mission-owl",
          missionTitle: "Moonlit Owl Trail",
          completedAtIso: "2026-03-26T10:00:00.000Z",
          completionLabel: "Objectives complete",
          objectiveCount: 4,
          completedObjectives: 4,
          percentComplete: 100,
          resultLabel: "Mission complete",
          resultDetail: "You finished the route.",
          rewardSummary: {
            summaryLabel: "Badge placeholder projected",
            summaryDetail: "Projected into profile seam.",
            highlightedRewardLabel: "Owl Night Badge",
            placeholderCount: 1,
            inventoryUpdateCount: 1,
          },
          returnHubPath: "/world-hub",
        },
        persistedCompletion: {
          status: "persisted",
          label: "Moonlit Owl Trail saved",
          detail: "Persisted for next visit.",
        },
        source: {
          kind: "supabase",
          label: "Supabase metaverse progress",
          detail: "Loaded.",
          fallbackReason: null,
          diagnostics: {
            mode: "supabase",
            storageKey: null,
            endpoint: "/world-hub/api/progress",
            userScoped: true,
            readStatus: "succeeded",
            writeStatus: "not-requested",
            syncedAtIso: "2026-03-26T10:00:00.000Z",
          },
        },
      },
    } as never,
    recentMissionResult: null,
    now: new Date("2026-03-26T10:00:00.000Z"),
  });

  const view = resolveWorldHubRecentJourneyView({
    runtime: {
      progress: {
        persistedCompletion: {
          status: "persisted",
          label: "Moonlit Owl Trail saved",
          detail: "Persisted for next visit.",
        },
      },
    } as never,
    identitySummary,
    homeRepeatVisitCue: {
      status: "building",
      eyebrow: "Campfire rhythm",
      label: "3-visit home rhythm",
      detail: "steady",
      chipLabel: "3 visits in a row",
      streakDays: 3,
      totalVisits: 8,
      emphasis: "soft",
    },
  });

  assert.equal(view.status, "ready");
  assert.match(view.missionLabel, /Moonlit Owl Trail/);
  assert.match(view.rewardLabel, /Badge placeholder projected/);
  assert.equal(view.continuityLabel, "3 visits in a row");
  assert.equal(view.chips[1], "8 total visits");
});
