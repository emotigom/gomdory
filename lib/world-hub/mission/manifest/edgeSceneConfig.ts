import { ZodError } from "zod";

import type {
  MissionRoomEdgeSceneTemplate,
  MissionRoomLoadedSceneConfig,
  MissionRoomRouteSeed,
  MissionRoomSceneConfigLoader,
} from "@/lib/world-hub/mission/contracts";
import {
  parseMissionRoomEdgeSceneTemplate,
  parseMissionRoomLoadedSceneConfig,
} from "@/lib/world-hub/mission/contracts";
import { getLocalMissionSceneSnapshot } from "@/lib/world-hub/mission/manifest/localSceneSnapshot";
import { loadLocalMissionSceneConfig } from "@/lib/world-hub/mission/manifest/loadSceneConfig";

type FetchLike = typeof fetch;

type EdgeMissionSceneConfigLoaderOptions = {
  endpointBuilder?: (missionId: string) => string;
  fetcher?: FetchLike;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 1500;

function defaultEndpointBuilder(missionId: string) {
  return `/world-hub/api/missions/${encodeURIComponent(missionId)}/scene`;
}

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
    const response = await args.fetcher(args.endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    return response;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function mergeEdgeTemplate(args: {
  routeSeed: MissionRoomRouteSeed;
  edgeTemplate: MissionRoomEdgeSceneTemplate;
}): MissionRoomLoadedSceneConfig {
  const baseConfig = getLocalMissionSceneSnapshot(args.routeSeed);

  return parseMissionRoomLoadedSceneConfig({
    config: {
      ...baseConfig,
      ...args.edgeTemplate,
      metadata: [...baseConfig.metadata, ...(args.edgeTemplate.metadata ?? [])],
    },
    source: {
      kind: "edge-config",
      label: "Edge mission scene config",
      detail: `Loaded edge mission template for ${args.routeSeed.missionId}.`,
      fallbackReason: null,
    },
    loadedAtIso: new Date().toISOString(),
  });
}

async function fallbackToLocal(args: {
  routeSeed: MissionRoomRouteSeed;
  label: string;
  detail: string;
  fallbackReason: MissionRoomLoadedSceneConfig["source"]["fallbackReason"];
}) {
  return loadLocalMissionSceneConfig(args.routeSeed, {
    label: args.label,
    detail: args.detail,
    fallbackReason: args.fallbackReason,
  });
}

export async function loadEdgeBackedMissionSceneConfig(
  routeSeed: MissionRoomRouteSeed,
  options: EdgeMissionSceneConfigLoaderOptions = {},
): Promise<MissionRoomLoadedSceneConfig> {
  const endpointBuilder = options.endpointBuilder ?? defaultEndpointBuilder;
  const endpoint = endpointBuilder(routeSeed.missionId);
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetchJsonWithTimeout({ endpoint, fetcher, timeoutMs });

    if (response.status === 404 || response.status === 204) {
      return fallbackToLocal({
        routeSeed,
        label: "Local mission config fallback",
        detail: `Edge mission scene config is unavailable from ${endpoint} (${response.status}).`,
        fallbackReason: "unavailable-config",
      });
    }

    if (!response.ok) {
      return fallbackToLocal({
        routeSeed,
        label: "Local mission config fallback",
        detail: `Edge mission scene config request failed from ${endpoint} (${response.status}).`,
        fallbackReason: "edge-load-failed",
      });
    }

    const payload = await response.json();
    const edgeTemplate = parseMissionRoomEdgeSceneTemplate(payload);

    return mergeEdgeTemplate({ routeSeed, edgeTemplate });
  } catch (error) {
    if (isAbortError(error)) {
      return fallbackToLocal({
        routeSeed,
        label: "Local mission config fallback",
        detail: `Edge mission scene config request to ${endpoint} timed out after ${timeoutMs}ms.`,
        fallbackReason: "timeout",
      });
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      return fallbackToLocal({
        routeSeed,
        label: "Local mission config fallback",
        detail: `Edge mission scene config from ${endpoint} did not match the expected schema.`,
        fallbackReason: "invalid-payload",
      });
    }

    return fallbackToLocal({
      routeSeed,
      label: "Local mission config fallback",
      detail: `Edge mission scene config request failed from ${endpoint}: ${error instanceof Error ? error.message : "unknown error"}`,
      fallbackReason: "edge-load-failed",
    });
  }
}

export function createEdgeBackedMissionSceneConfigLoader(
  options: EdgeMissionSceneConfigLoaderOptions = {},
): MissionRoomSceneConfigLoader {
  return {
    loadInitialSceneConfig: (routeSeed) => loadEdgeBackedMissionSceneConfig(routeSeed, options),
  };
}
