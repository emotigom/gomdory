import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorldHubHomeAnchorAcknowledgement } from "@/lib/world-hub/runtime/homeAnchorAcknowledgement";
import { createMetaverseProgressSnapshotFromMissionResult } from "@/lib/world-hub/progress/contracts";
import type { WorldHubMissionResultReturnEnvelope, WorldHubMissionResultReturnPayload } from "@/lib/world-hub/mission/resultHandoff";

function createPayload(): WorldHubMissionResultReturnPayload {
  return {
    version: 1,
    source: "mission-room",
    worldId: "starter-world-hub",
    sessionId: "hub-session-1",
    missionId: "mission-orbit-lab",
    missionTitle: "Orbit Lab",
    returnHubPath: "/world-hub",
    issuedAtIso: "2026-03-23T10:00:00.000Z",
    completedAtIso: "2026-03-23T09:59:00.000Z",
    outcome: {
      status: "completed",
      label: "Complete",
    },
    summary: {
      completionLabel: "3/3 objectives complete",
      objectiveCount: 3,
      completedObjectives: 3,
      percentComplete: 100,
      resultLabel: "Trail complete",
      resultDetail: "The trail was cleared.",
    },
    rewards: {
      status: "placeholder",
      summaryLabel: "2 reward placeholders ready",
      summaryDetail: "Placeholder rewards are waiting.",
      highlightedRewardLabel: "Forest badge",
      placeholderCount: 2,
      inventoryUpdateCount: 1,
      sourceLabel: "Deterministic local reward hook",
      fallbackLabel: "Preview-safe reward resolution active",
    },
    integrations: {
      rewardHook: "deterministic-local-placeholder",
      persistence: "persisted",
      reporting: "not-connected",
    },
  };
}

test("persisted progress snapshots keep a home-anchor acknowledgement summary", () => {
  const snapshot = createMetaverseProgressSnapshotFromMissionResult({
    payload: createPayload(),
    persistenceStatus: "persisted",
    source: {
      kind: "supabase",
      label: "Supabase metaverse progress",
      detail: "Loaded persisted metaverse completion snapshot.",
      fallbackReason: null,
      diagnostics: {
        mode: "supabase",
        storageKey: null,
        endpoint: "/world-hub/api/progress",
        userScoped: true,
        readStatus: "succeeded",
        writeStatus: "succeeded",
        syncedAtIso: "2026-03-23T10:00:01.000Z",
      },
    },
  });

  assert.equal(snapshot.homeAcknowledgement?.title, "Orbit Lab made it home");
  assert.equal(snapshot.homeAcknowledgement?.rewardLabel, "2 reward placeholders ready · Forest badge");
  assert.match(snapshot.homeAcknowledgement?.detail ?? "", /Basecamp tucked away your return/);
});

test("home-anchor acknowledgement prefers a recent mission return until it has been seen", () => {
  const payload = createPayload();
  const recentMissionResult: WorldHubMissionResultReturnEnvelope = {
    payload,
    freshness: {
      status: "recent",
      ageMs: 100,
      maxAgeMs: 1000,
    },
    ack: {
      title: "Orbit Lab complete",
      detail: "Placeholder rewards are waiting.",
      completionLabel: "3/3 objectives complete · 100%",
      rewardLabel: "2 reward placeholders ready · Forest badge",
      integrationLabel: "Progress saved. Preview-safe reward resolution active remains a replaceable seam.",
    },
  };
  const progress = createMetaverseProgressSnapshotFromMissionResult({
    payload,
    persistenceStatus: "persisted",
    source: {
      kind: "supabase",
      label: "Supabase metaverse progress",
      detail: "Loaded persisted metaverse completion snapshot.",
      fallbackReason: null,
      diagnostics: {
        mode: "supabase",
        storageKey: null,
        endpoint: "/world-hub/api/progress",
        userScoped: true,
        readStatus: "succeeded",
        writeStatus: "succeeded",
        syncedAtIso: "2026-03-23T10:00:01.000Z",
      },
    },
  });

  const freshAck = resolveWorldHubHomeAnchorAcknowledgement({
    progress,
    recentMissionResult,
    hasBeenSeen: false,
  });
  assert.equal(freshAck?.origin, "recent-return");
  assert.equal(freshAck?.emphasis, "fresh");
  assert.equal(freshAck?.rewardLabel, "2 reward placeholders ready · Forest badge");

  const settledAck = resolveWorldHubHomeAnchorAcknowledgement({
    progress,
    recentMissionResult: null,
    hasBeenSeen: true,
  });
  assert.equal(settledAck?.origin, "persisted-progress");
  assert.equal(settledAck?.emphasis, "settled");
  assert.equal(settledAck?.statusLabel, "Orbit Lab saved");
});
