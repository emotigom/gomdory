import { ZodError } from "zod";

import type { WorldHubLoadedManifest, WorldHubManifestLoader } from "@/lib/world-hub/contracts";
import { parseWorldHubSceneManifest } from "@/lib/world-hub/contracts";
import { loadLocalWorldHubManifest } from "@/lib/world-hub/manifest/loadManifest";

type FetchLike = typeof fetch;

type EdgeWorldHubManifestLoaderOptions = {
  endpoint?: string;
  fetcher?: FetchLike;
  timeoutMs?: number;
};

const DEFAULT_ENDPOINT = "/world-hub/api/manifest";
const DEFAULT_TIMEOUT_MS = 1500;

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

async function fallbackToLocal(args: {
  label: string;
  detail: string;
  fallbackReason: WorldHubLoadedManifest["source"]["fallbackReason"];
}) {
  return loadLocalWorldHubManifest({
    label: args.label,
    detail: args.detail,
    fallbackReason: args.fallbackReason,
  });
}

export async function loadEdgeBackedWorldHubManifest(
  options: EdgeWorldHubManifestLoaderOptions = {},
): Promise<WorldHubLoadedManifest> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetchJsonWithTimeout({ endpoint, fetcher, timeoutMs });

    if (response.status === 404 || response.status === 204) {
      return fallbackToLocal({
        label: "Bundled local manifest fallback",
        detail: `Edge world-hub manifest is unavailable from ${endpoint} (${response.status}).`,
        fallbackReason: "unavailable-config",
      });
    }

    if (!response.ok) {
      return fallbackToLocal({
        label: "Bundled local manifest fallback",
        detail: `Edge world-hub manifest request failed from ${endpoint} (${response.status}).`,
        fallbackReason: "edge-load-failed",
      });
    }

    const payload = await response.json();
    const manifest = parseWorldHubSceneManifest(payload);

    return {
      manifest,
      source: {
        kind: "edge-config",
        label: "Edge world-hub manifest",
        detail: `Loaded edge config from ${endpoint}.`,
        fallbackReason: null,
      },
      loadedAtIso: new Date().toISOString(),
    } satisfies WorldHubLoadedManifest;
  } catch (error) {
    if (isAbortError(error)) {
      return fallbackToLocal({
        label: "Bundled local manifest fallback",
        detail: `Edge world-hub manifest request to ${endpoint} timed out after ${timeoutMs}ms.`,
        fallbackReason: "timeout",
      });
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      return fallbackToLocal({
        label: "Bundled local manifest fallback",
        detail: `Edge world-hub manifest from ${endpoint} did not match the expected schema.`,
        fallbackReason: "invalid-payload",
      });
    }

    return fallbackToLocal({
      label: "Bundled local manifest fallback",
      detail: `Edge world-hub manifest request failed from ${endpoint}: ${error instanceof Error ? error.message : "unknown error"}`,
      fallbackReason: "edge-load-failed",
    });
  }
}

export function createEdgeBackedWorldHubManifestLoader(
  options: EdgeWorldHubManifestLoaderOptions = {},
): WorldHubManifestLoader {
  return {
    loadInitialManifest: () => loadEdgeBackedWorldHubManifest(options),
  };
}
