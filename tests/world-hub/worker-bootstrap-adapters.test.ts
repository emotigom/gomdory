import assert from "node:assert/strict";
import test from "node:test";

import { getDefaultWorldHubManifest } from "@/lib/world-hub/config/defaultManifest";
import { bootstrapWorkerBackedWorldHubSession } from "@/lib/world-hub/bootstrap/workerSession";
import { createWorldHubRuntimeInputs } from "@/lib/world-hub/runtime/runtimeInputs";
import { createEmptyMetaverseProgressSnapshot } from "@/lib/world-hub/progress/contracts";
import { defaultWorldHubAccessPolicy } from "@/lib/world-hub/policy/defaultAdapters";
import { loadR2BackedWorldHubAssets } from "@/lib/world-hub/assets/r2AssetDelivery";
import { resolveWorldHubSceneLoading } from "@/lib/world-hub/assets/sceneLoading";
import { readMetaverseLaunchControlState } from "@/lib/world-hub/launch/adapter";
import { readWorldHubSeasonalDecorationState } from "@/lib/world-hub/seasonal/adapter";
import { parseMissionRoomRouteSeed, parseMissionRoomSceneConfig } from "@/lib/world-hub/mission/contracts";
import { bootstrapWorkerBackedMissionRoom } from "@/lib/world-hub/mission/bootstrap/workerRoom";
import { resolveDeterministicLocalMissionGameplayState } from "@/lib/world-hub/mission/gameplay/localProgression";
import { resolveDeterministicLocalMissionCompletionResult } from "@/lib/world-hub/mission/completion/localCompletion";
import { createMissionRoomRuntimeInputs } from "@/lib/world-hub/mission/runtime/runtimeInputs";
import {
  createAuthoritativePresenceSubscription,
  createAuthoritativeSessionProjection,
  createLocalNoopPresenceSubscription,
} from "@/lib/world-hub/runtime/sessionProjection";


function createMissionPolicy(missionId: string) {
  return {
    runtime: "mission-room" as const,
    scope: {
      classId: null,
      sessionId: "session-1",
      worldId: "starter-world-hub",
      missionId,
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
      scopeAlignment: "matched" as const,
      evaluatedAtIso: "2026-03-21T00:00:00.000Z",
      summary: "Local mission preview policy applied.",
    },
  };
}

