import assert from "node:assert/strict";
import test from "node:test";

import type { WorldHubRuntimeInputs } from "@/lib/world-hub/contracts";
import { resolveWorldHubAcademyPortalTempoCues } from "@/lib/world-hub/runtime/academyPortalTempoCues";

const runtimeFixture = {
  kiosk: { position: { x: 40, y: 56 } },
  portals: [
    {
      id: "mission-lantern-ridge",
      label: "Lantern Ridge",
      summary: "Next",
      statusLabel: "Suggested",
      availability: "available",
      entryCue: "suggested",
      accent: "#34d399",
      position: { x: 82, y: 28 },
      missionRoute: "/world-hub/missions/mission-lantern-ridge",
    },
  ],
  liveSession: {
    status: "teacher-guided",
    missionStart: "teacher-cued",
    cueState: "prepare_at_academy",
    label: "Prep",
    detail: "Get ready",
    updatedAtIso: "2026-03-27T00:00:00.000Z",
    source: "teacher-live-controls",
    fallback: "none",
  },
} as unknown as WorldHubRuntimeInputs;

test("resolveWorldHubAcademyPortalTempoCues returns deterministic empty cues without runtime", () => {
  const resolved = resolveWorldHubAcademyPortalTempoCues({
    runtime: null,
    journeyPathGuidance: {
      status: "resting",
      source: "deterministic-fallback",
      eyebrow: "Path",
      title: "Resting",
      detail: "detail",
      chipLabel: "resting",
      ambientLabel: "idle",
      accent: "#94a3b8",
      targetPortalId: null,
      targetPortalLabel: null,
      homePosition: null,
      targetPosition: null,
      trailProgress: [],
    },
    homeReadinessCue: {
      status: "resting",
      source: "deterministic-fallback",
      eyebrow: "Readiness",
      title: "Resting",
      detail: "detail",
      chipLabel: "resting",
      markerLabel: "resting",
      accent: "#94a3b8",
      targetPortalId: null,
      targetPortalLabel: null,
    },
  });

  assert.deepEqual(resolved, { cues: [], summary: null });
});

test("resolveWorldHubAcademyPortalTempoCues activates gentle prep-to-depart tempo in academy prep", () => {
  const resolved = resolveWorldHubAcademyPortalTempoCues({
    runtime: runtimeFixture,
    journeyPathGuidance: {
      status: "active",
      source: "resolved-runtime",
      eyebrow: "Path",
      title: "Active",
      detail: "Follow the path",
      chipLabel: "Path lit",
      ambientLabel: "live",
      accent: "#34d399",
      targetPortalId: "mission-lantern-ridge",
      targetPortalLabel: "Lantern Ridge",
      homePosition: { x: 20, y: 52 },
      targetPosition: { x: 82, y: 28 },
      trailProgress: [0.2, 0.45, 0.7],
    },
    homeReadinessCue: {
      status: "ready",
      source: "resolved-runtime",
      eyebrow: "Readiness",
      title: "Ready",
      detail: "Ready",
      chipLabel: "Ready",
      markerLabel: "Ready",
      accent: "#34d399",
      targetPortalId: "mission-lantern-ridge",
      targetPortalLabel: "Lantern Ridge",
    },
  });

  assert.equal(resolved.cues.length, 3);
  assert.equal(resolved.cues.every((cue) => cue.active), true);
  assert.match(resolved.summary?.title ?? "", /활성화/);
});

test("resolveWorldHubAcademyPortalTempoCues keeps cues subtle after launch cue shifts to start mission", () => {
  const resolved = resolveWorldHubAcademyPortalTempoCues({
    runtime: {
      ...runtimeFixture,
      liveSession: {
        ...runtimeFixture.liveSession,
        status: "mission-starting-soon",
        cueState: "start_mission",
      },
    } as unknown as WorldHubRuntimeInputs,
    journeyPathGuidance: {
      status: "suggested",
      source: "resolved-runtime",
      eyebrow: "Path",
      title: "Suggested",
      detail: "Follow the path",
      chipLabel: "Path hint",
      ambientLabel: "hint",
      accent: "#34d399",
      targetPortalId: "mission-lantern-ridge",
      targetPortalLabel: "Lantern Ridge",
      homePosition: { x: 20, y: 52 },
      targetPosition: { x: 82, y: 28 },
      trailProgress: [0.22, 0.58],
    },
    homeReadinessCue: {
      status: "ready",
      source: "resolved-runtime",
      eyebrow: "Readiness",
      title: "Ready",
      detail: "Ready",
      chipLabel: "Ready",
      markerLabel: "Ready",
      accent: "#34d399",
      targetPortalId: "mission-lantern-ridge",
      targetPortalLabel: "Lantern Ridge",
    },
  });

  assert.equal(resolved.cues.length, 3);
  assert.equal(resolved.cues.some((cue) => cue.active), false);
  assert.ok(resolved.cues.every((cue) => cue.tone === "quiet" || cue.tone === "soft"));
});
