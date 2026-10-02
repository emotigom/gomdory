import { apiV1Path } from "@/lib/standards/pathTypes";
import {
  WEBLLM_MODEL_CONFIG_FILENAME,
  getWebllmModelRootUrl,
} from "@/lib/edu/llm/webllmAssetResolver";
import type { NetworkSaverTier } from "./config";
import {
  getNetworkSaverMetricsSnapshot,
  recordPrewarmResult,
  recordPrewarmStart,
  recordSeedLiteHaveBroadcast,
} from "./metrics";
import { getActiveWasmSwarm } from "./wasmSwarm";

type WebLLMHealthResponse =
  | {
      ok: true;
      primary: {
        modelConfigUrl: string;
        selectedWasmUrl: string | null;
        wasmCandidateUrls: string[];
      };
      fallback?: {
        modelConfigUrl: string;
        selectedWasmUrl: string | null;
        wasmCandidateUrls: string[];
      };
      coach?: {
        modelConfigUrl: string;
        selectedWasmUrl: string | null;
        wasmCandidateUrls: string[];
      };
    }
  | {
      ok: false;
      missing: string[];
      message: string;
    };

type WebLLMHealthPaths = Extract<WebLLMHealthResponse, { ok: true }>;

const resolveWasmUrl = (section: {
  selectedWasmUrl: string | null;
  wasmCandidateUrls: string[];
}) => section.selectedWasmUrl ?? section.wasmCandidateUrls[0] ?? null;

export type PrewarmResourceKind = "wasm" | "meta" | "shard";

export type PrewarmResource = {
  url: string;
  pathname: string;
  kind: PrewarmResourceKind;
};

export type PrewarmOptions = {
  code: string;
  tier: NetworkSaverTier;
  includeWasm: boolean;
  includeMeta: boolean;
  includeSmallShards: boolean;
  seedLite?: {
    autoMode: boolean;
  };
  timeoutMs?: number;
  maxResources?: number;
};

export type PrewarmProgress = {
  index: number;
  total: number;
  resource: PrewarmResource | null;
};

export type PrewarmResult = {
  okCount: number;
  failCount: number;
  lastError: string | null;
  aborted: boolean;
  resources: PrewarmResource[];
};

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_SHARD_CHECK = 6;

const toPathname = (url: string) => {
  try {
    return new URL(url, window.location.href).pathname;
  } catch {
    return url;
  }
};

const normalizeModelUrl = (value: string) => (value.endsWith("/") ? value : `${value}/`);

