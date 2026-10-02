import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorldHubJourneyPresentationProgression } from "@/lib/world-hub/runtime/journeyPresentationProgression";

function makeBaseArgs() {
  return {
    homeZoneState: "away" as const,
    ambientFeedback: null,
    homeAcknowledgementEmphasis: "none" as const,
    academyFocused: false,
    academyTempoActive: false,
    readinessCue: {
      status: "warming" as const,
      source: "resolved-runtime" as const,
      eyebrow: "Home readiness",
      title: "warming",
      detail: "detail",
      chipLabel: "chip",
      markerLabel: "marker",
      accent: "#34d399",
      targetPortalId: "mission-1",
      targetPortalLabel: "Mission One",
    },
    suggestionCue: {
      status: "suggested" as const,
      source: "resolved-runtime" as const,
      eyebrow: "Next",
      title: "title",
      detail: "detail",
      hint: "hint",
      chipLabel: "chip",
      targetPortalId: "mission-1",
      targetPortalLabel: "Mission One",
    },
    pathGuidance: {
      status: "suggested" as const,
      source: "resolved-runtime" as const,
      eyebrow: "Path",
      title: "title",
      detail: "detail",
      chipLabel: "chip",
      ambientLabel: "ambient",
      accent: "#34d399",
      targetPortalId: "mission-1",
      targetPortalLabel: "Mission One",
      homePosition: { x: 0, y: 0 },
      targetPosition: { x: 10, y: 10 },
      trailProgress: [0.25],
    },
    hasFocusedPortal: false,
    hasSelectedPortal: false,
    portalAnticipationActive: false,
    returnSoftnessActive: false,
  };
}

test("home return softness wins over portal anticipation during return window", () => {
  const progression = resolveWorldHubJourneyPresentationProgression({
    ...makeBaseArgs(),
    homeZoneState: "arrived",
    ambientFeedback: {
      kind: "return",
      eyebrow: "Welcome back",
      title: "Back home",
      detail: "detail",
      tone: "return",
      chips: ["a"],
    },
    readinessCue: {
      ...makeBaseArgs().readinessCue,
      status: "ready",
    },
    pathGuidance: {
      ...makeBaseArgs().pathGuidance,
      status: "active",
    },
    hasFocusedPortal: true,
    portalAnticipationActive: true,
  });

  assert.equal(progression.currentStage, "home");
  assert.equal(progression.emphasis, "return-softness");
  assert.equal(progression.portalAnticipationProminence, "subtle");
});

test("academy-focused staging elevates academy tempo while readiness is not fully ready", () => {
  const progression = resolveWorldHubJourneyPresentationProgression({
    ...makeBaseArgs(),
    academyFocused: true,
    academyTempoActive: true,
    portalAnticipationActive: true,
  });

  assert.equal(progression.currentStage, "academy");
  assert.equal(progression.emphasis, "staging");
  assert.equal(progression.academyTempoProminence, "primary");
  assert.equal(progression.portalAnticipationProminence, "subtle");
});

test("ready portal and active path guidance make portal stage primary", () => {
  const progression = resolveWorldHubJourneyPresentationProgression({
    ...makeBaseArgs(),
    readinessCue: {
      ...makeBaseArgs().readinessCue,
      status: "ready",
    },
    pathGuidance: {
      ...makeBaseArgs().pathGuidance,
      status: "active",
    },
    hasSelectedPortal: true,
    portalAnticipationActive: true,
  });

  assert.equal(progression.currentStage, "portal");
  assert.equal(progression.emphasis, "ready-to-depart");
  assert.equal(progression.pathGuidanceProminence, "primary");
});

test("home anchor remains present in portal-primary state", () => {
  const progression = resolveWorldHubJourneyPresentationProgression({
    ...makeBaseArgs(),
    readinessCue: {
      ...makeBaseArgs().readinessCue,
      status: "ready",
    },
    pathGuidance: {
      ...makeBaseArgs().pathGuidance,
      status: "active",
    },
    hasFocusedPortal: true,
  });

  assert.equal(progression.currentStage, "portal");
  assert.equal(progression.homeAnchorPresence, "supporting");
});

test("settled home acknowledgement does not keep return-softness primary", () => {
  const progression = resolveWorldHubJourneyPresentationProgression({
    ...makeBaseArgs(),
    homeZoneState: "arrived",
    homeAcknowledgementEmphasis: "settled",
    readinessCue: {
      ...makeBaseArgs().readinessCue,
      status: "ready",
    },
  });

  assert.equal(progression.currentStage, "home");
  assert.equal(progression.emphasis, "settled-home");
  assert.equal(progression.readinessProminence, "subtle");
});
