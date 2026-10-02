import { buildEduCodeHash, recordEduEvent } from "@/lib/edu/opsEvent";
import { getWebllmPaths } from "@/lib/edu/llm/webllmConfig";
import { getActiveWasmSwarm } from "@/lib/edu/netsaver/wasmSwarm";
import { recordSeedLiteHaveBroadcast } from "@/lib/edu/netsaver/metrics";
import type { NetworkSaverMode, NetworkSaverTier } from "@/lib/edu/netsaver/config";

export type PrewarmPlan = {
  wasm: boolean;
  config: boolean;
  tokenizer: boolean;
  shards: boolean;
};

type PrewarmResultStatus = "ok" | "fail" | "skip";

type PrewarmNetsaverState = {
  boardId?: string;
  shareCode?: string;
  mode?: NetworkSaverMode;
  tier?: NetworkSaverTier;
  p2pProbeStatus?: "idle" | "pass" | "fail";
  downgraded?: boolean;
};

type PrewarmProgress = {
  step: string;
  status: "running" | "done";
  remainingMs: number;
};

type PrewarmResource = {
  key: keyof PrewarmPlan;
  url: string;
  kind: "wasm" | "meta" | "small_shard";
  optional?: boolean;
};

type PrewarmRunOptions = {
  plan: PrewarmPlan;
  durationMs: number;
  netsaverState?: PrewarmNetsaverState;
  onProgress?: (progress: PrewarmProgress) => void;
  signal?: AbortSignal;
};

const JITTER_MAX_MS = 400;
const RESOURCE_TIMEOUT_MS = 5_000;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (!Number.isFinite(ms) || ms <= 0) {
      resolve();
      return;
    }
    const timeoutId = window.setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(timeoutId);
          resolve();
        },
        { once: true },
      );
    }
  });

const combineSignals = (signals: Array<AbortSignal | undefined>) => {
  const activeSignals = signals.filter(Boolean) as AbortSignal[];
  if (activeSignals.length === 0) return undefined;
  if (activeSignals.length === 1) return activeSignals[0];
  const controller = new AbortController();
  const handleAbort = () => controller.abort();
  activeSignals.forEach((signal) => {
    if (signal.aborted) {
      handleAbort();
      return;
    }
    signal.addEventListener("abort", handleAbort, { once: true });
  });
  return controller.signal;
};

