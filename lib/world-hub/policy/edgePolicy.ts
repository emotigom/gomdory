import { ZodError } from "zod";

import type { WorldHubSceneManifest } from "@/lib/world-hub/contracts";
import type {
  MissionRoomLoadedSceneConfig,
  MissionRoomRouteSeed,
} from "@/lib/world-hub/mission/contracts";
import {
  buildDeterministicLocalMissionRoomAccessPolicy,
  buildDeterministicLocalWorldHubAccessPolicy,
} from "@/lib/world-hub/policy/localPreview";
import {
  parseMissionRoomAccessPolicyResponse,
  parseMissionRoomResolvedAccessPolicy,
  parseWorldHubAccessPolicyResponse,
  parseWorldHubResolvedAccessPolicy,
  type MissionRoomAccessPolicyPort,
  type MissionRoomResolvedAccessPolicy,
  type WorldHubAccessPolicyPort,
  type WorldHubResolvedAccessPolicy,
} from "@/lib/world-hub/policy/contracts";

type FetchLike = typeof fetch;

type EdgePolicyOptions = {
  fetcher?: FetchLike;
  timeoutMs?: number;
};

type WorldHubEdgePolicyOptions = EdgePolicyOptions & {
  endpointBuilder?: (worldId: string) => string;
};

type MissionRoomEdgePolicyOptions = EdgePolicyOptions & {
  endpointBuilder?: (args: { missionId: string }) => string;
};

const DEFAULT_TIMEOUT_MS = 1200;

function isAbortError(error: unknown) {
  return error instanceof DOMException ? error.name === "AbortError" : false;
}

