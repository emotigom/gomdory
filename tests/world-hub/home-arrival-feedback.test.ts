import assert from "node:assert/strict";
import test from "node:test";

import {
  createWarmReturnFeedback,
  resolveWorldHubHomeZoneState,
} from "@/lib/world-hub/runtime/homeArrivalFeedback";
import type { WorldHubMissionResultReturnEnvelope } from "@/lib/world-hub/mission/resultHandoff";

test("resolveWorldHubHomeZoneState detects arriving and approaching around spawn or campfire", () => {
  assert.equal(
    resolveWorldHubHomeZoneState({
      playerPosition: { x: 22, y: 52 },
      spawnPosition: { x: 22, y: 52 },
      kioskPosition: { x: 28, y: 30 },
    }),
    "arrived",
  );

  assert.equal(
    resolveWorldHubHomeZoneState({
      playerPosition: { x: 28, y: 43 },
      spawnPosition: { x: 22, y: 52 },
      kioskPosition: { x: 28, y: 30 },
    }),
    "approaching",
  );

  assert.equal(
    resolveWorldHubHomeZoneState({
      playerPosition: { x: 70, y: 70 },
      spawnPosition: { x: 22, y: 52 },
      kioskPosition: { x: 28, y: 30 },
    }),
    "away",
  );
});

test("createWarmReturnFeedback keeps return copy warm while reflecting persistence state", () => {
  const recentMissionResult: WorldHubMissionResultReturnEnvelope = {
    payload: {
      version: 1,
      source: "mission-room",
      worldId: "starter-world-hub",
      sessionId: "hub-session-1",
      missionId: "mission-orbit-lab",
      missionTitle: "Sunrise Trail",
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
    },
    freshness: {
      status: "recent",
      ageMs: 100,
      maxAgeMs: 1_000,
    },
    ack: {
      title: "Sunrise Trail complete",
      detail: "Placeholder rewards are waiting.",
      completionLabel: "3/3 objectives complete · 100%",
      rewardLabel: "2 reward placeholders ready · Forest badge",
      integrationLabel: "Progress saved.",
    },
  };

  const feedback = createWarmReturnFeedback({ recentMissionResult });
  assert.equal(feedback.kind, "return");
  assert.match(feedback.title, /Sunrise Trail/);
  assert.equal(feedback.chips[0], "3/3 objectives complete · 100%");
  assert.equal(feedback.chips[1], "2 reward placeholders ready · Forest badge");
  assert.match(feedback.detail, /캠프에 안전하게 담겼어요/);
});
