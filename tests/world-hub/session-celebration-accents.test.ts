import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";
import { resolveWorldHubSessionCelebrationAccents } from "@/lib/world-hub/runtime/sessionCelebrationAccents";

const runtimeFixture = {
  spawn: {
    position: { x: 24, y: 56 },
  },
  kiosk: {
    position: { x: 31, y: 26 },
  },
  session: {
    occupancy: 7,
  },
  presence: {
    nearbyPeers: [],
  },
  progress: {
    recentMissionCompletion: {
      missionTitle: "River Run",
      completedAtIso: "2026-03-24T09:20:00.000Z",
      completionLabel: "3/3 objectives complete",
    },
  },
  liveSession: {
    cueState: "prepare_at_academy",
  },
} as unknown as WorldHubRuntimeInputs;

const recentMissionResultFixture: WorldHubMissionResultReturnEnvelope = {
  payload: {
    version: 1,
    source: "mission-room",
    worldId: "starter-world-hub",
    sessionId: "hub-session-1",
    missionId: "mission-river-run",
    missionTitle: "River Run",
    returnHubPath: "/world-hub",
    issuedAtIso: "2026-03-24T09:20:00.000Z",
    completedAtIso: "2026-03-24T09:18:00.000Z",
    outcome: {
      status: "completed",
      label: "completed",
    },
    summary: {
      completionLabel: "3/3 objectives complete",
      objectiveCount: 3,
      completedObjectives: 3,
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
    ageMs: 100,
    maxAgeMs: 1000,
  },
  ack: {
    title: "title",
    detail: "detail",
    completionLabel: "3/3 objectives complete",
    rewardLabel: "reward",
    integrationLabel: "saved",
  },
};

test("resolveWorldHubSessionCelebrationAccents returns deterministic fallback for missing runtime", () => {
  const resolved = resolveWorldHubSessionCelebrationAccents({
    runtime: null,
    recentMissionResult: recentMissionResultFixture,
    now: new Date("2026-03-24T09:24:00.000Z"),
  });

  assert.deepEqual(resolved, { accents: [], summary: null });
});

test("resolveWorldHubSessionCelebrationAccents projects short-lived academy and plaza accents", () => {
  const resolved = resolveWorldHubSessionCelebrationAccents({
    runtime: runtimeFixture,
    recentMissionResult: recentMissionResultFixture,
    now: new Date("2026-03-24T09:24:00.000Z"),
  });

  assert.equal(resolved.accents.length, 2);
  assert.equal(resolved.accents[0]?.placement, "central-plaza");
  assert.equal(resolved.accents[0]?.tone, "warm");
  assert.equal(resolved.accents[1]?.placement, "academy-lodge");
  assert.equal(resolved.accents[1]?.tone, "warm");
  assert.match(resolved.summary?.title ?? "", /softly celebrating/);
  assert.match(resolved.summary?.detail ?? "", /7 learners recently completed River Run/);
});

test("resolveWorldHubSessionCelebrationAccents fades out stale completions", () => {
  const resolved = resolveWorldHubSessionCelebrationAccents({
    runtime: runtimeFixture,
    recentMissionResult: recentMissionResultFixture,
    now: new Date("2026-03-24T10:10:00.000Z"),
  });

  assert.deepEqual(resolved, { accents: [], summary: null });
});
