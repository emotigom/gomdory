import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDeterministicLocalMissionGameplayState,
  resolveDeterministicLocalMissionGameplayState,
} from "@/lib/world-hub/mission/gameplay/localProgression";

test("deterministic local mission gameplay initializes from bootstrap state", () => {
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

  assert.equal(gameplay.lifecycle.status, "briefing");
  assert.equal(gameplay.objective.stepIndex, 1);
  assert.equal(gameplay.progress.completedObjectives, 0);
  assert.equal(gameplay.progress.totalObjectives, 3);
  assert.equal(gameplay.resolution.status, "pending");
  assert.equal(gameplay.source.diagnostics.sequence, 0);
  assert.equal(gameplay.source.diagnostics.owner, "local-preview");
});

test("deterministic local mission gameplay advances to completion without raw event exposure", () => {
  const initial = resolveDeterministicLocalMissionGameplayState({
    missionId: "mission-creative-arcade",
    title: "Creative Arcade",
    objectiveLabel: "Review mission-specific rules, then wait for richer edge-backed room behavior.",
    environmentLabel: "Arcade test chamber",
    roomLabel: "Creative Arcade Local Room",
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
        roomLabel: "Creative Arcade Local Room",
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
        roomLabel: "Creative Arcade Local Room",
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
        roomLabel: "Creative Arcade Local Room",
        objectiveState: "queued",
        authority: "edge-worker",
      },
    },
    routeSeed: { mode: "local-fallback" },
    policy: { entry: { status: "allowed" } },
    now: new Date("2026-03-21T00:00:30.000Z"),
  });

  assert.equal(afterFirstAdvance.lifecycle.status, "active");
  assert.equal(afterFirstAdvance.progress.completedObjectives, 1);
  assert.equal(afterFirstAdvance.source.diagnostics.owner, "worker-pending");
  assert.equal(completed.lifecycle.status, "completed");
  assert.equal(completed.progress.percent, 100);
  assert.equal(completed.resolution.status, "completed");
  assert.equal(completed.source.diagnostics.transitionCount, 3);
  assert.equal(completed.source.diagnostics.lastEvent, "completed");
});