function createMissionAssets(missionId: string) {
  return {
    scope: "mission-room" as const,
    runtimeId: missionId,
    manifestVersion: "local-preview-v1",
    descriptors: [],
    source: {
      kind: "local-manifest" as const,
      label: "Local preview asset manifest",
      detail: null,
      fallbackReason: null,
      diagnostics: {
        scope: "mission-room" as const,
        runtimeId: missionId,
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

function createAbortableFetcher(result: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.signal) {
      init.signal.addEventListener("abort", () => {
        // noop: the promise returned below controls final rejection.
      });
    }
    return result(input, init);
  };
}

test("world-hub worker bootstrap falls back locally when worker mode is disabled", async () => {
  const manifest = {
    ...getDefaultWorldHubManifest(),
    bootstrap: {
      mode: "edge-session" as const,
      bootstrapKey: "world-edge-1",
      shardHint: "Edge shard",
    },
  };

  const resolved = await bootstrapWorkerBackedWorldHubSession(manifest, {
    enabled: false,
  });

  assert.equal(resolved.source.fallbackReason, "disabled-worker-mode");
  assert.equal(resolved.bootstrap.authority, "local-preview");
  assert.equal(resolved.bootstrap.mode, "local-single-user");
  assert.match(resolved.bootstrap.sessionId, /^local-/);
  assert.equal(resolved.bootstrap.metadata.presence.status, "inactive");
  assert.equal(resolved.bootstrap.metadata.reservation.status, "not-required");
  assert.equal(resolved.source.diagnostics.strategy, "worker-fallback");
});

test("world-hub worker bootstrap validates worker payloads and falls back on invalid schema", async () => {
  const manifest = {
    ...getDefaultWorldHubManifest(),
    bootstrap: {
      mode: "edge-session" as const,
      bootstrapKey: "world-edge-2",
      shardHint: "Edge shard",
    },
  };

  const resolved = await bootstrapWorkerBackedWorldHubSession(manifest, {
    enabled: true,
    fetcher: async () =>
      new Response(JSON.stringify({ sessionId: "broken" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });

  assert.equal(resolved.source.fallbackReason, "invalid-payload");
  assert.equal(resolved.bootstrap.authority, "local-preview");
});

test("world-hub worker bootstrap returns worker authority when payload is valid", async () => {
  const manifest = {
    ...getDefaultWorldHubManifest(),
    bootstrap: {
      mode: "edge-session" as const,
      bootstrapKey: "world-edge-3",
      shardHint: "Edge shard",
    },
  };

  const resolved = await bootstrapWorkerBackedWorldHubSession(manifest, {
    enabled: true,
    fetcher: async () =>
      new Response(
        JSON.stringify({
          sessionId: "worker-session-1",
          shardLabel: "Shard A",
          occupancy: 6,
          reactionsEnabled: true,
          nearbyPeers: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
  });

  assert.equal(resolved.source.kind, "worker-bootstrap");
  assert.equal(resolved.bootstrap.authority, "edge-worker");
  assert.equal(resolved.bootstrap.mode, "edge-session");
  assert.equal(resolved.bootstrap.metadata.authority.authorityKind, "edge-worker-preview");
  assert.equal(resolved.source.diagnostics.hasReservedPresenceChannel, false);
});

test("world-hub worker bootstrap normalizes reserved metadata into runtime inputs", async () => {
  const manifest = {
    ...getDefaultWorldHubManifest(),
    bootstrap: {
      mode: "edge-session" as const,
      bootstrapKey: "world-edge-4",
      shardHint: "Edge shard",
    },
  };

  const loadedManifest = {
    manifest,
    source: {
      kind: "local-default" as const,
      label: "Local manifest",
      detail: null,
      fallbackReason: null,
    },
    loadedAtIso: "2026-03-21T00:00:00.000Z",
  };

  const resolved = await bootstrapWorkerBackedWorldHubSession(manifest, {
    enabled: true,
    fetcher: async () =>
      new Response(
        JSON.stringify({
          sessionId: "worker-session-2",
          shardLabel: "Shard B",
          occupancy: 3,
          reactionsEnabled: true,
          nearbyPeers: [],
          extensions: {
            authority: {
              authorityKind: "edge-worker-preview",
              authorityEpochIso: "2026-03-21T00:00:00.000Z",
              ownerId: "hub-shard:worker-session-2",
              transferable: true,
            },
            presence: {
              channelKey: "presence:worker-session-2",
              transport: "worker-channel",
              subscriptionToken: "sub-1",
              snapshot: {
                observedAtIso: "2026-03-21T00:01:00.000Z",
                peers: [
                  { peerId: "worker-guide", label: "Guide", role: "guide", status: "active" },
                  { peerId: "worker-student", label: "Student A", role: "learner", status: "queued" },
                ],
              },
            },
            reservation: {
              joinTicket: "join-1",
              reservationId: "reservation-1",
              confirmationRequired: false,
            },
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
  });

  const session = createAuthoritativeSessionProjection({
    scope: "world-hub",
    runtimeId: resolved.bootstrap.sessionId,
    runtimeAuthority: resolved.bootstrap.authority,
    metadata: resolved.bootstrap.metadata,
  });
  const presenceSubscription = await createAuthoritativePresenceSubscription({
    fallback: createLocalNoopPresenceSubscription(),
  }).subscribe({ session, authorityPresence: resolved.bootstrap.presenceSnapshot });
  const context = {
    classId: null,
    worldId: manifest.worldId,
    sessionId: resolved.bootstrap.sessionId,
  };
  const [policy, assets, launchControls, seasonalDecorations] = await Promise.all([
    defaultWorldHubAccessPolicy.resolvePolicy(manifest),
    loadR2BackedWorldHubAssets({ worldId: manifest.worldId }, { enabled: false }),
    readMetaverseLaunchControlState({ context }),
    readWorldHubSeasonalDecorationState({ context, now: new Date("2026-03-21T00:00:00.000Z") }),
  ]);
  const runtime = createWorldHubRuntimeInputs({
    loadedManifest,
    bootstrap: resolved,
    policy,
    session,
    presenceSubscription,
    assets,
    sceneLoading: resolveWorldHubSceneLoading(assets),
    progress: createEmptyMetaverseProgressSnapshot(),
    launchControls,
    seasonalDecorations,
  });

  assert.equal(runtime.session.projection.authority.ownerId, "hub-shard:worker-session-2");
  assert.equal(runtime.session.projection.presence.channelKey, "presence:worker-session-2");
  assert.equal(runtime.session.projection.reservation.hasJoinTicket, true);
  assert.equal(runtime.presence.subscription.diagnostics.mode, "authoritative-bootstrap");
  assert.equal(runtime.presence.subscription.peerCount, 2);
  assert.equal(runtime.presence.subscription.peers[0]?.label, "Guide");
  assert.equal(runtime.bootstrapSource.diagnostics.hasReservedReservation, true);
});

test("mission worker bootstrap falls back on timeout", async () => {
  const routeSeed = parseMissionRoomRouteSeed({
    mode: "validated-handoff",
    missionId: "mission-orbit-lab",
    returnHubPath: "/world-hub",
    handoff: {
      version: 1,
      worldId: "starter-world-hub",
      sessionId: "session-1",
      missionId: "mission-orbit-lab",
      launchMode: "edge-bootstrap",
      bootstrapMode: "edge-bootstrap",
      issuedAtIso: "2026-03-21T00:00:00.000Z",
      portal: {
        id: "mission-orbit-lab",
        label: "Orbit Lab",
        summary: "summary",
        statusLabel: "Join mission",
        availability: "available",
        accent: "#22d3ee",
        missionRoute: "/world-hub/missions/mission-orbit-lab",
      },
    },
  });

  const loadedSceneConfig = {
    config: parseMissionRoomSceneConfig({
      missionId: "mission-orbit-lab",
      title: "Orbit Lab",
      subtitle: "subtitle",
      summary: "summary",
      accent: "#22d3ee",
      missionTypeLabel: "Mission",
      environmentLabel: "Lab",
      objectiveLabel: "Do the thing",
      statusLabel: "Queued",
      returnLabel: "Return",
      bootstrap: {
        mode: "edge-room",
        bootstrapKey: "mission-edge-1",
        roomHint: "Room A",
      },
      scene: {
        containerLabel: "Container",
        containerSummary: "Container summary",
        placeholderTitle: "Placeholder",
        placeholderBody: "Placeholder body",
      },
      metadata: [],
    }),
    source: {
      kind: "edge-config" as const,
      label: "Edge mission scene config",
      detail: "detail",
      fallbackReason: null,
    },
    loadedAtIso: "2026-03-21T00:00:00.000Z",
  };

  const resolved = await bootstrapWorkerBackedMissionRoom({
    routeSeed,
    loadedSceneConfig,
    options: {
      enabled: true,
      timeoutMs: 1,
      fetcher: createAbortableFetcher(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    },
  });

  assert.equal(resolved.source.fallbackReason, "timeout");
  assert.equal(resolved.bootstrap.authority, "local-preview");
  assert.equal(resolved.bootstrap.mode, "local-single-user");
  assert.equal(resolved.bootstrap.metadata.presence.status, "inactive");
  assert.equal(resolved.source.diagnostics.strategy, "worker-fallback");
});

test("mission worker bootstrap normalizes reserved metadata into mission runtime inputs", async () => {
  const routeSeed = parseMissionRoomRouteSeed({
    mode: "validated-handoff",
    missionId: "mission-orbit-lab",
    returnHubPath: "/world-hub",
    handoff: {
      version: 1,
      worldId: "starter-world-hub",
      sessionId: "session-1",
      missionId: "mission-orbit-lab",
      launchMode: "edge-bootstrap",
      bootstrapMode: "edge-bootstrap",
      issuedAtIso: "2026-03-21T00:00:00.000Z",
      portal: {
        id: "mission-orbit-lab",
        label: "Orbit Lab",
        summary: "summary",
        statusLabel: "Join mission",
        availability: "available",
        accent: "#22d3ee",
        missionRoute: "/world-hub/missions/mission-orbit-lab",
      },
    },
  });

  const loadedSceneConfig = {
    config: parseMissionRoomSceneConfig({
      missionId: "mission-orbit-lab",
      title: "Orbit Lab",
      subtitle: "subtitle",
      summary: "summary",
      accent: "#22d3ee",
      missionTypeLabel: "Mission",
      environmentLabel: "Lab",
      objectiveLabel: "Do the thing",
      statusLabel: "Queued",
      returnLabel: "Return",
      bootstrap: {
        mode: "edge-room",
        bootstrapKey: "mission-edge-2",
        roomHint: "Room A",
      },
      scene: {
        containerLabel: "Container",
        containerSummary: "Container summary",
        placeholderTitle: "Placeholder",
        placeholderBody: "Placeholder body",
      },
      metadata: [],
    }),
    source: {
      kind: "edge-config" as const,
      label: "Edge mission scene config",
      detail: "detail",
      fallbackReason: null,
    },
    loadedAtIso: "2026-03-21T00:00:00.000Z",
  };

  const resolved = await bootstrapWorkerBackedMissionRoom({
    routeSeed,
    loadedSceneConfig,
    options: {
      enabled: true,
      fetcher: async () =>
        new Response(
          JSON.stringify({
            roomId: "worker-room-2",
            roomLabel: "Room B",
            seatLabel: "Seat B2",
            connectionLabel: "mission connected",
            objectiveState: "ready",
            partySize: 4,
            extensions: {
              authority: {
                authorityKind: "edge-worker-preview",
                authorityEpochIso: "2026-03-21T00:00:00.000Z",
                ownerId: "mission-room:worker-room-2",
                transferable: false,
              },
              presence: {
                channelKey: "mission:worker-room-2",
                transport: "worker-channel",
                subscriptionToken: "mission-sub-1",
                snapshot: {
                  observedAtIso: "2026-03-21T00:03:00.000Z",
                  peers: [
                    { peerId: "mission-lead", label: "Lead", role: "guide", status: "active" },
                    { peerId: "mission-runner", label: "Runner", role: "learner", status: "active" },
                    { peerId: "mission-observer", label: "Observer", role: "observer", status: "idle" },
                  ],
                },
              },
              reservation: {
                joinTicket: "mission-join-2",
                reservationId: "mission-reservation-2",
                confirmationRequired: true,
              },
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    },
  });

  const session = createAuthoritativeSessionProjection({
    scope: "mission-room",
    runtimeId: resolved.bootstrap.roomId,
    runtimeAuthority: resolved.bootstrap.authority,
    metadata: resolved.bootstrap.metadata,
  });
  const presenceSubscription = await createAuthoritativePresenceSubscription({
    fallback: createLocalNoopPresenceSubscription(),
  }).subscribe({ session, authorityPresence: resolved.bootstrap.presenceSnapshot });
  const policy = createMissionPolicy(loadedSceneConfig.config.missionId);
  const gameplay = resolveDeterministicLocalMissionGameplayState({
    missionId: loadedSceneConfig.config.missionId,
    title: loadedSceneConfig.config.title,
    objectiveLabel: loadedSceneConfig.config.objectiveLabel,
    environmentLabel: loadedSceneConfig.config.environmentLabel,
    roomLabel: resolved.bootstrap.roomLabel,
    routeMode: routeSeed.mode,
    bootstrapObjectiveState: resolved.bootstrap.objectiveState,
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
    bootstrap: resolved,
    session,
    presenceSubscription,
    policy,
    assets: createMissionAssets(loadedSceneConfig.config.missionId),
    gameplay,
    completion,
  });

  assert.equal(runtime.session.authority.ownerId, "mission-room:worker-room-2");
  assert.equal(runtime.session.presence.channelKey, "mission:worker-room-2");
  assert.equal(runtime.session.reservation.activationState, "confirmation-required");
  assert.equal(runtime.presence.diagnostics.mode, "authoritative-bootstrap");
  assert.equal(runtime.presence.peerCount, 3);
  assert.equal(runtime.presence.peers[0]?.label, "Lead");
  assert.equal(runtime.completion.source.kind, "deterministic-local");
  assert.equal(runtime.bootstrapSource.diagnostics.hasReservedPresenceChannel, true);
});
