import assert from "node:assert/strict";
import test from "node:test";

import { resolveWorldHubDecorationLayerComposition } from "@/lib/world-hub/runtime/decorationLayerPolicy";

test("decoration composition suppresses session accents when class cues are active", () => {
  const result = resolveWorldHubDecorationLayerComposition({
    homeLaneCelebrationProps: [
      {
        id: "home-1",
        placeholderId: "ph-1",
        label: "Home ribbon",
        kind: "ribbon-knot",
        position: { x: 0, y: 0 },
        accent: "#f59e0b",
        tone: "soft",
        active: true,
      },
    ],
    classCelebrationCues: [
      {
        id: "class-1",
        label: "Class pulse",
        placement: "plaza-campfire",
        kind: "pulse-ring",
        position: { x: 0, y: 0 },
        accent: "#f59e0b",
        tone: "warm",
        active: true,
      },
    ],
    academyHomeCooldownCues: [
      {
        id: "cooldown-1",
        placement: "plaza-home-lane",
        kind: "footstep-trail",
        label: "Cooldown lane",
        position: { x: 0, y: 0 },
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
        label: "Tempo",
        detail: "detail",
        position: { x: 0, y: 0 },
        accent: "#a78bfa",
        tone: "soft",
        active: true,
        targetPortalId: "mission-orbit-lab",
      },
    ],
    plazaSessionWrapUpCues: [
      {
        id: "wrapup-1",
        placement: "plaza-ring-north",
        kind: "afterglow-ring",
        label: "Session wrapped",
        position: { x: 0, y: 0 },
        accent: "#86efac",
        tone: "soft",
        active: true,
      },
    ],
    portalRidgeAnticipationCues: [
      {
        id: "ridge-1",
        portalId: "mission-orbit-lab",
        kind: "launch-availability",
        label: "Gate glow is open",
        detail: "Open now",
        position: { x: 0, y: 0 },
        accent: "#f59e0b",
        tone: "warm",
        active: true,
      },
    ],
    portalExitReturnSoftnessCues: [
      {
        id: "return-1",
        placement: "portal-threshold",
        kind: "arrival-ring",
        label: "Welcome back",
        detail: "Returned from mission",
        position: { x: 0, y: 0 },
        accent: "#86efac",
        tone: "soft",
        active: true,
      },
    ],
    sessionCelebrationAccents: [
      {
        id: "session-1",
        placement: "central-plaza",
        kind: "hearth-glow",
        label: "Shared glow",
        position: { x: 0, y: 0 },
        accent: "#67e8f9",
        tone: "warm",
        active: true,
      },
    ],
    endOfDayQuietStateCues: [
      {
        id: "quiet-1",
        placement: "home-hearth",
        kind: "hearth-embers",
        label: "Hearth settling",
        position: { x: 1, y: 1 },
        accent: "#f59e0b",
        tone: "soft",
        active: true,
      },
    ],
    seasonal: {
      status: "inactive",
      summary: {
        eyebrow: "Seasonal layer",
        title: "Resting",
        detail: "No seasonal overlays",
        chips: [],
      },
      layers: [],
      source: {
        kind: "local-preview-snapshot",
        label: "Local",
        detail: "Local",
        fallbackReason: null,
      },
      diagnostics: {
        adapterKind: "local-preview-snapshot",
        resolvedAtIso: "2026-03-26T00:00:00.000Z",
        matchedScheduleId: null,
        activeLayerCount: 0,
      },
    },
  });

  assert.equal(result.classCelebrationCues.length, 1);
  assert.equal(result.academyHomeCooldownCues.length, 0);
  assert.equal(result.academyPortalTempoCues.length, 1);
  assert.equal(result.plazaSessionWrapUpCues.length, 0);
  assert.equal(result.portalRidgeAnticipationCues[0]?.active, false);
  assert.equal(result.portalRidgeAnticipationCues[0]?.tone, "quiet");
  assert.equal(result.portalExitReturnSoftnessCues[0]?.active, false);
  assert.equal(result.sessionCelebrationAccents.length, 0);
  assert.equal(result.endOfDayQuietStateCues.length, 0);
});