async function fetchJsonWithTimeout(args: {
  endpoint: string;
  fetcher: FetchLike;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    return await args.fetcher(args.endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function createWorldMismatchPolicy(args: {
  manifest: WorldHubSceneManifest;
  endpoint: string;
  responseWorldId: string;
}): WorldHubResolvedAccessPolicy {
  return parseWorldHubResolvedAccessPolicy({
    runtime: "world-hub",
    scope: {
      classId: null,
      sessionId: null,
      worldId: args.manifest.worldId,
      missionId: null,
    },
    source: {
      kind: "edge-policy",
      label: "Edge access policy rejected",
      detail: `Edge policy scope ${args.responseWorldId} from ${args.endpoint} did not match requested world ${args.manifest.worldId}.`,
      fallbackReason: "scope-mismatch",
    },
    resolution: "resolved",
    preview: {
      mode: "require-resolved-policy",
      fallback: "block",
      label: "Policy mismatch blocked",
      detail: "Runtime blocks entry when the resolved policy scope does not match the requested world.",
    },
    entry: {
      status: "blocked",
      code: "world-mismatch",
      label: "World access blocked",
      detail: `Policy world scope ${args.responseWorldId} does not match ${args.manifest.worldId}.`,
    },
    missions: args.manifest.portals.map((portal) => ({
      missionId: portal.id,
      decision: {
        status: "blocked",
        code: "world-mismatch",
        label: "Mission join blocked",
        detail: "Mission access is blocked because the world policy scope did not match the requested runtime.",
      },
    })),
    diagnostics: {
      adapterKind: "edge-policy-response",
      resolution: "resolved",
      scopeAlignment: "world-mismatch",
      evaluatedAtIso: new Date().toISOString(),
      summary: "Edge world-hub access policy was rejected because its scope did not match the requested world.",
    },
  });
}

function createMissionMismatchPolicy(args: {
  routeSeed: MissionRoomRouteSeed;
  loadedSceneConfig: MissionRoomLoadedSceneConfig;
  endpoint: string;
  responseWorldId: string;
  responseMissionId: string | null;
}): MissionRoomResolvedAccessPolicy {
  const mismatchType =
    args.responseMissionId && args.responseMissionId !== args.routeSeed.missionId ? "mission-mismatch" : "world-mismatch";

  return parseMissionRoomResolvedAccessPolicy({
    runtime: "mission-room",
    scope: {
      classId: null,
      sessionId: args.routeSeed.mode === "validated-handoff" ? args.routeSeed.handoff.sessionId : null,
      worldId: args.routeSeed.mode === "validated-handoff" ? args.routeSeed.handoff.worldId : args.responseWorldId,
      missionId: args.routeSeed.missionId,
    },
    source: {
      kind: "edge-policy",
      label: "Edge mission policy rejected",
      detail: `Edge mission policy from ${args.endpoint} did not match the requested mission/world scope.`,
      fallbackReason: "scope-mismatch",
    },
    resolution: "resolved",
    preview: {
      mode: "require-resolved-policy",
      fallback: "block",
      label: "Policy mismatch blocked",
      detail: "Mission runtime blocks entry when policy scope does not match the requested mission launch context.",
    },
    entry: {
      status: "blocked",
      code: mismatchType,
      label: "Mission access blocked",
      detail:
        mismatchType === "mission-mismatch"
          ? `Policy mission scope ${args.responseMissionId} does not match ${args.routeSeed.missionId}.`
          : `Policy world scope ${args.responseWorldId} does not match the mission launch scope.`,
    },
    diagnostics: {
      adapterKind: "edge-policy-response",
      resolution: "resolved",
      scopeAlignment: mismatchType,
      evaluatedAtIso: new Date().toISOString(),
      summary: "Edge mission-room access policy was rejected because its scope did not match the requested runtime.",
    },
  });
}

export async function resolveEdgeWorldHubAccessPolicy(
  manifest: WorldHubSceneManifest,
  options: WorldHubEdgePolicyOptions = {},
): Promise<WorldHubResolvedAccessPolicy> {
  const endpoint = (options.endpointBuilder ?? ((worldId: string) => `/world-hub/api/policy/worlds/${encodeURIComponent(worldId)}`))(
    manifest.worldId,
  );
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetchJsonWithTimeout({ endpoint, fetcher, timeoutMs });

    if (response.status === 404 || response.status === 204 || !response.ok) {
      return buildDeterministicLocalWorldHubAccessPolicy({
        manifest,
        label: "Local access snapshot fallback",
        detail: `Edge world-hub policy is unavailable from ${endpoint} (${response.status}).`,
        fallbackReason: "unavailable-policy",
        resolution: "fallback",
        adapterKind: "edge-policy-fallback",
      });
    }

    const payload = parseWorldHubAccessPolicyResponse(await response.json());
    if (payload.scope.worldId !== manifest.worldId) {
      return createWorldMismatchPolicy({
        manifest,
        endpoint,
        responseWorldId: payload.scope.worldId,
      });
    }

    return parseWorldHubResolvedAccessPolicy({
      runtime: "world-hub",
      scope: payload.scope,
      source: {
        kind: "edge-policy",
        label: "Edge world-hub access policy",
        detail: `Resolved edge classroom policy from ${endpoint}.`,
        fallbackReason: null,
      },
      resolution: "resolved",
      preview: payload.preview,
      entry: payload.entry,
      missions: payload.missions,
      diagnostics: {
        adapterKind: "edge-policy-response",
        resolution: "resolved",
        scopeAlignment: "matched",
        evaluatedAtIso: new Date().toISOString(),
        summary: "Edge world-hub access policy resolved successfully.",
      },
    });
  } catch (error) {
    if (isAbortError(error) || error instanceof ZodError || error instanceof SyntaxError) {
      return buildDeterministicLocalWorldHubAccessPolicy({
        manifest,
        label: "Local access snapshot fallback",
        detail:
          error instanceof ZodError || error instanceof SyntaxError
            ? `Edge world-hub policy from ${endpoint} did not match the expected schema.`
            : `Edge world-hub policy request to ${endpoint} timed out after ${timeoutMs}ms.`,
        fallbackReason: isAbortError(error) ? "unavailable-policy" : "invalid-policy",
        resolution: "fallback",
        adapterKind: "edge-policy-fallback",
      });
    }

    return buildDeterministicLocalWorldHubAccessPolicy({
      manifest,
      label: "Local access snapshot fallback",
      detail: `Edge world-hub policy request failed from ${endpoint}: ${error instanceof Error ? error.message : "unknown error"}`,
      fallbackReason: "unavailable-policy",
      resolution: "fallback",
      adapterKind: "edge-policy-fallback",
    });
  }
}

export async function resolveEdgeMissionRoomAccessPolicy(
  args: {
    routeSeed: MissionRoomRouteSeed;
    loadedSceneConfig: MissionRoomLoadedSceneConfig;
  },
  options: MissionRoomEdgePolicyOptions = {},
): Promise<MissionRoomResolvedAccessPolicy> {
  const endpoint = (options.endpointBuilder ?? ((input: { missionId: string }) => `/world-hub/api/policy/missions/${encodeURIComponent(input.missionId)}`))({
    missionId: args.routeSeed.missionId,
  });
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetchJsonWithTimeout({ endpoint, fetcher, timeoutMs });

    if (response.status === 404 || response.status === 204 || !response.ok) {
      return buildDeterministicLocalMissionRoomAccessPolicy({
        ...args,
        label: "Local mission policy fallback",
        detail: `Edge mission policy is unavailable from ${endpoint} (${response.status}).`,
        fallbackReason: "unavailable-policy",
        resolution: "fallback",
        adapterKind: "edge-policy-fallback",
      });
    }

    const payload = parseMissionRoomAccessPolicyResponse(await response.json());
    const expectedWorldId =
      args.routeSeed.mode === "validated-handoff" ? args.routeSeed.handoff.worldId : payload.scope.worldId;
    const hasMissionMismatch = payload.scope.missionId !== null && payload.scope.missionId !== args.routeSeed.missionId;
    const hasWorldMismatch = payload.scope.worldId !== expectedWorldId;

    if (hasMissionMismatch || hasWorldMismatch) {
      return createMissionMismatchPolicy({
        routeSeed: args.routeSeed,
        loadedSceneConfig: args.loadedSceneConfig,
        endpoint,
        responseWorldId: payload.scope.worldId,
        responseMissionId: payload.scope.missionId,
      });
    }

    return parseMissionRoomResolvedAccessPolicy({
      runtime: "mission-room",
      scope: payload.scope,
      source: {
        kind: "edge-policy",
        label: "Edge mission access policy",
        detail: `Resolved edge mission policy from ${endpoint}.`,
        fallbackReason: null,
      },
      resolution: "resolved",
      preview: payload.preview,
      entry: payload.entry,
      diagnostics: {
        adapterKind: "edge-policy-response",
        resolution: "resolved",
        scopeAlignment: "matched",
        evaluatedAtIso: new Date().toISOString(),
        summary: "Edge mission-room access policy resolved successfully.",
      },
    });
  } catch (error) {
    if (isAbortError(error) || error instanceof ZodError || error instanceof SyntaxError) {
      return buildDeterministicLocalMissionRoomAccessPolicy({
        ...args,
        label: "Local mission policy fallback",
        detail:
          error instanceof ZodError || error instanceof SyntaxError
            ? `Edge mission policy from ${endpoint} did not match the expected schema.`
            : `Edge mission policy request to ${endpoint} timed out after ${timeoutMs}ms.`,
        fallbackReason: isAbortError(error) ? "unavailable-policy" : "invalid-policy",
        resolution: "fallback",
        adapterKind: "edge-policy-fallback",
      });
    }

    return buildDeterministicLocalMissionRoomAccessPolicy({
      ...args,
      label: "Local mission policy fallback",
      detail: `Edge mission policy request failed from ${endpoint}: ${error instanceof Error ? error.message : "unknown error"}`,
      fallbackReason: "unavailable-policy",
      resolution: "fallback",
      adapterKind: "edge-policy-fallback",
    });
  }
}

export function createEdgeWorldHubAccessPolicyPort(
  options: WorldHubEdgePolicyOptions = {},
): WorldHubAccessPolicyPort {
  return {
    resolvePolicy: (manifest) => resolveEdgeWorldHubAccessPolicy(manifest, options),
  };
}

export function createEdgeMissionRoomAccessPolicyPort(
  options: MissionRoomEdgePolicyOptions = {},
): MissionRoomAccessPolicyPort {
  return {
    resolvePolicy: (args) => resolveEdgeMissionRoomAccessPolicy(args, options),
  };
}
