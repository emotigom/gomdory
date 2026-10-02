import assert from "node:assert/strict";
import test from "node:test";

import { resolveMetaverseIdentitySummary } from "@/lib/world-hub/identity/adapter";
import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";
import { createMetaverseProgressSnapshotFromMissionResult } from "@/lib/world-hub/progress/contracts";
import { createWorldHubRuntimeInputs } from "@/lib/world-hub/runtime/runtimeInputs";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";

const loadedManifest = {
  manifest: getDefaultWorldHubManifest(),
  source: {
    kind: "local-default",
    label: "Default manifest",
    detail: null,
    fallbackReason: null,
  },
  loadedAtIso: "2026-03-24T12:00:00.000Z",
} as const;

function createRuntime() {
  return createWorldHubRuntimeInputs({
    loadedManifest,
    bootstrap: {
      requestedMode: "local-single-user",
      bootstrap: {
        mode: "local-single-user",
        authority: "local-preview",
        sessionId: "session-1",
        shardLabel: "local",
        occupancy: 1,
        reactionsEnabled: true,
        nearbyPeers: [],
        metadata: {
          runtimeVersion: "test",
          capabilityHints: [],
          policySnapshotVersion: "test",
        },
        presenceSnapshot: null,
      },
      source: {
        kind: "local-preview",
        label: "Local preview",
        detail: "Test",
        fallbackReason: null,
      },
    },
    policy: {
      entry: {
        allowed: true,
        label: "Allowed",
        detail: "Allowed in tests",
      },
      missions: [],
      source: {
        kind: "local-preview",
        label: "Local policy",
        detail: "test",
        fallbackReason: null,
      },
    },
    session: {
      scope: "world-hub",
      runtimeId: "session-1",
      runtimeAuthority: "local-preview",
      metadata: {
        runtimeVersion: "test",
        capabilityHints: [],
        policySnapshotVersion: "test",
      },
      projectionId: "projection-1",
      projectedAtIso: "2026-03-24T12:00:00.000Z",
    },
    presenceSubscription: {
      mode: "local-noop",
      source: "local-fallback",
      peers: [],
      receivedAtIso: "2026-03-24T12:00:00.000Z",
    },
    assets: {
      worldId: "starter-world-hub",
      source: {
        kind: "local-fallback",
        label: "Local asset fallback",
        detail: "test",
        fallbackReason: null,
      },
      manifest: {
        worldId: "starter-world-hub",
        assets: [],
      },
      resolvedAtIso: "2026-03-24T12:00:00.000Z",
    },
    sceneLoading: {
      worldId: "starter-world-hub",
      stage: "fallback",
      summaryLabel: "Fallback",
      detail: "test",
      assets: {
        hubScene: { availability: "missing", reason: "test", href: null, sourceLabel: "test" },
        hubPreviewImage: { availability: "missing", reason: "test", href: null, sourceLabel: "test" },
        portalPreviewImage: { availability: "missing", reason: "test", href: null, sourceLabel: "test" },
        kioskSurface: { availability: "missing", reason: "test", href: null, sourceLabel: "test" },
      },
    },
    progress: createMetaverseProgressSnapshotFromMissionResult({
      payload: {
        version: 1,
        source: "mission-room",
        worldId: "starter-world-hub",
        sessionId: "session-1",
        missionId: "mission-orbit-lab",
        missionTitle: "Sunrise Trail",
        returnHubPath: "/world-hub",
        issuedAtIso: "2026-03-24T12:00:00.000Z",
        completedAtIso: "2026-03-24T11:59:00.000Z",
        outcome: { status: "completed", label: "Complete" },
        summary: {
          completionLabel: "3/3 complete",
          objectiveCount: 3,
          completedObjectives: 3,
          percentComplete: 100,
          resultLabel: "Trail complete",
          resultDetail: "Complete",
        },
        rewards: {
          status: "placeholder",
          summaryLabel: "1 reward",
          summaryDetail: "placeholder",
          highlightedRewardLabel: "Kindling badge",
          placeholderCount: 1,
          inventoryUpdateCount: 0,
          sourceLabel: "local",
          fallbackLabel: "local",
        },
        integrations: {
          rewardHook: "deterministic-local-placeholder",
          persistence: "persisted",
          reporting: "not-connected",
        },
      },
      persistenceStatus: "persisted",
      source: {
        kind: "local-storage-fallback",
        label: "Local fallback",
        detail: "test",
        fallbackReason: null,
        diagnostics: {
          mode: "local-fallback",
          storageKey: "test",
          endpoint: null,
          userScoped: false,
          readStatus: "succeeded",
          writeStatus: "succeeded",
          syncedAtIso: "2026-03-24T12:00:00.000Z",
        },
      },
    }),
    launchControls: {
      source: {
        kind: "local-preview",
        label: "Local",
        detail: "test",
        fallbackReason: null,
      },
      loadedAtIso: "2026-03-24T12:00:00.000Z",
      context: {
        classId: null,
        worldId: "starter-world-hub",
        sessionId: "session-1",
      },
      launches: [],
      missionOverrides: [],
    },
  });
}

