import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorldHubHintDensity } from "@/lib/world-hub/runtime/worldHubHintDensity";
import { WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY } from "@/lib/world-hub/runtime/worldHubFirstVisitOnboarding";

function makeProgression() {
  return {
    currentStage: "home" as const,
    emphasis: "settled-home" as const,
    homeAnchorPresence: "primary" as const,
    suggestionProminence: "secondary" as const,
    readinessProminence: "subtle" as const,
    pathGuidanceProminence: "subtle" as const,
    academyTempoProminence: "resting" as const,
    portalAnticipationProminence: "resting" as const,
  };
}

test("first-arrival home-return cue stays primary while portal hint remains subdued when not near portal", () => {
  const density = resolveWorldHubHintDensity({
    onboardingPhase: "compact",
    homeZoneState: "arrived",
    progression: {
      ...makeProgression(),
      emphasis: "return-softness",
    },
    hasAmbientFeedback: true,
    hasFocusedPortal: false,
    hasSelectedPortal: false,
    hasPortalEntryFeedback: true,
    hasClassSessionGuidance: false,
    classSessionStage: null,
  });

  assert.equal(density.primarySurface, "home-return");
  assert.equal(density.homeReturnProminence, "primary");
  assert.equal(density.portalProminence, "subtle");
});

test("settled state reduces home-return prominence", () => {
  const density = resolveWorldHubHintDensity({
    onboardingPhase: "hidden",
    homeZoneState: "away",
    progression: makeProgression(),
    hasAmbientFeedback: false,
    hasFocusedPortal: false,
    hasSelectedPortal: false,
    hasPortalEntryFeedback: false,
    hasClassSessionGuidance: false,
    classSessionStage: null,
  });

  assert.equal(density.homeReturnProminence, "subtle");
  assert.equal(density.primarySurface, "none");
});

test("near-portal state elevates portal-entry hint", () => {
  const density = resolveWorldHubHintDensity({
    onboardingPhase: "compact",
    homeZoneState: "approaching",
    progression: {
      ...makeProgression(),
      currentStage: "portal",
      readinessProminence: "primary",
      pathGuidanceProminence: "primary",
      portalAnticipationProminence: "primary",
    },
    hasAmbientFeedback: false,
    hasFocusedPortal: true,
    hasSelectedPortal: false,
    hasPortalEntryFeedback: true,
    hasClassSessionGuidance: false,
    classSessionStage: null,
  });

  assert.equal(density.primarySurface, "portal");
  assert.equal(density.portalProminence, "primary");
  assert.equal(density.showPortalEntryFeedback, true);
});

test("onboarding compact hint de-emphasizes when situational cues are stronger", () => {
  const density = resolveWorldHubHintDensity({
    onboardingPhase: "compact",
    homeZoneState: "arrived",
    progression: {
      ...makeProgression(),
      emphasis: "return-softness",
    },
    hasAmbientFeedback: true,
    hasFocusedPortal: false,
    hasSelectedPortal: false,
    hasPortalEntryFeedback: false,
    hasClassSessionGuidance: false,
    classSessionStage: null,
  });

  assert.equal(density.onboardingProminence, "subtle");
});

test("portal-primary state avoids equally loud home/onboarding surfaces", () => {
  const density = resolveWorldHubHintDensity({
    onboardingPhase: "expanded",
    homeZoneState: "away",
    progression: {
      ...makeProgression(),
      currentStage: "portal",
      readinessProminence: "primary",
      pathGuidanceProminence: "primary",
      portalAnticipationProminence: "primary",
    },
    hasAmbientFeedback: true,
    hasFocusedPortal: false,
    hasSelectedPortal: true,
    hasPortalEntryFeedback: true,
    hasClassSessionGuidance: false,
    classSessionStage: null,
  });

  assert.equal(density.primarySurface, "portal");
  assert.equal(density.showAmbientFeedback, false);
  assert.notEqual(density.onboardingProminence, "primary");
  assert.notEqual(density.homeReturnProminence, "primary");
});

test("localized Korean onboarding surfaces remain intact", () => {
  assert.match(WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY.title, /숲속 모험 베이스캠프/);
  assert.match(WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY.compactLabel, /가까이 가면 안내/);
  assert.equal(WORLD_HUB_FIRST_VISIT_ONBOARDING_COPY.dismissLabel, "닫기");
});

test("class-session primary guidance de-emphasizes onboarding while keeping class stage primary", () => {
  const density = resolveWorldHubHintDensity({
    onboardingPhase: "expanded",
    homeZoneState: "away",
    progression: makeProgression(),
    hasAmbientFeedback: false,
    hasFocusedPortal: false,
    hasSelectedPortal: false,
    hasPortalEntryFeedback: false,
    hasClassSessionGuidance: true,
    classSessionStage: "gather",
  });

  assert.equal(density.primarySurface, "class-session");
  assert.equal(density.classSessionProminence, "primary");
  assert.equal(density.onboardingProminence, "subtle");
});
