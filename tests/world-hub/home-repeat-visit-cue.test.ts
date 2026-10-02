import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveNextHomeRepeatVisitState,
  resolveWorldHubHomeRepeatVisitCue,
  type WorldHubHomeRepeatVisitState,
} from "@/lib/world-hub/runtime/homeRepeatVisitCue";

test("resolveNextHomeRepeatVisitState increments streak on next-day revisit", () => {
  const previous: WorldHubHomeRepeatVisitState = {
    version: 1,
    streakDays: 2,
    totalVisits: 4,
    lastVisitDate: "2026-03-23",
    resolvedAtIso: "2026-03-23T08:00:00.000Z",
    source: "storage",
  };

  const next = resolveNextHomeRepeatVisitState({
    previous,
    nowIso: "2026-03-24T08:15:00.000Z",
    shouldRecordVisit: true,
  });

  assert.equal(next.streakDays, 3);
  assert.equal(next.totalVisits, 5);
  assert.equal(next.lastVisitDate, "2026-03-24");
});

test("resolveNextHomeRepeatVisitState keeps streak stable for same-day revisit", () => {
  const previous: WorldHubHomeRepeatVisitState = {
    version: 1,
    streakDays: 3,
    totalVisits: 5,
    lastVisitDate: "2026-03-24",
    resolvedAtIso: "2026-03-24T08:00:00.000Z",
    source: "storage",
  };

  const next = resolveNextHomeRepeatVisitState({
    previous,
    nowIso: "2026-03-24T12:45:00.000Z",
    shouldRecordVisit: true,
  });

  assert.equal(next.streakDays, 3);
  assert.equal(next.totalVisits, 5);
});

test("resolveWorldHubHomeRepeatVisitCue produces warm copy for steady streaks", () => {
  const cue = resolveWorldHubHomeRepeatVisitCue({
    version: 1,
    streakDays: 6,
    totalVisits: 10,
    lastVisitDate: "2026-03-24",
    resolvedAtIso: "2026-03-24T12:45:00.000Z",
    source: "storage",
  });

  assert.equal(cue.status, "steady");
  assert.equal(cue.emphasis, "warm");
  assert.match(cue.label, /warm streak/);
});
