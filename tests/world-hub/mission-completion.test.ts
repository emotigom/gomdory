import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDeterministicLocalMissionGameplayState,
  advanceDeterministicLocalMissionGameplayState,
} from "@/lib/world-hub/mission/gameplay/localProgression";
import { resolveDeterministicLocalMissionCompletionResult } from "@/lib/world-hub/mission/completion/localCompletion";

test("deterministic mission completion seam exposes a stable pending result shape", () => {
  const gameplay = resolveDeterministicLocalMissionGameplayState({
    missionId: "mission-orbit-lab",
    title: "Orbit Lab",
    objectiveLabel: "Align the console array to restore the classroom beacon.",
    environmentLabel: "Orbital relay deck",
    roomLabel: "Orbit Lab Local Room",
    routeMode: "validated-handoff",
    bootstrapObjectiveState: "briefing",
    policyStatus: "allowed",
    sessionRuntimeAuthority: "local-preview",
    now: new Date("2026-03-21T00:00:00.000Z"),
  });

  const completion = resolveDeterministicLocalMissionCompletionResult({
    routeMode: "validated-handoff",
    missionId: "mission-orbit-lab",
    title: "Orbit Lab",
    returnHubPath: "/world-hub",
    returnLabel: "Return to world hub",
    runtimeAuthority: "local-preview",
    gameplay,
    now: new Date("2026-03-21T00:00:00.000Z"),
  });

  assert.equal(completion.outcome.status, "pending");
  assert.equal(completion.result.kind, "validated-placeholder");
  assert.equal(completion.rewards.status, "pending");
  assert.equal(completion.rewards.placeholders.length, 3);
  assert.equal(completion.rewards.summary.status, "pending");
  assert.equal(completion.rewards.summary.summary.placeholderCount, 3);
  assert.equal(completion.source.diagnostics.lastEvent, "initialized");
});

test("deterministic mission completion seam resolves terminal placeholder data after local completion", () => {
  const initial = resolveDeterministicLocalMissionGameplayState({
    missionId: "mission-creative-arcade",
    title: "Creative Arcade",
    objectiveLabel: "Review mission-specific rules, then wait for richer edge-backed room behavior.",
    environmentLabel: "Arcade test chamber",
    roomLabel: "Creative Arcade Worker Room",
    routeMode: "local-fallback",
    bootstrapObjectiveState: "queued",
    policyStatus: "allowed",
    sessionRuntimeAuthority: "edge-worker",
    now: new Date("2026-03-21T00:00:00.000Z"),
  });

  const afterFirstAdvance = advanceDeterministicLocalMissionGameplayState({
    current: initial,
    loadedSceneConfig: {
      config: {
        missionId: "mission-creative-arcade",
        title: "Creative Arcade",
        objectiveLabel: "Review mission-specific rules, then wait for richer edge-backed room behavior.",
        environmentLabel: "Arcade test chamber",
      },
    },
    bootstrap: {
      bootstrap: {
        roomLabel: "Creative Arcade Worker Room",
        objectiveState: "queued",
        authority: "edge-worker",
      },
    },
    routeSeed: { mode: "local-fallback" },
    policy: { entry: { status: "allowed" } },
    now: new Date("2026-03-21T00:00:10.000Z"),
  });
  const afterSecondAdvance = advanceDeterministicLocalMissionGameplayState({
    current: afterFirstAdvance,
    loadedSceneConfig: {
      config: {
        missionId: "mission-creative-arcade",
        title: "Creative Arcade",
        objectiveLabel: "Review mission-specific rules, then wait for richer edge-backed room behavior.",
        environmentLabel: "Arcade test chamber",
      },
    },
    bootstrap: {
      bootstrap: {
        roomLabel: "Creative Arcade Worker Room",
        objectiveState: "queued",
        authority: "edge-worker",
      },
    },
    routeSeed: { mode: "local-fallback" },
    policy: { entry: { status: "allowed" } },
    now: new Date("2026-03-21T00:00:20.000Z"),
  });
  const completed = advanceDeterministicLocalMissionGameplayState({
    current: afterSecondAdvance,
    loadedSceneConfig: {
      config: {
        missionId: "mission-creative-arcade",
        title: "Creative Arcade",
        objectiveLabel: "Review mission-specific rules, then wait for richer edge-backed room behavior.",
        environmentLabel: "Arcade test chamber",
      },
    },
    bootstrap: {
      bootstrap: {
        roomLabel: "Creative Arcade Worker Room",
        objectiveState: "queued",
        authority: "edge-worker",
      },
    },
    routeSeed: { mode: "local-fallback" },
    policy: { entry: { status: "allowed" } },
    now: new Date("2026-03-21T00:00:30.000Z"),
  });

  const completion = resolveDeterministicLocalMissionCompletionResult({
    routeMode: "local-fallback",
    missionId: "mission-creative-arcade",
    title: "Creative Arcade",
    returnHubPath: "/world-hub",
    returnLabel: "Return to world hub",
    runtimeAuthority: "edge-worker",
    gameplay: completed,
    now: new Date("2026-03-21T00:00:30.000Z"),
  });

  assert.equal(completion.outcome.status, "completed");
  assert.equal(completion.result.kind, "preview");
  assert.equal(completion.result.inventoryStatus, "placeholder-ready");
  assert.equal(completion.metadata.validationState, "worker-pending");
  assert.equal(completion.metadata.completedAtIso, "2026-03-21T00:00:30.000Z");
  assert.equal(completion.rewards.status, "placeholder");
  assert.equal(completion.rewards.summary.status, "placeholder");
  assert.equal(completion.rewards.summary.summary.highlightedRewardLabel, "Creative Arcade completion ledger entry");
  assert.equal(completion.source.diagnostics.lastEvent, "completion-ready");
  assert.equal(completion.source.diagnostics.sequence, 3);
});