const recentMissionResult: WorldHubMissionResultReturnEnvelope = {
  payload: {
    version: 1,
    source: "mission-room",
    worldId: "starter-world-hub",
    sessionId: "session-1",
    missionId: "mission-comet-run",
    missionTitle: "Comet Run",
    returnHubPath: "/world-hub",
    issuedAtIso: "2026-03-24T12:00:00.000Z",
    completedAtIso: "2026-03-24T11:58:00.000Z",
    outcome: {
      status: "completed",
      label: "Complete",
    },
    summary: {
      completionLabel: "4/4 complete",
      objectiveCount: 4,
      completedObjectives: 4,
      percentComplete: 100,
      resultLabel: "Comet done",
      resultDetail: "Done",
    },
    rewards: {
      status: "placeholder",
      summaryLabel: "2 rewards",
      summaryDetail: "Projection",
      highlightedRewardLabel: "Comet badge",
      placeholderCount: 2,
      inventoryUpdateCount: 1,
      sourceLabel: "local",
      fallbackLabel: "local",
    },
    integrations: {
      rewardHook: "deterministic-local-placeholder",
      persistence: "persisted",
      reporting: "not-connected",
    },
  },
  freshness: {
    status: "recent",
    ageMs: 500,
    maxAgeMs: 1000 * 60,
  },
  ack: {
    title: "Comet Run complete",
    detail: "Projection",
    completionLabel: "4/4 complete · 100%",
    rewardLabel: "2 rewards · Comet badge",
    integrationLabel: "Saved",
  },
};

test("identity adapter projects recent mission result into stable profile/inventory summary contracts", () => {
  const summary = resolveMetaverseIdentitySummary({
    runtime: createRuntime(),
    recentMissionResult,
    now: new Date("2026-03-24T12:00:05.000Z"),
  });

  assert.equal(summary.profile.lastMissionId, "mission-comet-run");
  assert.equal(summary.profile.rewardLabel, "2 rewards · Comet badge");
  assert.equal(summary.collectible.collectibleCount, 2);
  assert.equal(summary.source.diagnostics.derivedFrom, "recent-mission-result");
  assert.equal(summary.fallback.mode, "authoritative-hybrid");
});

test("identity adapter returns deterministic fallback when runtime and mission result are unavailable", () => {
  const summary = resolveMetaverseIdentitySummary({
    runtime: null,
    recentMissionResult: null,
    now: new Date("2026-03-24T12:00:05.000Z"),
  });

  assert.equal(summary.profile.status, "empty");
  assert.equal(summary.collectible.status, "empty");
  assert.equal(summary.source.kind, "deterministic-local");
  assert.equal(summary.fallback.reason, "progress-unavailable");
});
