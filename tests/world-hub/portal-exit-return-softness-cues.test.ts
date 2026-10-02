import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";
import { resolveWorldHubPortalExitReturnSoftnessCues } from "@/lib/world-hub/runtime/portalExitReturnSoftnessCues";

const runtimeFixture = {
  spawn: {
    position: { x: 24, y: 56 },
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

test("resolveWorldHubPortalExitReturnSoftnessCues stays deterministic when runtime or result is missing", () => {
  assert.deepEqual(
    resolveWorldHubPortalExitReturnSoftnessCues({
      runtime: null,
      recentMissionResult: recentMissionResultFixture,
      now: new Date("2026-03-26T09:24:20.000Z"),
    }),
    { cues: [], summary: null },
  );

  assert.deepEqual(
    resolveWorldHubPortalExitReturnSoftnessCues({
      runtime: runtimeFixture,
      recentMissionResult: null,
      now: new Date("2026-03-26T09:24:20.000Z"),
    }),
    { cues: [], summary: null },
  );
});

test("resolveWorldHubPortalExitReturnSoftnessCues provides a soft return landing right after mission return", () => {
  const resolved = resolveWorldHubPortalExitReturnSoftnessCues({
    runtime: runtimeFixture,
    recentMissionResult: recentMissionResultFixture,
    now: new Date("2026-03-26T09:24:22.000Z"),
  });

  assert.equal(resolved.cues.length, 2);
  assert.equal(resolved.cues[0]?.placement, "portal-threshold");
  assert.equal(resolved.cues[1]?.kind, "settle-lantern");
  assert.equal(resolved.cues[0]?.tone, "soft");
  assert.match(resolved.summary?.title ?? "", /부드럽게 착지/);
});

test("resolveWorldHubPortalExitReturnSoftnessCues yields to active mission launch cues", () => {
  const resolved = resolveWorldHubPortalExitReturnSoftnessCues({
    runtime: {
      ...runtimeFixture,
      liveSession: {
        status: "mission-starting-soon",
        cueState: "start_mission",
      },
    } as WorldHubRuntimeInputs,
    recentMissionResult: recentMissionResultFixture,
    now: new Date("2026-03-26T09:24:20.000Z"),
  });

  assert.deepEqual(resolved, { cues: [], summary: null });
});
