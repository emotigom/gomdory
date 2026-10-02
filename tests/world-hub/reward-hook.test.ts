import assert from "node:assert/strict";
import test from "node:test";

import { resolveDeterministicMissionRewardSummary } from "@/lib/world-hub/rewards/localRewardHook";

test("deterministic reward hook resolves stable placeholder summary for completed missions", () => {
  const reward = resolveDeterministicMissionRewardSummary({
    missionId: "mission-orbit-lab",
    missionTitle: "Orbit Lab",
    returnLabel: "Return to world hub",
    routeMode: "validated-handoff",
    runtimeAuthority: "local-preview",
    completion: {
      status: "completed",
      resultKind: "preview",
      completedAtIso: "2026-03-21T00:00:30.000Z",
      objectiveCount: 3,
      completedObjectives: 3,
      percentComplete: 100,
    },
    now: new Date("2026-03-21T00:00:30.000Z"),
  });

  assert.equal(reward.status, "placeholder");
  assert.equal(reward.summary.placeholderCount, 3);
  assert.equal(reward.summary.inventoryUpdateCount, 2);
  assert.equal(reward.source.kind, "deterministic-local");
  assert.equal(reward.fallback.mode, "deterministic-local");
});

test("deterministic reward hook preserves pending fallback behavior before completion", () => {
  const reward = resolveDeterministicMissionRewardSummary({
    missionId: "mission-creative-arcade",
    missionTitle: "Creative Arcade",
    returnLabel: "Return to world hub",
    routeMode: "local-fallback",
    runtimeAuthority: "edge-worker",
    completion: {
      status: "pending",
      resultKind: "validated-placeholder",
      completedAtIso: null,
      objectiveCount: 3,
      completedObjectives: 1,
      percentComplete: 33.33,
    },
    now: new Date("2026-03-21T00:00:10.000Z"),
  });

  assert.equal(reward.status, "pending");
  assert.equal(reward.summary.label, "Reward summary pending mission completion");
  assert.equal(reward.fallback.reason, "service-not-configured");
  assert.match(reward.fallback.detail, /deterministic/);
});
