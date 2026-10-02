import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";
import { resolveWorldHubAcademyHomeCooldownCues } from "@/lib/world-hub/runtime/academyHomeCooldownCues";

const runtimeFixture = {
  spawn: {
    position: { x: 24, y: 56 },
  },
  kiosk: {
    position: { x: 31, y: 26 },
  },
  session: {
    occupancy: 5,
  },
  presence: {
    nearbyPeers: [],
  },
  progress: {
    recentMissionCompletion: {
      missionTitle: "Forest Relay",
      completedAtIso: "2026-03-26T09:24:00.000Z",
      completionLabel: "4/4 checkpoints",
    },
  },
  liveSession: {
    status: "self-paced-open",
    cueState: "none",
  },
} as unknown as WorldHubRuntimeInputs;

const recentMissionResultFixture: WorldHubMissionResultReturnEnvelope = {
  payload: {
    version: 1,
    source: "mission-room",
    worldId: "starter-world-hub",
    sessionId: "hub-session-1",
    missionId: "mission-forest-relay",
    missionTitle: "Forest Relay",
    returnHubPath: "/world-hub",
    issuedAtIso: "2026-03-26T09:24:00.000Z",
    completedAtIso: "2026-03-26T09:24:00.000Z",
    outcome: {
      status: "completed",
      label: "completed",
    },
    summary: {
      completionLabel: "4/4 checkpoints",
      objectiveCount: 4,
      completedObjectives: 4,
      percentComplete: 100,
      resultLabel: "result",
      resultDetail: "detail",
    },
    rewards: {
      status: "placeholder",
      summaryLabel: "placeholder",
      summaryDetail: "placeholder",
      highlightedRewardLabel: "badge",
      placeholderCount: 1,
      inventoryUpdateCount: 1,
      sourceLabel: "source",
      fallbackLabel: "fallback",
    },
    integrations: {
      rewardHook: "deterministic-local-placeholder",
      persistence: "persisted",
      reporting: "not-connected",
    },
  },
  freshness: {
    status: "recent",
    ageMs: 150,
    maxAgeMs: 1000,
  },
  ack: {
    title: "title",
    detail: "detail",
    completionLabel: "4/4 checkpoints",
    rewardLabel: "reward",
    integrationLabel: "saved",
  },
};

test("resolveWorldHubAcademyHomeCooldownCues returns deterministic fallback for missing runtime", () => {
  const resolved = resolveWorldHubAcademyHomeCooldownCues({
    runtime: null,
    recentMissionResult: recentMissionResultFixture,
    now: new Date("2026-03-26T09:31:00.000Z"),
  });

  assert.deepEqual(resolved, { cues: [], summary: null });
});

test("resolveWorldHubAcademyHomeCooldownCues projects a calm return lane after wrap-up begins to settle", () => {
  const resolved = resolveWorldHubAcademyHomeCooldownCues({
    runtime: runtimeFixture,
    recentMissionResult: recentMissionResultFixture,
    now: new Date("2026-03-26T09:31:00.000Z"),
  });

  assert.equal(resolved.cues.length, 3);
  assert.equal(resolved.cues[0]?.placement, "academy-footbridge");
  assert.equal(resolved.cues[1]?.kind, "footstep-trail");
  assert.equal(resolved.cues[2]?.placement, "home-lane-entry");
  assert.equal(resolved.cues[0]?.tone, "soft");
  assert.match(resolved.summary?.title ?? "", /returning home/i);
});

test("resolveWorldHubAcademyHomeCooldownCues stays hidden if class guidance is active", () => {
  const resolved = resolveWorldHubAcademyHomeCooldownCues({
    runtime: {
      ...runtimeFixture,
      liveSession: {
        status: "teacher-guided",
        cueState: "gather_at_plaza",
      },
    } as unknown as WorldHubRuntimeInputs,
    recentMissionResult: recentMissionResultFixture,
    now: new Date("2026-03-26T09:31:00.000Z"),
  });

  assert.deepEqual(resolved, { cues: [], summary: null });
});
