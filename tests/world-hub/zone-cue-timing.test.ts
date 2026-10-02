import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorldHubEmotionPresentation } from "@/lib/world-hub/runtime/emotionPresentationModel";
import {
  WORLD_HUB_ZONE_CUE_TIMING_PROFILES,
  resolveWorldHubZoneCueTiming,
  type WorldHubZoneCueTimingState,
} from "@/lib/world-hub/runtime/zoneCueTiming";

function createPresentation(args: { classCueActive: boolean; sessionAccentActive: boolean; quietCueActive?: boolean }) {
  return resolveWorldHubEmotionPresentation({
    hasRuntime: true,
    homeLaneSignals: [],
    homeLaneCelebrationProps: [],
    homeRepeatVisitCue: null,
    homeReturnMemoryMarkers: [],
    classCelebrationCues: [
      {
        id: "class-1",
        label: "Class cue",
        placement: "plaza-campfire",
        kind: "pulse-ring",
        position: { x: 310, y: 200 },
        accent: "#f59e0b",
        tone: "warm",
        active: args.classCueActive,
      },
    ],
    sessionCelebrationAccents: [
      {
        id: "session-1",
        placement: "central-plaza",
        kind: "hearth-glow",
        label: "Session accent",
        position: { x: 350, y: 220 },
        accent: "#22d3ee",
        tone: "warm",
        active: args.sessionAccentActive,
      },
    ],
    plazaSessionWrapUpCues: [],
    academyHomeCooldownCues: [],
    academyPortalTempoCues: [],
    endOfDayQuietStateCues: [
      {
        id: "quiet-1",
        placement: "home-hearth",
        kind: "hearth-embers",
        label: "Quiet",
        position: { x: 180, y: 210 },
        accent: "#94a3b8",
        tone: "quiet",
        active: args.quietCueActive ?? true,
      },
    ],
    portalRidgeAnticipationCues: [],
    portalExitReturnSoftnessCues: [],
    nextAdventureSuggestion: {
      status: "idle",
      source: "resolved-runtime",
      eyebrow: "Next",
      title: "Portal",
      detail: "detail",
      hint: "hint",
      chipLabel: "idle",
      targetPortalId: null,
      targetPortalLabel: null,
    },
    homeReadinessCue: {
      status: "resting",
      source: "resolved-runtime",
      eyebrow: "Readiness",
      title: "Resting",
      detail: "detail",
      chipLabel: "resting",
      markerLabel: "marker",
      accent: "#94a3b8",
      targetPortalId: null,
      targetPortalLabel: null,
    },
    journeyPathGuidance: {
      status: "resting",
      eyebrow: "Path",
      title: "Resting",
      detail: "detail",
      chipLabel: "resting",
      ambientLabel: "Path idle",
      accent: "#94a3b8",
      homePosition: null,
      targetPosition: null,
      targetPortalId: null,
      targetPortalLabel: null,
      trailProgress: [],
      source: "deterministic-fallback",
    },
    seasonalDecorationLayers: [],
    summaryChips: [],
  });
}

test("zone cue timing enters then sustains deterministically", () => {
  const presentation = createPresentation({ classCueActive: true, sessionAccentActive: false });
  const first = resolveWorldHubZoneCueTiming({
    emotionPresentation: presentation,
    nowMs: 1_000,
  });

  assert.equal(first.visual["central-plaza"]["class-1"].phase, "enter");
  assert.ok(first.visual["central-plaza"]["class-1"].opacity < 1);

  const second = resolveWorldHubZoneCueTiming({
    emotionPresentation: presentation,
    nowMs: 1_000 + WORLD_HUB_ZONE_CUE_TIMING_PROFILES["central-plaza"].entryMs + 10,
    previousState: first.state,
  });

  assert.equal(second.visual["central-plaza"]["class-1"].phase, "sustain");
  assert.equal(second.visual["central-plaza"]["class-1"].opacity, 1);
});

test("zone cue timing suppresses lower-priority overlaps in a zone", () => {
  const presentation = createPresentation({ classCueActive: true, sessionAccentActive: true });
  const resolved = resolveWorldHubZoneCueTiming({
    emotionPresentation: presentation,
    nowMs: 2_000,
  });

  assert.equal(resolved.visual["central-plaza"]["class-1"].suppressedByCueId, null);
  assert.equal(resolved.visual["central-plaza"]["session-1"].phase, "suppressed");
  assert.equal(resolved.visual["central-plaza"]["session-1"].suppressedByCueId, "class-1");
});

test("zone cue timing runs cooldown and fade-out after deactivation", () => {
  const active = createPresentation({ classCueActive: false, sessionAccentActive: false, quietCueActive: true });
  const coldStart = resolveWorldHubZoneCueTiming({
    emotionPresentation: active,
    nowMs: 10_000,
  });

  const inactive = createPresentation({ classCueActive: false, sessionAccentActive: false, quietCueActive: false });
  const cooldown = resolveWorldHubZoneCueTiming({
    emotionPresentation: inactive,
    nowMs: 10_100,
    previousState: coldStart.state,
  });

  assert.equal(cooldown.visual["home-lane"]["quiet-1"].phase, "cooldown");

  const profile = WORLD_HUB_ZONE_CUE_TIMING_PROFILES["home-lane"];
  const fading = resolveWorldHubZoneCueTiming({
    emotionPresentation: inactive,
    nowMs: 10_100 + profile.cooldownMs + Math.floor(profile.fadeOutMs / 2),
    previousState: cooldown.state as WorldHubZoneCueTimingState,
  });

  assert.equal(fading.visual["home-lane"]["quiet-1"].phase, "fade-out");
  assert.ok(fading.visual["home-lane"]["quiet-1"].opacity < cooldown.visual["home-lane"]["quiet-1"].opacity);
});
