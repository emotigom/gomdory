import assert from "node:assert/strict";
import test from "node:test";

import { createWorldHubMissionHandoffPayload, parseMissionRouteSeedFromSearchParams } from "@/lib/world-hub/mission/handoff";
import { resolveDeterministicLocalMissionGameplayState } from "@/lib/world-hub/mission/gameplay/localProgression";
import { resolveDeterministicLocalMissionCompletionResult } from "@/lib/world-hub/mission/completion/localCompletion";
import { createMissionRoomRuntimeInputs } from "@/lib/world-hub/mission/runtime/runtimeInputs";
import { getLocalMissionSceneSnapshot } from "@/lib/world-hub/mission/manifest/localSceneSnapshot";
import {
  createAuthoritativeSessionProjection,
  createLocalNoopPresenceSubscription,
} from "@/lib/world-hub/runtime/sessionProjection";

const orbitPortal = {
  id: "mission-orbit-lab",
  label: "Orbit Lab",
  summary: "Typed mission handoff target",
  statusLabel: "Join mission",
  availability: "available",
  accent: "#22d3ee",
  position: { x: 0, y: 0 },
  missionRoute: "/world-hub/missions/mission-orbit-lab",
} as const;

function createMissionPolicy() {
  return {
    runtime: "mission-room" as const,
    scope: {
      classId: null,
      sessionId: null,
      worldId: "starter-world-hub",
      missionId: "unknown-mission",
    },
    source: {
      kind: "local-preview" as const,
      label: "Local preview policy",
      detail: null,
      fallbackReason: null,
    },
    resolution: "resolved" as const,
    preview: {
      mode: "allow-local-preview" as const,
      fallback: "allow" as const,
      label: "Local preview allowed",
      detail: null,
    },
    entry: {
      status: "allowed" as const,
      code: "preview-allowed" as const,
      label: "Preview allowed",
      detail: null,
    },
    diagnostics: {
      adapterKind: "local-preview-snapshot" as const,
      resolution: "resolved" as const,
      scopeAlignment: "unscoped" as const,
      evaluatedAtIso: "2026-03-21T00:00:00.000Z",
      summary: "Local mission preview policy applied.",
    },
  };
}

function createMissionAssets() {
  return {
    scope: "mission-room" as const,
    runtimeId: "unknown-mission",
    manifestVersion: "local-preview-v1",
    descriptors: [],
    source: {
      kind: "local-manifest" as const,
      label: "Local preview asset manifest",
      detail: null,
      fallbackReason: null,
      diagnostics: {
        scope: "mission-room" as const,
        runtimeId: "unknown-mission",
        deliveryMode: "local-preview" as const,
        baseUrl: null,
        manifestVersion: "local-preview-v1",
        assetCount: 0,
        readyAssetCount: 0,
        unavailableAssetCount: 0,
      },
    },
    loadedAtIso: "2026-03-21T00:00:00.000Z",
  };
}

test("mission route seed validates serialized local handoff payloads", () => {
  const handoff = createWorldHubMissionHandoffPayload({
    worldId: "starter-world-hub",
    sessionId: "session-local-1",
    portal: orbitPortal,
    launchMode: "placeholder-route",
    bootstrapMode: "local-preview",
  });

  const routeSeed = parseMissionRouteSeedFromSearchParams({
    missionId: orbitPortal.id,
    handoffParam: JSON.stringify(handoff),
  });

  assert.equal(routeSeed.mode, "validated-handoff");
  if (routeSeed.mode !== "validated-handoff") {
    throw new Error("Expected validated handoff route seed");
  }

  assert.equal(routeSeed.handoff.portal.label, "Orbit Lab");
  assert.equal(routeSeed.handoff.bootstrapMode, "local-preview");
});

test("mission route falls back safely for mismatched handoff payloads", () => {
  const handoff = createWorldHubMissionHandoffPayload({
    worldId: "starter-world-hub",
    sessionId: "session-local-2",
    portal: orbitPortal,
    launchMode: "placeholder-route",
    bootstrapMode: "local-preview",
  });

  const routeSeed = parseMissionRouteSeedFromSearchParams({
    missionId: "mission-creative-arcade",
    handoffParam: JSON.stringify(handoff),
  });

  assert.equal(routeSeed.mode, "local-fallback");
  if (routeSeed.mode !== "local-fallback") {
    throw new Error("Expected local fallback route seed");
  }

  assert.equal(routeSeed.fallbackReason, "mission-mismatch");
});

