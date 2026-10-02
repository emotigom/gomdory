import { ZodError } from "zod";

import type {
  MissionRoomLoadedSceneConfig,
  MissionRoomResolvedBootstrap,
  MissionRoomRouteSeed,
  MissionRoomBootstrapPort,
  MissionRoomWorkerBootstrapRequest,
} from "@/lib/world-hub/mission/contracts";
import {
  parseMissionRoomResolvedBootstrap,
  parseMissionRoomWorkerBootstrapPayload,
  parseMissionRoomWorkerBootstrapRequest,
} from "@/lib/world-hub/mission/contracts";
import {
  createBootstrapSourceDiagnostics,
  createWorkerSessionRuntimeMetadata,
} from "@/lib/world-hub/bootstrap/sessionMetadata";
import { buildDeterministicLocalMissionRoomBootstrap } from "@/lib/world-hub/mission/bootstrap/localMission";
import { createAuthoritativePresenceSnapshotFromWorker } from "@/lib/world-hub/presence/contracts";

type FetchLike = typeof fetch;

type WorkerBackedMissionRoomBootstrapOptions = {
  endpointBuilder?: (missionId: string) => string;
  fetcher?: FetchLike;
  timeoutMs?: number;
  enabled?: boolean;
};

const DEFAULT_TIMEOUT_MS = 1500;

function defaultEndpointBuilder(missionId: string) {
  return `/world-hub/api/missions/${encodeURIComponent(missionId)}/bootstrap`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException ? error.name === "AbortError" : false;
}

function buildWorkerBootstrapRequest(args: {
  routeSeed: MissionRoomRouteSeed;
  loadedSceneConfig: MissionRoomLoadedSceneConfig;
}): MissionRoomWorkerBootstrapRequest {
  const { routeSeed, loadedSceneConfig } = args;

  return parseMissionRoomWorkerBootstrapRequest({
    missionId: loadedSceneConfig.config.missionId,
    routeMode: routeSeed.mode,
    requestedMode: loadedSceneConfig.config.bootstrap.mode,
    worldId: routeSeed.mode === "validated-handoff" ? routeSeed.handoff.worldId : null,
    sessionId: routeSeed.mode === "validated-handoff" ? routeSeed.handoff.sessionId : null,
    bootstrap: loadedSceneConfig.config.bootstrap,
  });
}

