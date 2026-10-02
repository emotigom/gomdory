import test from "node:test";
import assert from "node:assert/strict";

import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";
import { parseMetaverseResolvedLaunchControlState } from "@/lib/world-hub/launch/contracts";
import { resolvePortalLaunchCues } from "@/lib/world-hub/runtime/launchPortalCues";

function buildLaunchControls() {
  return parseMetaverseResolvedLaunchControlState({
    version: 1,
    scope: {
      classId: "class-preview-mission-release",
      worldId: "starter-world-hub",
      sessionId: null,
      context: "classroom",
    },
    source: {
      kind: "local-preview-snapshot",
      label: "Local snapshot",
      detail: "Deterministic class-scoped launch snapshot.",
      fallbackReason: null,
    },
    resolution: "resolved",
    preview: {
      mode: "local-snapshot",
      fallback: "inherit-mission-availability",
      label: "Class snapshot",
      detail: "Local class snapshot in effect.",
    },
    metadata: {
      state: "mission-overrides",
      stateLabel: "Mission overrides",
      summary: "Overrides attached for today.",
      updatedAtIso: "2026-03-22T00:00:00.000Z",
      effectiveFromIso: null,
      expiresAtIso: null,
    },
    hubEntry: {
      status: "allowed",
      code: "allowed",
      label: "Hub entry allowed",
      detail: "Students can enter the hub.",
    },
    missionOverrides: [
      {
        missionId: "mission-orbit-lab",
        mode: "allowed",
        decision: {
          status: "allowed",
          code: "mission-allowed",
          label: "Mission release open",
          detail: "Orbit Lab is open for today.",
        },
        detail: "Open override.",
      },
      {
        missionId: "mission-creative-arcade",
        mode: "blocked",
        decision: {
          status: "blocked",
          code: "mission-blocked",
          label: "Mission release blocked",
          detail: "Creative Arcade is resting for now.",
        },
        detail: "Blocked override.",
      },
    ],
    diagnostics: {
      adapterKind: "local-preview-snapshot",
      resolution: "resolved",
      scopeContext: "classroom",
      snapshotKey: "preview-mission-release",
      missionOverrideCount: 2,
      evaluatedAtIso: "2026-03-22T00:00:00.000Z",
      summary: "Resolved from local snapshot.",
    },
  });
}

test("resolvePortalLaunchCues maps mission overrides into student-facing portal entry cues", () => {
  const manifest = getDefaultWorldHubManifest();
  const portals = resolvePortalLaunchCues({
    portals: manifest.portals,
    launchControls: buildLaunchControls(),
  });

  const orbitLab = portals.find((portal) => portal.id === "mission-orbit-lab");
  const creativeArcade = portals.find((portal) => portal.id === "mission-creative-arcade");

  assert.equal(orbitLab?.entryCue, "suggested");
  assert.equal(orbitLab?.statusLabel, "Today’s class adventure");
  assert.equal(creativeArcade?.entryCue, "unavailable");
  assert.equal(creativeArcade?.availability, "locked");
  assert.equal(creativeArcade?.statusLabel, "Opens soon");
});

