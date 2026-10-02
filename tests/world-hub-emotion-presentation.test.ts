import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorldHubEmotionPresentation } from "@/lib/world-hub/runtime/emotionPresentationModel";

test("resolveWorldHubEmotionPresentation groups resolved cues by zone", () => {
  const presentation = resolveWorldHubEmotionPresentation({
    hasRuntime: true,
    homeLaneSignals: [
      {
        id: "badge",
        label: "Badge",
        kind: "badge-display",
        symbol: "✦",
        accent: "#34d399",
        statusLabel: "ready",
        detail: "detail",
        projectionValue: null,
        emphasis: "warm",
        state: "ready",
      },
    ],
    homeLaneCelebrationProps: [
      {
        id: "badge:spark",
        placeholderId: "badge",
        label: "Badge",
        kind: "spark-cluster",
        position: { x: 100, y: 120 },
        accent: "#34d399",
        tone: "warm",
        active: true,
      },
    ],
    homeRepeatVisitCue: {
      status: "steady",
      eyebrow: "Home rhythm",
      label: "Warm return",
      detail: "You came back.",
      chipLabel: "repeat",
      streakDays: 5,
      totalVisits: 3,
      emphasis: "warm",
    },
    homeReturnMemoryMarkers: [
      {
        id: "m-1",
        kind: "return-glow",
        label: "Marker",
        detail: "detail",
        active: true,
        accent: "#34d399",
        tone: "warm",
        chipLabel: "chip",
        position: { x: 100, y: 160 },
      },
    ],
    classCelebrationCues: [
      {
        id: "class-1",
        label: "Class cue",
        placement: "plaza-campfire",
        kind: "pulse-ring",
        position: { x: 310, y: 200 },
        accent: "#f59e0b",
        tone: "warm",
        active: true,
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
        active: true,
      },
    ],
    plazaSessionWrapUpCues: [
      {
        id: "wrap-1",
        placement: "plaza-ring-north",
        kind: "afterglow-ring",
        label: "Wrap",
        position: { x: 300, y: 210 },
        accent: "#86efac",
        tone: "soft",
        active: true,
      },
    ],
    academyHomeCooldownCues: [
      {
        id: "cool-1",
        placement: "academy-footbridge",
        kind: "lantern-breath",
        label: "Cooldown",
        position: { x: 250, y: 190 },
        accent: "#67e8f9",
        tone: "soft",
        active: true,
      },
    ],
    academyPortalTempoCues: [
      {
        id: "tempo-1",
        placement: "academy-threshold",
        kind: "lantern-tempo",
        label: "Set-off",
        detail: "detail",
        position: { x: 270, y: 190 },
        accent: "#a78bfa",
        tone: "soft",
        active: true,
        targetPortalId: "p-1",
      },
    ],
    endOfDayQuietStateCues: [
      {
        id: "quiet-1",
        placement: "home-hearth",
        kind: "hearth-embers",
        label: "Quiet",
        position: { x: 180, y: 210 },
        accent: "#94a3b8",
        tone: "quiet",
        active: true,
      },
    ],
    portalRidgeAnticipationCues: [
      {
        id: "ridge-1",
        portalId: "p-1",
        kind: "mission-readiness",
        label: "Ridge",
        detail: "detail",
        tone: "warm",
        active: true,
        accent: "#22d3ee",
        position: { x: 420, y: 200 },
      },
    ],
    portalExitReturnSoftnessCues: [
      {
        id: "return-1",
        placement: "portal-threshold",
        kind: "arrival-ring",
        label: "Welcome back",
        detail: "Returned from mission",
        position: { x: 390, y: 190 },
        accent: "#86efac",
        tone: "soft",
        active: true,
      },
    ],
    nextAdventureSuggestion: {
      status: "suggested",
      source: "resolved-runtime",
      eyebrow: "Next",
      title: "Portal",
      detail: "detail",
      hint: "hint",
      chipLabel: "suggested",
      targetPortalId: "p-1",
      targetPortalLabel: "Portal One",
    },
    homeReadinessCue: {
      status: "ready",
      source: "resolved-runtime",
      eyebrow: "Readiness",
      title: "Ready",
      detail: "detail",
      chipLabel: "ready",
      markerLabel: "marker",
      accent: "#22d3ee",
      targetPortalId: "p-1",
      targetPortalLabel: "Portal One",
    },
    journeyPathGuidance: {
      status: "active",
      eyebrow: "Path",
      title: "Trail",
      detail: "detail",
      chipLabel: "active",
      ambientLabel: "Lantern trail live",
      accent: "#22d3ee",
      homePosition: { x: 120, y: 180 },
      targetPosition: { x: 320, y: 180 },
      targetPortalId: "p-1",
      targetPortalLabel: "Portal One",
      trailProgress: [0.2, 0.6, 1],
      source: "resolved-runtime",
    },
    seasonalDecorationLayers: [
      {
        layerId: "spring",
        label: "Spring",
        detail: "detail",
        zone: "home-lane",
        accent: "#f472b6",
        status: "active",
        active: true,
        suppresses: [],
        activeFromIso: null,
        activeUntilIso: null,
      },
    ],
    summaryChips: ["Class cues prioritized"],
  });

  assert.equal(presentation.centralPlaza.classCelebrationCues.length, 1);
  assert.equal(presentation.homeLane.signals.length, 1);
  assert.equal(presentation.portalRidge.readinessCue.status, "ready");
  assert.equal(presentation.academyLodge.tempoCues.length, 1);
  assert.equal(presentation.portalRidge.exitReturnCues.length, 1);
  assert.equal(presentation.seasonal.hasActiveLayer, true);
  assert.equal(presentation.diagnostics.source, "resolved-runtime");
});

test("resolveWorldHubEmotionPresentation keeps deterministic fallback diagnostics", () => {
  const presentation = resolveWorldHubEmotionPresentation({
    hasRuntime: false,
    homeLaneSignals: [],
    homeLaneCelebrationProps: [],
    homeRepeatVisitCue: null,
    homeReturnMemoryMarkers: [],
    classCelebrationCues: [],
    sessionCelebrationAccents: [],
    plazaSessionWrapUpCues: [],
    academyHomeCooldownCues: [],
    academyPortalTempoCues: [],
    endOfDayQuietStateCues: [],
    portalRidgeAnticipationCues: [],
    portalExitReturnSoftnessCues: [],
    nextAdventureSuggestion: {
      status: "idle",
      source: "deterministic-fallback",
      eyebrow: "Next",
      title: "Portal warming",
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
    summaryChips: ["Fallback"],
  });

  assert.equal(presentation.diagnostics.source, "deterministic-fallback");
  assert.equal(presentation.seasonal.hasActiveLayer, false);
});