const fetchWithTimeout = async (
  url: string,
  timeoutMs: number,
  options: { method?: "GET" | "HEAD"; signal?: AbortSignal } = {},
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const signal = combineSignals([controller.signal, options.signal]);
  try {
    const response = await fetch(url, { method: options.method ?? "GET", signal });
    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const formatError = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") return "timeout";
  if (error instanceof Error) return error.message.slice(0, 80);
  return "fetch_failed";
};

const buildResources = (plan: PrewarmPlan): PrewarmResource[] => {
  let paths: ReturnType<typeof getWebllmPaths> | null = null;
  try {
    paths = getWebllmPaths();
  } catch {
    return [];
  }
  const resources: PrewarmResource[] = [];
  if (plan.wasm) {
    resources.push({ key: "wasm", url: paths.wasmUrl, kind: "wasm" });
  }
  if (plan.config) {
    resources.push({
      key: "config",
      url: `${paths.modelUrl}mlc-chat-config.json`,
      kind: "meta",
    });
    resources.push({
      key: "config",
      url: `${paths.modelUrl}config.json`,
      kind: "meta",
      optional: true,
    });
  }
  if (plan.tokenizer) {
    resources.push({
      key: "tokenizer",
      url: `${paths.modelUrl}tokenizer.json`,
      kind: "meta",
    });
  }
  if (plan.shards) {
    resources.push({
      key: "shards",
      url: `${paths.modelUrl}params_shard_0.bin`,
      kind: "small_shard",
      optional: true,
    });
  }
  return resources;
};

const updateResults = (results: Record<string, PrewarmResultStatus>, key: string, status: PrewarmResultStatus) => {
  const current = results[key];
  if (current === "ok") return;
  if (current === "fail" && status === "skip") return;
  results[key] = status;
};

const shouldRetry = (error: unknown, response?: Response | null) => {
  if (response && response.status >= 500) return true;
  if (error instanceof DOMException && error.name === "AbortError") return false;
  return true;
};

export async function runPrewarm({
  plan,
  durationMs,
  netsaverState,
  onProgress,
  signal,
}: PrewarmRunOptions): Promise<{ ok: boolean; results: Record<string, PrewarmResultStatus> }> {
  const results: Record<string, PrewarmResultStatus> = {
    wasm: "skip",
    config: "skip",
    tokenizer: "skip",
    shards: "skip",
    seedLite: "skip",
  };

  const startAt = Date.now();
  const endAt = startAt + Math.max(0, durationMs);
  const overallController = new AbortController();
  const overallTimer = window.setTimeout(() => overallController.abort(), durationMs);
  const combinedSignal = combineSignals([signal, overallController.signal]);

  const boardId = netsaverState?.boardId;
  const shareCode = netsaverState?.shareCode;
  const mode = netsaverState?.mode ?? "unknown";
  const codeHash = boardId && shareCode ? await buildEduCodeHash(boardId, shareCode) : null;

  if (boardId) {
    void recordEduEvent({
      type: "prewarm_start",
      boardId,
      codeHash: codeHash ?? undefined,
      extra: {
        mode,
        durationMs,
        plan,
      },
    });
  }

  const resources = buildResources(plan);
  const warmedBuffers = new Map<string, { buffer: ArrayBuffer; kind: "wasm" | "meta"; contentType?: string }>();

  const runFetch = async (resource: PrewarmResource, attempt: number) => {
    const remainingMs = Math.max(0, endAt - Date.now());
    if (remainingMs <= 0) return { status: "skip" as const, error: "timeout" };
    await sleep(Math.random() * JITTER_MAX_MS, combinedSignal);
    const timeoutMs = Math.min(RESOURCE_TIMEOUT_MS, remainingMs);
    try {
      const method = resource.kind === "small_shard" ? "HEAD" : "GET";
      const response = await fetchWithTimeout(resource.url, timeoutMs, {
        method,
        signal: combinedSignal,
      });
      if (!response.ok) {
        if (response.status === 404 && resource.optional) {
          return { status: "skip" as const, error: "not_found" };
        }
        if (attempt < 2 && shouldRetry(null, response)) {
          return await runFetch(resource, attempt + 1);
        }
        return { status: "fail" as const, error: `HTTP ${response.status}` };
      }
      if (resource.kind !== "small_shard" && method === "GET") {
        const buffer = await response.arrayBuffer();
        const kind = resource.kind === "wasm" ? "wasm" : "meta";
        warmedBuffers.set(resource.url, {
          buffer,
          kind,
          contentType: response.headers.get("content-type") ?? undefined,
        });
      }
      return { status: "ok" as const, error: null };
    } catch (error) {
      if (combinedSignal?.aborted) {
        return { status: "skip" as const, error: "aborted" };
      }
      if (attempt < 2 && shouldRetry(error)) {
        return await runFetch(resource, attempt + 1);
      }
      return { status: "fail" as const, error: formatError(error) };
    }
  };

  let lastError: string | null = null;
  const enabledKeys = new Set<keyof PrewarmPlan>();
  (Object.keys(plan) as Array<keyof PrewarmPlan>).forEach((key) => {
    if (plan[key]) enabledKeys.add(key);
  });

  try {
    for (const resource of resources) {
      if (combinedSignal?.aborted || Date.now() >= endAt) {
        enabledKeys.forEach((key) => {
          if (results[key] === "skip") results[key] = "skip";
        });
        lastError = "timeout";
        break;
      }
      onProgress?.({
        step: resource.key,
        status: "running",
        remainingMs: Math.max(0, endAt - Date.now()),
      });
      const outcome = await runFetch(resource, 1);
      if (outcome.status !== "skip") {
        updateResults(results, resource.key, outcome.status);
      }
      if (outcome.status === "fail") {
        lastError = outcome.error ?? lastError;
      }
    }
  } catch (error) {
    lastError = formatError(error);
  } finally {
    window.clearTimeout(overallTimer);
  }

  const seedLiteEligible =
    netsaverState?.mode === "auto" && !netsaverState?.downgraded && netsaverState?.p2pProbeStatus !== "fail";

  if (seedLiteEligible) {
    try {
      const swarm = getActiveWasmSwarm();
      if (swarm && swarm.getRole() === "teacher") {
        if (swarm.getStatus() === "idle") {
          await swarm.start();
        }
        swarm.enableSeedLite();
        for (const [url, payload] of warmedBuffers.entries()) {
          await swarm.registerHave(url, payload.buffer, {
            kind: payload.kind,
            contentType: payload.contentType,
          });
          swarm.broadcastHave(url, payload.buffer.byteLength, {
            kind: payload.kind,
            contentType: payload.contentType,
          });
          recordSeedLiteHaveBroadcast();
        }
        updateResults(results, "seedLite", warmedBuffers.size > 0 ? "ok" : "skip");
      } else {
        updateResults(results, "seedLite", "skip");
      }
    } catch (error) {
      updateResults(results, "seedLite", "fail");
      lastError = formatError(error);
    }
  }

  onProgress?.({
    step: "done",
    status: "done",
    remainingMs: Math.max(0, endAt - Date.now()),
  });

  const ok = Object.entries(results).every(([key, value]) => {
    if (key === "seedLite") return value !== "fail";
    return value !== "fail";
  });

  if (boardId) {
    void recordEduEvent({
      type: "prewarm_end",
      boardId,
      codeHash: codeHash ?? undefined,
      extra: {
        mode,
        ok,
        lastError,
        results,
      },
    });
  }

  return { ok, results };
}