async function fetchJsonWithTimeout(args: {
  endpoint: string;
  body: MissionRoomWorkerBootstrapRequest;
  fetcher: FetchLike;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    return await args.fetcher(args.endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(args.body),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function fallbackToLocal(args: {
  routeSeed: MissionRoomRouteSeed;
  loadedSceneConfig: MissionRoomLoadedSceneConfig;
  label: string;
  detail: string;
  fallbackReason: MissionRoomResolvedBootstrap["source"]["fallbackReason"];
}) {
  return buildDeterministicLocalMissionRoomBootstrap({
    routeSeed: args.routeSeed,
    loadedSceneConfig: args.loadedSceneConfig,
    label: args.label,
    detail: args.detail,
    fallbackReason: args.fallbackReason,
  });
}

export async function bootstrapWorkerBackedMissionRoom(args: {
  routeSeed: MissionRoomRouteSeed;
  loadedSceneConfig: MissionRoomLoadedSceneConfig;
  options?: WorkerBackedMissionRoomBootstrapOptions;
}): Promise<MissionRoomResolvedBootstrap> {
  const endpointBuilder = args.options?.endpointBuilder ?? defaultEndpointBuilder;
  const endpoint = endpointBuilder(args.loadedSceneConfig.config.missionId);
  const fetcher = args.options?.fetcher ?? fetch;
  const timeoutMs = args.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const enabled = args.options?.enabled ?? false;

  if (!enabled) {
    return fallbackToLocal({
      routeSeed: args.routeSeed,
      loadedSceneConfig: args.loadedSceneConfig,
      label: "Deterministic local mission fallback",
      detail: "Worker-backed mission room bootstrap is disabled, so the runtime stayed on the deterministic local mission bootstrap path.",
      fallbackReason: "disabled-worker-mode",
    });
  }

  const requestBody = buildWorkerBootstrapRequest({
    routeSeed: args.routeSeed,
    loadedSceneConfig: args.loadedSceneConfig,
  });

  try {
    const response = await fetchJsonWithTimeout({ endpoint, body: requestBody, fetcher, timeoutMs });

    if (response.status === 404 || response.status === 204 || response.status === 501 || response.status === 503) {
      return fallbackToLocal({
        routeSeed: args.routeSeed,
        loadedSceneConfig: args.loadedSceneConfig,
        label: "Deterministic local mission fallback",
        detail: `Worker-backed mission bootstrap is unavailable from ${endpoint} (${response.status}).`,
        fallbackReason: "unavailable-bootstrap",
      });
    }

    if (!response.ok) {
      return fallbackToLocal({
        routeSeed: args.routeSeed,
        loadedSceneConfig: args.loadedSceneConfig,
        label: "Deterministic local mission fallback",
        detail: `Worker-backed mission bootstrap request failed from ${endpoint} (${response.status}).`,
        fallbackReason: "worker-request-failed",
      });
    }

    const payload = parseMissionRoomWorkerBootstrapPayload(await response.json());
    const metadata = createWorkerSessionRuntimeMetadata({
      scope: "mission-room",
      extensions: payload.extensions,
    });
    const structuredPresence = payload.extensions && "presence" in payload.extensions ? payload.extensions.presence : undefined;
    const presenceSnapshot = structuredPresence?.snapshot
      ? createAuthoritativePresenceSnapshotFromWorker(structuredPresence.snapshot)
      : null;

    return parseMissionRoomResolvedBootstrap({
      requestedMode: args.loadedSceneConfig.config.bootstrap.mode,
      bootstrap: {
        mode: args.loadedSceneConfig.config.bootstrap.mode,
        authority: "edge-worker",
        roomId: payload.roomId,
        roomLabel: payload.roomLabel,
        seatLabel: payload.seatLabel,
        connectionLabel: payload.connectionLabel,
        objectiveState: payload.objectiveState,
        partySize: payload.partySize,
        metadata,
        presenceSnapshot,
      },
      source: {
        kind: "worker-bootstrap",
        label: "Worker-backed mission bootstrap",
        detail: `Loaded mission room bootstrap from ${endpoint}.`,
        fallbackReason: null,
        diagnostics: createBootstrapSourceDiagnostics({
          strategy: "worker-response",
          endpoint,
          requestedMode: args.loadedSceneConfig.config.bootstrap.mode,
          resolvedMode: args.loadedSceneConfig.config.bootstrap.mode,
          metadata,
        }),
      },
    });
  } catch (error) {
    if (isAbortError(error)) {
      return fallbackToLocal({
        routeSeed: args.routeSeed,
        loadedSceneConfig: args.loadedSceneConfig,
        label: "Deterministic local mission fallback",
        detail: `Worker-backed mission bootstrap request to ${endpoint} timed out after ${timeoutMs}ms.`,
        fallbackReason: "timeout",
      });
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      return fallbackToLocal({
        routeSeed: args.routeSeed,
        loadedSceneConfig: args.loadedSceneConfig,
        label: "Deterministic local mission fallback",
        detail: `Worker-backed mission bootstrap from ${endpoint} did not match the expected schema.`,
        fallbackReason: "invalid-payload",
      });
    }

    return fallbackToLocal({
      routeSeed: args.routeSeed,
      loadedSceneConfig: args.loadedSceneConfig,
      label: "Deterministic local mission fallback",
      detail: `Worker-backed mission bootstrap request failed from ${endpoint}: ${error instanceof Error ? error.message : "unknown error"}`,
      fallbackReason: "worker-request-failed",
    });
  }
}

export function createWorkerBackedMissionRoomBootstrap(
  options: WorkerBackedMissionRoomBootstrapOptions = {},
): MissionRoomBootstrapPort {
  return {
    bootstrap: ({ routeSeed, loadedSceneConfig }) =>
      bootstrapWorkerBackedMissionRoom({
        routeSeed,
        loadedSceneConfig,
        options,
      }),
  };
}
