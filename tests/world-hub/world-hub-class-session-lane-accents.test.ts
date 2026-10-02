import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorldHubClassSessionLaneAccents } from "@/lib/world-hub/runtime/worldHubClassSessionLaneAccents";

function makeHintDensity(classSessionProminence: "primary" | "secondary" | "subtle" | "hidden") {
  return {
    classSessionProminence,
  };
}

test("gather_at_plaza makes plaza accent primary", () => {
  const resolved = resolveWorldHubClassSessionLaneAccents({
    liveSession: {
      status: "teacher-guided",
      cueState: "gather_at_plaza",
    } as never,
    hintDensity: makeHintDensity("primary"),
  });

  assert.equal(resolved.activeLane, "plaza");
  assert.equal(resolved.accentTone, "gather");
  assert.equal(resolved.plazaEmphasis, "primary");
  assert.equal(resolved.academyEmphasis, "supporting");
  assert.equal(resolved.portalEmphasis, "quiet");
  assert.equal(resolved.stageLabel, "광장 모임");
});

test("prepare_at_academy makes academy accent primary", () => {
  const resolved = resolveWorldHubClassSessionLaneAccents({
    liveSession: {
      status: "teacher-guided",
      cueState: "prepare_at_academy",
    } as never,
    hintDensity: makeHintDensity("primary"),
  });

  assert.equal(resolved.activeLane, "academy");
  assert.equal(resolved.accentTone, "prepare");
  assert.equal(resolved.academyEmphasis, "primary");
  assert.equal(resolved.portalEmphasis, "supporting");
  assert.equal(resolved.stageLabel, "아카데미 준비");
});

test("start_mission makes portal accent primary", () => {
  const resolved = resolveWorldHubClassSessionLaneAccents({
    liveSession: {
      status: "mission-starting-soon",
      cueState: "start_mission",
    } as never,
    hintDensity: makeHintDensity("primary"),
  });

  assert.equal(resolved.activeLane, "portal");
  assert.equal(resolved.accentTone, "launch");
  assert.equal(resolved.portalEmphasis, "primary");
  assert.equal(resolved.academyEmphasis, "supporting");
  assert.equal(resolved.stageLabel, "포털 출발");
});

test("inactive/self-paced returns no strong lane accent", () => {
  const resolved = resolveWorldHubClassSessionLaneAccents({
    liveSession: {
      status: "self-paced-open",
      cueState: "none",
    } as never,
    hintDensity: makeHintDensity("primary"),
  });

  assert.deepEqual(resolved, {
    activeLane: null,
    accentTone: null,
    plazaEmphasis: "quiet",
    academyEmphasis: "quiet",
    portalEmphasis: "quiet",
    connectorVisibility: "hidden",
    stageLabel: null,
  });
});

test("non-primary hint density softens lane emphasis and connector visibility", () => {
  const resolved = resolveWorldHubClassSessionLaneAccents({
    liveSession: {
      status: "teacher-guided",
      cueState: "prepare_at_academy",
    } as never,
    hintDensity: makeHintDensity("secondary"),
  });

  assert.equal(resolved.academyEmphasis, "supporting");
  assert.equal(resolved.portalEmphasis, "quiet");
  assert.equal(resolved.connectorVisibility, "soft");
});

test("korean stage labels stay compact and stable", () => {
  const labels = [
    resolveWorldHubClassSessionLaneAccents({
      liveSession: { status: "teacher-guided", cueState: "gather_at_plaza" } as never,
      hintDensity: makeHintDensity("primary"),
    }).stageLabel,
    resolveWorldHubClassSessionLaneAccents({
      liveSession: { status: "teacher-guided", cueState: "prepare_at_academy" } as never,
      hintDensity: makeHintDensity("primary"),
    }).stageLabel,
    resolveWorldHubClassSessionLaneAccents({
      liveSession: { status: "mission-starting-soon", cueState: "start_mission" } as never,
      hintDensity: makeHintDensity("primary"),
    }).stageLabel,
  ];

  assert.deepEqual(labels, ["광장 모임", "아카데미 준비", "포털 출발"]);
  assert.equal(labels.every((label) => (label ?? "").length <= 8), true);
});
