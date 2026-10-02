import { ZodError } from "zod";

import type {
  WorldHubResolvedSessionBootstrap,
  WorldHubSceneManifest,
  WorldHubSessionBootstrapPort,
  WorldHubWorkerBootstrapRequest,
} from "@/lib/world-hub/contracts";
import {
  parseWorldHubResolvedSessionBootstrap,
  parseWorldHubWorkerBootstrapRequest,
  parseWorldHubWorkerSessionBootstrapPayload,
} from "@/lib/world-hub/contracts";
import {
  createBootstrapSourceDiagnostics,
  createWorkerSessionRuntimeMetadata,
} from "@/lib/world-hub/bootstrap/sessionMetadata";
import { buildDeterministicLocalWorldHubSessionBootstrap } from "@/lib/world-hub/bootstrap/localSingleUser";
import { createAuthoritativePresenceSnapshotFromWorker } from "@/lib/world-hub/presence/contracts";

type FetchLike = typeof fetch;

type WorkerBackedWorldHubSessionBootstrapOptions = {
  endpoint?: string;
  fetcher?: FetchLike;
  timeoutMs?: number;
  enabled?: boolean;
};

const DEFAULT_ENDPOINT = "/world-hub/api/session/bootstrap";
const DEFAULT_TIMEOUT_MS = 1500;

function isAbortError(error: unknown) {
  return error instanceof DOMException ? error.name === "AbortError" : false;
}

function buildWorkerBootstrapRequest(manifest: WorldHubSceneManifest): WorldHubWorkerBootstrapRequest {
  return parseWorldHubWorkerBootstrapRequest({
    worldId: manifest.worldId,
    requestedMode: manifest.bootstrap.mode,
    bootstrap: manifest.bootstrap,
  });
}

async function fetchJsonWithTimeout(args: {
  endpoint: string;
  body: WorldHubWorkerBootstrapRequest;
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
  manifest: WorldHubSceneManifest;
  label: string;
  detail: string;
  fallbackReason: WorldHubResolvedSessionBootstrap["source"]["fallbackReason"];
}) {
  return buildDeterministicLocalWorldHubSessionBootstrap({
    manifest: args.manifest,
    label: args.label,
    detail: args.detail,
    fallbackReason: args.fallbackReason,
  });
}

export async function bootstrapWorkerBackedWorldHubSession(
  manifest: WorldHubSceneManifest,
  options: WorkerBackedWorldHubSessionBootstrapOptions = {},
): Promise<WorldHubResolvedSessionBootstrap> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const enabled = options.enabled ?? false;

  if (!enabled) {
    return fallbackToLocal({
      manifest,
      label: "Deterministic local session fallback",
      detail: "Worker-backed session bootstrap is disabled, so the runtime stayed on the deterministic local bootstrap path.",
      fallbackReason: "disabled-worker-mode",
    });
  }

  const requestBody = buildWorkerBootstrapRequest(manifest);

  try {
    const response = await fetchJsonWithTimeout({ endpoint, body: requestBody, fetcher, timeoutMs });

    if (response.status === 404 || response.status === 204 || response.status === 501 || response.status === 503) {
      return fallbackToLocal({
        manifest,
        label: "Deterministic local session fallback",
        detail: `Worker-backed world-hub bootstrap is unavailable from ${endpoint} (${response.status}).`,
        fallbackReason: "unavailable-bootstrap",
      });
    }

    if (!response.ok) {
      return fallbackToLocal({
        manifest,
        label: "Deterministic local session fallback",
        detail: `Worker-backed world-hub bootstrap request failed from ${endpoint} (${response.status}).`,
        fallbackReason: "worker-request-failed",
      });
    }

    const payload = parseWorldHubWorkerSessionBootstrapPayload(await response.json());
    const metadata = createWorkerSessionRuntimeMetadata({
      scope: "world-hub",
      extensions: payload.extensions,
    });
    const structuredPresence = payload.extensions && "presence" in payload.extensions ? payload.extensions.presence : undefined;
    const presenceSnapshot = structuredPresence?.snapshot
      ? createAuthoritativePresenceSnapshotFromWorker(structuredPresence.snapshot)
      : null;

    return parseWorldHubResolvedSessionBootstrap({
      requestedMode: manifest.bootstrap.mode,
      bootstrap: {
        mode: manifest.bootstrap.mode,
        authority: "edge-worker",
        sessionId: payload.sessionId,
        shardLabel: payload.shardLabel,
        occupancy: payload.occupancy,
        reactionsEnabled: payload.reactionsEnabled,
        nearbyPeers: payload.nearbyPeers,
        metadata,
        presenceSnapshot,
      },
      source: {
        kind: "worker-bootstrap",
        label: "Worker-backed session bootstrap",
        detail: `Loaded world-hub session bootstrap from ${endpoint}.`,
        fallbackReason: null,
        diagnostics: createBootstrapSourceDiagnostics({
          strategy: "worker-response",
          endpoint,
          requestedMode: manifest.bootstrap.mode,
          resolvedMode: manifest.bootstrap.mode,
          metadata,
        }),
      },
    });
  } catch (error) {
    if (isAbortError(error)) {
      return fallbackToLocal({
        manifest,
        label: "Deterministic local session fallback",
        detail: `Worker-backed world-hub bootstrap request to ${endpoint} timed out after ${timeoutMs}ms.`,
        fallbackReason: "timeout",
      });
    }

    if (error instanceof ZodError || error instanceof SyntaxError) {
      return fallbackToLocal({
        manifest,
        label: "Deterministic local session fallback",
        detail: `Worker-backed world-hub bootstrap from ${endpoint} did not match the expected schema.`,
        fallbackReason: "invalid-payload",
      });
    }

    return fallbackToLocal({
      manifest,
      label: "Deterministic local session fallback",
      detail: `Worker-backed world-hub bootstrap request failed from ${endpoint}: ${error instanceof Error ? error.message : "unknown error"}`,
      fallbackReason: "worker-request-failed",
    });
  }
}

export function createWorkerBackedWorldHubSessionBootstrap(
  options: WorkerBackedWorldHubSessionBootstrapOptions = {},
): WorldHubSessionBootstrapPort {
  return {
    bootstrap: (manifest) => bootstrapWorkerBackedWorldHubSession(manifest, options),
  };
}