const dedupeResources = (items: PrewarmResource[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
};

const resolveSeedLiteSwarm = async (options: PrewarmOptions) => {
  if (!options.seedLite?.autoMode) return null;
  const metrics = getNetworkSaverMetricsSnapshot();
  if (metrics.p2pProbe.status !== "pass") return null;
  const swarm = getActiveWasmSwarm();
  if (!swarm || swarm.getRole() !== "teacher") return null;
  if (swarm.getStatus() === "idle") {
    await swarm.start();
  }
  swarm.enableSeedLite();
  return swarm;
};

const fetchWithTimeout = async (
  url: string,
  timeoutMs: number,
  options: { method?: "GET" | "HEAD"; signal?: AbortSignal } = {},
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const signals = [controller.signal, options.signal].filter(Boolean) as AbortSignal[];
  const signal =
    signals.length > 1
      ? (() => {
          const aborter = new AbortController();
          const handleAbort = () => aborter.abort();
          signals.forEach((item) => {
            if (item.aborted) handleAbort();
            item.addEventListener("abort", handleAbort, { once: true });
          });
          return aborter.signal;
        })()
      : signals[0];
  try {
    return await fetch(url, { method: options.method ?? "GET", signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const formatError = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") return "timeout";
  if (error instanceof Error) return error.message.slice(0, 80);
  return "fetch_failed";
};

const formatErrorCode = (error: unknown) => {
  if (typeof error === "string") return error.slice(0, 80);
  if (error instanceof DOMException && error.name === "AbortError") return "timeout";
  if (error instanceof Error) return error.message.slice(0, 80);
  return "fetch_failed";
};

const resolveWasmTargets = (paths: WebLLMHealthPaths) => {
  const urls = [
    resolveWasmUrl(paths.primary),
    paths.fallback ? resolveWasmUrl(paths.fallback) : null,
    paths.coach ? resolveWasmUrl(paths.coach) : null,
  ].filter(Boolean) as string[];
  return urls.map((url) => ({
    url,
    pathname: toPathname(url),
    kind: "wasm" as const,
  }));
};

const resolveMetaTargets = async (modelUrl: string, timeoutMs: number) => {
  const normalized = normalizeModelUrl(modelUrl);
  const resources: PrewarmResource[] = [
    {
      url: `${normalized}${WEBLLM_MODEL_CONFIG_FILENAME}`,
      pathname: toPathname(`${normalized}${WEBLLM_MODEL_CONFIG_FILENAME}`),
      kind: "meta",
    },
    {
      url: `${normalized}tokenizer.json`,
      pathname: toPathname(`${normalized}tokenizer.json`),
      kind: "meta",
    },
  ];
  const ndarrayUrl = `${normalized}ndarray-cache.json`;
  try {
    const head = await fetchWithTimeout(ndarrayUrl, timeoutMs, { method: "HEAD" });
    if (head.ok) {
      resources.push({
        url: ndarrayUrl,
        pathname: toPathname(ndarrayUrl),
        kind: "meta",
      });
    }
  } catch {
    // ignore optional cache errors
  }
  return resources;
};

const resolveShardTargets = async (modelUrl: string, timeoutMs: number) => {
  const normalized = normalizeModelUrl(modelUrl);
  const resources: PrewarmResource[] = [];
  for (let index = 0; index < DEFAULT_MAX_SHARD_CHECK; index += 1) {
    const shardUrl = `${normalized}params_shard_${index}.bin`;
    try {
      const head = await fetchWithTimeout(shardUrl, timeoutMs, { method: "HEAD" });
      if (head.ok) {
        resources.push({
          url: shardUrl,
          pathname: toPathname(shardUrl),
          kind: "shard",
        });
        continue;
      }
      if (head.status === 404) break;
    } catch {
      // ignore head errors and continue
    }
  }
  return resources;
};

export const buildPrewarmResources = async (
  options: PrewarmOptions,
): Promise<PrewarmResource[]> => {
  const resources: PrewarmResource[] = [];
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let data: WebLLMHealthResponse | null = null;
  try {
    const response = await fetchWithTimeout(apiV1Path("edu/webllm/health"), timeoutMs, {
      method: "GET",
    });
    if (!response.ok) {
      return resources;
    }
    data = (await response.json()) as WebLLMHealthResponse;
  } catch {
    return resources;
  }
  if (!data?.ok) {
    return resources;
  }

  if (options.includeWasm) {
    resources.push(...resolveWasmTargets(data));
  }

  const primaryModelRoot = getWebllmModelRootUrl(data.primary.modelConfigUrl);

  if (options.includeMeta && primaryModelRoot) {
    resources.push(...(await resolveMetaTargets(primaryModelRoot, timeoutMs)));
  }

  if (options.includeSmallShards && primaryModelRoot) {
    resources.push(...(await resolveShardTargets(primaryModelRoot, timeoutMs)));
  }

  return dedupeResources(resources);
};

export const runPrewarm = async (
  options: PrewarmOptions,
  onProgress?: (progress: PrewarmProgress) => void,
  signal?: AbortSignal,
): Promise<PrewarmResult> => {
  recordPrewarmStart();
  const resources = await buildPrewarmResources(options);
  let okCount = 0;
  let failCount = 0;
  let lastError: string | null = null;
  let aborted = false;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const seedLiteSwarm = await resolveSeedLiteSwarm(options);

  for (let index = 0; index < resources.length; index += 1) {
    if (signal?.aborted) {
      aborted = true;
      lastError = "aborted";
      break;
    }
    const resource = resources[index] ?? null;
    onProgress?.({ index: index + 1, total: resources.length, resource });
    if (!resource) continue;
    try {
      const response = await fetchWithTimeout(resource.url, timeoutMs, { signal });
      if (!response.ok) {
        failCount += 1;
        lastError = `HTTP ${response.status}`;
        continue;
      }
      let buffer: ArrayBuffer | null = null;
      if (resource.kind !== "shard" || options.includeSmallShards) {
        buffer = await response.arrayBuffer();
      }
      if (seedLiteSwarm && buffer && (resource.kind === "wasm" || resource.kind === "meta")) {
        const contentType = response.headers.get("content-type") ?? undefined;
        await seedLiteSwarm.registerHave(resource.url, buffer, {
          kind: resource.kind,
          contentType,
        });
        seedLiteSwarm.broadcastHave(resource.url, buffer.byteLength, {
          kind: resource.kind,
          contentType,
        });
        recordSeedLiteHaveBroadcast();
      }
      okCount += 1;
    } catch (error) {
      failCount += 1;
      lastError = formatError(error);
      if (signal?.aborted) {
        aborted = true;
        lastError = "aborted";
        break;
      }
    }
  }

  onProgress?.({ index: resources.length, total: resources.length, resource: null });
  recordPrewarmResult(okCount, failCount, lastError ? formatErrorCode(lastError) : null);

  return {
    okCount,
    failCount,
    lastError,
    aborted,
    resources,
  };
};