test("mission runtime inputs preserve fallback metadata for safe rendering", async () => {
  const routeSeed = parseMissionRouteSeedFromSearchParams({
    missionId: "unknown-mission",
    handoffParam: undefined,
  });
  const loadedSceneConfig = {
    config: getLocalMissionSceneSnapshot(routeSeed),
    source: {
      kind: "local-derived",
      label: "Local fallback mission config",
      detail: null,
      fallbackReason: null,
    },
    loadedAtIso: "2026-03-21T00:00:00.000Z",
  } as const;

  const metadata = {
    authority: {
      scope: "mission-room",
      authorityKind: "local-preview",
      authorityEpochIso: null,
      ownerId: null,
      transferable: false,
    },
    presence: {
      scope: "mission-room",
      status: "inactive",
      transport: "none",
      channelKey: null,
      subscriptionToken: null,
    },
    reservation: {
      scope: "mission-room",
      status: "not-required",
      joinTicket: null,
      reservationId: null,
      confirmationRequired: false,
      expiresAtIso: null,
    },
  } as const;
  const session = createAuthoritativeSessionProjection({
    scope: "mission-room",
    runtimeId: "unknown-mission-local-room",
    runtimeAuthority: "local-preview",
    metadata,
  });
  const presenceSubscription = await createLocalNoopPresenceSubscription().subscribe({ session });
  const policy = createMissionPolicy();
  const gameplay = resolveDeterministicLocalMissionGameplayState({
    missionId: loadedSceneConfig.config.missionId,
    title: loadedSceneConfig.config.title,
    objectiveLabel: loadedSceneConfig.config.objectiveLabel,
    environmentLabel: loadedSceneConfig.config.environmentLabel,
    roomLabel: "Unknown Mission Local Room",
    routeMode: routeSeed.mode,
    bootstrapObjectiveState: "briefing",
    policyStatus: policy.entry.status,
    sessionRuntimeAuthority: session.runtimeAuthority,
    now: new Date("2026-03-21T00:00:00.000Z"),
  });
  const completion = resolveDeterministicLocalMissionCompletionResult({
    routeMode: routeSeed.mode,
    missionId: loadedSceneConfig.config.missionId,
    title: loadedSceneConfig.config.title,
    returnHubPath: routeSeed.returnHubPath,
    returnLabel: loadedSceneConfig.config.returnLabel,
    runtimeAuthority: session.runtimeAuthority,
    gameplay,
    now: new Date("2026-03-21T00:00:00.000Z"),
  });

  const runtime = createMissionRoomRuntimeInputs({
    routeSeed,
    loadedSceneConfig,
    bootstrap: {
      requestedMode: "local-single-user",
      bootstrap: {
        mode: "local-single-user",
        authority: "local-preview",
        roomId: "unknown-mission-local-room",
        roomLabel: "Unknown Mission Local Room",
        seatLabel: "Fallback preview seat",
        connectionLabel: "unknown-mission fallback bootstrap ready",
        objectiveState: "briefing",
        partySize: 1,
        metadata,
      },
      source: {
        kind: "local-derived",
        label: "Deterministic local mission bootstrap",
        detail: null,
        fallbackReason: null,
        diagnostics: {
          strategy: "local-default",
          endpoint: null,
          requestedMode: "local-single-user",
          resolvedMode: "local-single-user",
          usedFallback: false,
          hasReservedAuthority: false,
          hasReservedPresenceChannel: false,
          hasReservedReservation: false,
        },
      },
    },
    session,
    presenceSubscription,
    policy,
    assets: createMissionAssets(),
    gameplay,
    completion,
  });

  assert.equal(runtime.route.mode, "local-fallback");
  assert.equal(runtime.handoff.launchMode, "local-fallback");
  assert.equal(runtime.scene.title, "unknown-mission");
  assert.equal(runtime.gameplay.lifecycle.status, "briefing");
  assert.equal(runtime.completion.outcome.status, "pending");
  assert.equal(runtime.completion.rewards.placeholders.length, 3);
  assert.equal(runtime.completion.rewards.summary.summary.placeholderCount, 3);
  assert.equal(runtime.gameplay.source.diagnostics.sequence, 0);
  assert.equal(runtime.liveSession.status, "self-paced-open");
  assert.equal(runtime.liveSession.source.kind, "local-preview");
});