test("decoration composition mutes home lane celebrations when seasonal home suppression is active", () => {
  const result = resolveWorldHubDecorationLayerComposition({
    homeLaneCelebrationProps: [
      {
        id: "home-2",
        placeholderId: "ph-2",
        label: "Home petals",
        kind: "petal-ring",
        position: { x: 2, y: 3 },
        accent: "#f9a8d4",
        tone: "warm",
        active: true,
      },
    ],
    classCelebrationCues: [],
    academyHomeCooldownCues: [],
    academyPortalTempoCues: [],
    plazaSessionWrapUpCues: [],
    portalRidgeAnticipationCues: [],
    portalExitReturnSoftnessCues: [],
    sessionCelebrationAccents: [],
    endOfDayQuietStateCues: [],
    seasonal: {
      status: "active",
      summary: {
        eyebrow: "Seasonal layer",
        title: "Active",
        detail: "Spring",
        chips: [],
      },
      layers: [
        {
          layerId: "spring-home",
          label: "Spring home",
          detail: "Layer",
          zone: "home-lane",
          accent: "#f9a8d4",
          status: "active",
          active: true,
          suppresses: ["home-lane-celebration"],
          activeFromIso: "2026-03-01T00:00:00.000Z",
          activeUntilIso: "2026-04-30T23:59:59.999Z",
        },
      ],
      source: {
        kind: "local-preview-snapshot",
        label: "Local",
        detail: "Local",
        fallbackReason: null,
      },
      diagnostics: {
        adapterKind: "local-preview-snapshot",
        resolvedAtIso: "2026-03-26T00:00:00.000Z",
        matchedScheduleId: "spring",
        activeLayerCount: 1,
      },
    },
  });

  assert.equal(result.homeLaneCelebrationProps[0]?.active, false);
  assert.equal(result.homeLaneCelebrationProps[0]?.tone, "quiet");
});

test("decoration composition suppresses end-of-day quiet while cooldown lane is active", () => {
  const result = resolveWorldHubDecorationLayerComposition({
    homeLaneCelebrationProps: [],
    classCelebrationCues: [],
    academyHomeCooldownCues: [
      {
        id: "cooldown-2",
        placement: "home-lane-entry",
        kind: "porch-welcome",
        label: "Porch is ready",
        position: { x: 2, y: 3 },
        accent: "#fde68a",
        tone: "soft",
        active: true,
      },
    ],
    academyPortalTempoCues: [],
    plazaSessionWrapUpCues: [],
    portalRidgeAnticipationCues: [],
    portalExitReturnSoftnessCues: [],
    sessionCelebrationAccents: [],
    endOfDayQuietStateCues: [
      {
        id: "quiet-2",
        placement: "home-hearth",
        kind: "hearth-embers",
        label: "Hearth settling",
        position: { x: 0, y: 0 },
        accent: "#f59e0b",
        tone: "quiet",
        active: false,
      },
    ],
    seasonal: {
      status: "inactive",
      summary: {
        eyebrow: "Seasonal layer",
        title: "Resting",
        detail: "No seasonal overlays",
        chips: [],
      },
      layers: [],
      source: {
        kind: "local-preview-snapshot",
        label: "Local",
        detail: "Local",
        fallbackReason: null,
      },
      diagnostics: {
        adapterKind: "local-preview-snapshot",
        resolvedAtIso: "2026-03-26T00:00:00.000Z",
        matchedScheduleId: null,
        activeLayerCount: 0,
      },
    },
  });

  assert.equal(result.academyHomeCooldownCues.length, 1);
  assert.equal(result.endOfDayQuietStateCues.length, 0);
});
