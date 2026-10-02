import type * as webllm from "@mlc-ai/web-llm";
import { getWebllmModelRootUrl } from "@/lib/edu/llm/webllmAssetResolver";
import { getWebllmModelIds } from "@/lib/edu/llm/webllmConfig";
import { resolveWebllmCanonicalAssetPlan } from "@/lib/edu/llm/webllmCanonicalAssetPlan";
import { safeClearWebLLMCache, shouldInvalidateCacheVersion, writeWebLLMCacheVersion, isModelHostAsset } from "@/lib/edu/llm/webllmCache";
import {
  getEduWebLLMAutoTierFlag,
  getEduWebLLMInitTimeoutMs,
  getEduWebLLMLastGoodTtlMs,
} from "@/lib/edu/llm/webllmFeatureFlags";
import {
  clearWebLLMFailureTracking,
  getWebLLMDeviceTier,
  readWebLLMCooldownState,
  recordWebLLMInitFailure,
  type WebLLMTierDecision,
} from "@/lib/edu/llm/webllmTiering";
import {
  assertWebLLMInitAllowed,
  disableWebLLMForSession,
  getWebLLMManagerSnapshot,
  markWebLLMInitFailedSoft,
  markWebLLMInitializing,
  markWebLLMReady,
  markWebLLMResolving,
} from "@/lib/edu/llm/webllmManager";

const LAST_GOOD_KEY = "edu.webllm.lastGoodModelId";
const LAST_GOOD_TS_KEY = "edu.webllm.lastGoodModelAt";
const LAST_GOOD_REASON_KEY = "edu.webllm.lastGoodReason";
const SESSION_DISABLED_UNTIL_KEY = "edu.webllm.sessionDisabledUntil";
const SESSION_DISABLED_REASON_KEY = "edu.webllm.sessionDisabledReason";
const DEFAULT_INIT_TIMEOUT_MS = 45_000;
const SESSION_DISABLE_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const WEBLLM_DEBUG_LOG = process.env.NEXT_PUBLIC_EDU_WEBLLM_DEBUG === "1";

type WebLLMLogPayload = Record<string, unknown>;

const logWebLLM = (event: string, payload: WebLLMLogPayload) => {
  if (typeof console === "undefined") return;
  console.info("[edu] webllm", {
    event,
    ts: new Date().toISOString(),
    ...payload,
  });
};



const normalizeSelectionReason = (reason: string): "primary_first" | "singleton" | "fallback" | "disabled" => {
  if (reason === "singleton") return "singleton";
  if (reason === "disabled") return "disabled";
  if (
    reason.includes("fallback") ||
    reason.includes("last_good") ||
    reason.includes("auto_tier_lite") ||
    reason.includes("cooldown")
  ) {
    return "fallback";
  }
  return "primary_first";
};
export type WebLLMProgressState =
  | "resolving"
  | "fetching-config"
  | "fetching-wasm"
  | "initializing"
  | "first-token"
  | "ready";

export type WebLLMRuntimeInitOptions = {
  mode: "primary" | "fallback" | "auto";
  reason?: string;
  requestId?: string;
  signal?: AbortSignal;
  forcePrimary?: boolean;
  onProgress?: (state: WebLLMProgressState) => void;
};

export type WebLLMRuntimeResult = {
  engine: webllm.MLCEngine;
  selectedModelId: string;
  timers: Partial<Record<WebLLMProgressState, number>>;
  warnings: string[];
  tier: WebLLMTierDecision;
  selectionReason: string;
};

type RuntimeSingleton = {
  engine: webllm.MLCEngine;
  selectedModelId: string;
};

let singleton: RuntimeSingleton | null = null;
let inflight: Promise<WebLLMRuntimeResult> | null = null;
let webllmModulePromise: Promise<typeof import("@mlc-ai/web-llm")> | null = null;

export type WebLLMLastGoodSelection = {
  modelId: string;
  at: number;
  reason: string;
};

let lastGoodSelectionMemory: WebLLMLastGoodSelection | null = null;

const nowMs = () => performance.now();

const loadWebLLMModule = async () => {
  if (!webllmModulePromise) {
    webllmModulePromise = import("@mlc-ai/web-llm");
  }
  return webllmModulePromise;
};

const createErrorWithCode = (message: string, code: string) => {
  const error = new Error(message);
  (error as Error & { code?: string }).code = code;
  return error;
};

const mergeAbortSignals = (signals: Array<AbortSignal | undefined>) => {
  const available = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (available.length === 0) return undefined;
  if (available.length === 1) return available[0];
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of available) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
};

const markTimer = (
  timers: Partial<Record<WebLLMProgressState, number>>,
  starts: Partial<Record<WebLLMProgressState, number>>,
  state: WebLLMProgressState,
) => {
  if (starts[state] != null) {
    timers[state] = nowMs() - (starts[state] as number);
  }
};

const classifyInitError = (error: unknown) => {
  const code = error instanceof Error && "code" in error ? (error as { code?: string }).code : undefined;
  if (code === "EDU_WEBLLM_INIT_TIMEOUT") return { code, retryable: true };
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("404") || normalized.includes("cors") || normalized.includes("range")) {
    return { code: "EDU_WEBLLM_MISCONFIGURED", retryable: false };
  }
  if (normalized.includes("timeout")) return { code: "EDU_WEBLLM_INIT_TIMEOUT", retryable: true };
  if (normalized.includes("quota exceeded") || normalized.includes("quotaexceedederror")) {
    return { code: "EDU_WEBLLM_QUOTA_EXCEEDED", retryable: true };
  }
  if (normalized.includes("oom") || normalized.includes("out of memory") || normalized.includes("device lost")) {
    return { code: "EDU_WEBLLM_OOM", retryable: true };
  }
  if (normalized.includes("compile") || normalized.includes("wasm")) {
    return { code: "EDU_WEBLLM_COMPILE_FAIL", retryable: true };
  }
  return { code: "EDU_WEBLLM_INIT_FAIL", retryable: true };
};

const readLastGoodSelection = (): WebLLMLastGoodSelection | null => {
  const ttlMs = getEduWebLLMLastGoodTtlMs();
  const now = Date.now();

  if (lastGoodSelectionMemory && now - lastGoodSelectionMemory.at <= ttlMs) {
    return lastGoodSelectionMemory;
  }

  if (typeof window === "undefined") {
    lastGoodSelectionMemory = null;
    return null;
  }

  try {
    const modelId = window.localStorage.getItem(LAST_GOOD_KEY);
    const at = Number(window.localStorage.getItem(LAST_GOOD_TS_KEY) ?? "0");
    const reason = window.localStorage.getItem(LAST_GOOD_REASON_KEY) ?? "last_good";
    if (!modelId || !Number.isFinite(at) || now - at > ttlMs) {
      lastGoodSelectionMemory = null;
      return null;
    }
    const selection = { modelId, at, reason };
    lastGoodSelectionMemory = selection;
    return selection;
  } catch {
    lastGoodSelectionMemory = null;
    return null;
  }
};

const writeLastGoodSelection = (modelId: string, reason: string) => {
  const at = Date.now();
  lastGoodSelectionMemory = { modelId, at, reason };
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_GOOD_KEY, modelId);
    window.localStorage.setItem(LAST_GOOD_TS_KEY, String(at));
    window.localStorage.setItem(LAST_GOOD_REASON_KEY, reason);
  } catch {
    // ignore
  }
};


const readSessionDisableCooldownUntil = () => {
  if (typeof window === "undefined") return null;
  try {
    const value = Number(window.localStorage.getItem(SESSION_DISABLED_UNTIL_KEY) ?? "0");
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const writeSessionDisableCooldown = (reason: string, now = Date.now()) => {
  if (typeof window === "undefined") return;
  const until = now + SESSION_DISABLE_COOLDOWN_MS;
  try {
    window.localStorage.setItem(SESSION_DISABLED_UNTIL_KEY, String(until));
    window.localStorage.setItem(SESSION_DISABLED_REASON_KEY, reason);
  } catch {
    // ignore
  }
};

const clearSessionDisableCooldown = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_DISABLED_UNTIL_KEY);
    window.localStorage.removeItem(SESSION_DISABLED_REASON_KEY);
  } catch {
    // ignore
  }
};

const shouldTripAutoMitigation = (code: string | undefined) =>
  code === "EDU_WEBLLM_MISCONFIGURED";

const assertAbort = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
};

const fetchHeadOrRange = async (url: string, signal?: AbortSignal) => {
  const attempts: Array<{ method: "HEAD" | "GET"; status: number; ok: boolean; url: string }> = [];
  assertAbort(signal);
  const head = await fetch(url, { method: "HEAD", cache: "no-store", signal });
  attempts.push({ method: "HEAD", status: head.status, ok: head.ok, url });
  if (head.ok) return { response: head, attempts };
  const range = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-256" },
    cache: "no-store",
    signal,
  });
  attempts.push({ method: "GET", status: range.status, ok: range.ok, url });
  if (!range.ok) {
    throw new Error(`HTTP ${range.status} ${url} attempts=${JSON.stringify(attempts)}`);
  }
  return { response: range, attempts };
};

const resolveAssets = async (modelId: string, signal?: AbortSignal, onProgress?: (state: WebLLMProgressState) => void) => {
  const plan = resolveWebllmCanonicalAssetPlan();
  if (!plan.hasRequiredEnv || plan.statusCode === "WEBLLM_DERIVED_URL_INVALID") {
    throw new Error("EDU_WEBLLM_ENV_MISSING");
  }
  const section = [plan.primary, plan.fallback, plan.coach].find((entry) => entry?.modelId === modelId) ?? null;
  if (!section) {
    throw new Error("EDU_WEBLLM_MODEL_ID_UNKNOWN");
  }
  const modelConfigUrl = section.modelConfigUrl;
  const candidateList = section.wasmCandidateUrls.length > 0
    ? section.wasmCandidateUrls
    : section.selectedWasmUrl
      ? [section.selectedWasmUrl]
      : [];
  if (candidateList.length === 0) {
    throw new Error("EDU_WEBLLM_WASM_UNREACHABLE");
  }
  if (!isModelHostAsset(modelConfigUrl) || candidateList.some((item) => !isModelHostAsset(item))) {
    throw new Error("EDU_WEBLLM_ASSET_HOST_INVALID");
  }

  onProgress?.("fetching-config");
  const configProbe = await fetchHeadOrRange(modelConfigUrl, signal);
  const configResponse = configProbe.response;
  const configEtag = configResponse.headers.get("etag") ?? "";
  if (configEtag && shouldInvalidateCacheVersion({ modelId, configEtag })) {
    await safeClearWebLLMCache();
  }
  if (configEtag) {
    writeWebLLMCacheVersion({ modelId, configEtag, checkedAt: Date.now() });
  }

  onProgress?.("fetching-wasm");
  const wasmAttempts: Array<{ url: string; ok: boolean; status: number | null; method?: string; attempts?: unknown }> = [];
  for (const candidate of candidateList) {
    try {
      const wasmProbe = await fetchHeadOrRange(candidate, signal);
      wasmAttempts.push({
        url: candidate,
        ok: true,
        status: wasmProbe.response.status,
        method: wasmProbe.attempts[wasmProbe.attempts.length - 1]?.method,
        attempts: wasmProbe.attempts,
      });
      const resolved = { modelConfigUrl, modelRootUrl: getWebllmModelRootUrl(modelConfigUrl), wasmUrl: candidate };
      logWebLLM("resolve_assets", {
        modelId,
        modelConfigUrl,
        configAttempts: configProbe.attempts,
        wasmAttempts,
        selectedWasmUrl: candidate,
      });
      return resolved;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusMatch = message.match(/HTTP\s+(\d+)/i);
      wasmAttempts.push({ url: candidate, ok: false, status: statusMatch ? Number(statusMatch[1]) : null });
      // next
    }
  }
  logWebLLM("resolve_assets_failed", {
    modelId,
    modelConfigUrl,
    configAttempts: configProbe.attempts,
    wasmAttempts,
  });
  throw new Error("EDU_WEBLLM_WASM_UNREACHABLE");
};

const readModelQueryOverride = (): "primary" | "fallback" | null => {
  if (typeof window === "undefined") return null;
  try {
    const value = new URLSearchParams(window.location.search).get("webllm");
    if (value === "primary" || value === "fallback") return value;
  } catch {
    // ignore malformed URL failures
  }
  return null;
};

const chooseCandidates = (options: WebLLMRuntimeInitOptions, tier: WebLLMTierDecision) => {
  const { primaryModelId, fallbackModelId } = getWebllmModelIds();
  if (!primaryModelId) throw new Error("EDU_WEBLLM_MODEL_MISSING");

  if (options.mode === "primary") return { order: [primaryModelId], reason: "primary_only" };
  if (options.mode === "fallback") {
    if (!fallbackModelId) throw new Error("EDU_WEBLLM_FALLBACK_MISSING");
    return { order: [fallbackModelId], reason: "fallback_only" };
  }

  const queryOverride = readModelQueryOverride();
  if (queryOverride === "primary") {
    return {
      order: [primaryModelId, fallbackModelId].filter((value): value is string => Boolean(value)),
      reason: "query_primary",
    };
  }
  if (queryOverride === "fallback" && fallbackModelId) {
    return {
      order: [fallbackModelId, primaryModelId],
      reason: "query_fallback",
    };
  }

  const lastGood = readLastGoodSelection();
  if (lastGood && [primaryModelId, fallbackModelId].includes(lastGood.modelId)) {
    return {
      order: [lastGood.modelId, primaryModelId, fallbackModelId].filter(
        (value, idx, arr): value is string => Boolean(value) && arr.indexOf(value) === idx,
      ),
      reason: `last_good:${lastGood.reason}`,
    };
  }

  const preferFallback = getEduWebLLMAutoTierFlag() && tier.preferFallback && !options.forcePrimary;
  const preferred = preferFallback && fallbackModelId ? fallbackModelId : primaryModelId;
  const secondary = preferred === primaryModelId ? fallbackModelId : primaryModelId;
  return {
    order: [preferred, secondary].filter((value): value is string => Boolean(value)),
    reason: preferFallback ? "auto_tier_lite" : "primary_first",
  };
};

const buildEngineForModel = async (
  requestId: string,
  modelId: string,
  options: WebLLMRuntimeInitOptions,
  timers: Partial<Record<WebLLMProgressState, number>>,
  starts: Partial<Record<WebLLMProgressState, number>>,
) => {
  const timeoutMs = getEduWebLLMInitTimeoutMs() || DEFAULT_INIT_TIMEOUT_MS;
  const timeoutController = new AbortController();
  const combinedSignal = mergeAbortSignals([options.signal, timeoutController.signal]);
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);

  starts.resolving = nowMs();
  markWebLLMResolving(requestId);
  options.onProgress?.("resolving");
  try {
    const assets = await resolveAssets(modelId, combinedSignal, options.onProgress);
    markTimer(timers, starts, "resolving");

    const webllmModule = await loadWebLLMModule();
    const list = (webllmModule.prebuiltAppConfig?.model_list ?? []) as webllm.ModelRecord[];
    const record = list.find((item) => item.model_id === modelId);
    if (!record) {
      throw new Error("EDU_WEBLLM_MODEL_ID_UNKNOWN");
    }

    starts.initializing = nowMs();
    markWebLLMInitializing(requestId, modelId);
    options.onProgress?.("initializing");
    const engine = singleton?.engine ?? new webllmModule.MLCEngine();
    engine.setAppConfig({
      model_list: [
        {
          ...record,
          model: assets.modelRootUrl,
          model_lib: assets.wasmUrl,
        },
      ],
    });

    await Promise.race([
      engine.reload(modelId),
      new Promise<never>((_, reject) => {
        combinedSignal?.addEventListener(
          "abort",
          () => {
            reject(createErrorWithCode("WebLLM init timeout", "EDU_WEBLLM_INIT_TIMEOUT"));
          },
          { once: true },
        );
      }),
    ]);

    markTimer(timers, starts, "initializing");
    return engine;
  } catch (error) {
    if (timeoutController.signal.aborted && !(options.signal?.aborted)) {
      throw createErrorWithCode("WebLLM init timeout", "EDU_WEBLLM_INIT_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export async function initWebLLM(options: WebLLMRuntimeInitOptions): Promise<WebLLMRuntimeResult> {
  const sessionDisabledUntil = readSessionDisableCooldownUntil();
  if (typeof sessionDisabledUntil === "number" && sessionDisabledUntil > Date.now()) {
    const error = new Error("WebLLM disabled for this session due to model hosting diagnostics cooldown");
    (error as Error & { code?: string }).code = "EDU_WEBLLM_COOLDOWN";
    throw error;
  }

  const cooldown = readWebLLMCooldownState();
  if (cooldown.cooldownActive) {
    const error = new Error("WebLLM cooldown active after repeated failures");
    (error as Error & { code?: string }).code = "EDU_WEBLLM_COOLDOWN";
    throw error;
  }

  if (singleton && singleton.selectedModelId) {
    logWebLLM("init_reuse_singleton", {
      selectionReason: "singleton",
      normalizedSelectionReason: normalizeSelectionReason("singleton"),
      selectedModelId: singleton.selectedModelId,
    });
    return {
      engine: singleton.engine,
      selectedModelId: singleton.selectedModelId,
      timers: {},
      warnings: ["engine_reused"],
      tier: getWebLLMDeviceTier({
        deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency,
        crossOriginIsolated: typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : false,
        sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
        cooldownActive: false,
      }),
      selectionReason: "singleton",
    };
  }
  if (inflight) return inflight;

  const requestId = options.requestId ?? `webllm-${Date.now()}`;
  assertWebLLMInitAllowed(requestId);

  const run = async (): Promise<WebLLMRuntimeResult> => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const tier = getWebLLMDeviceTier({
      deviceMemory: nav.deviceMemory,
      hardwareConcurrency: nav.hardwareConcurrency,
      crossOriginIsolated: typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : false,
      sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
      cooldownActive: false,
    });
    const timers: Partial<Record<WebLLMProgressState, number>> = {};
    const starts: Partial<Record<WebLLMProgressState, number>> = {};
    const warnings: string[] = [];
    const candidates = chooseCandidates(options, tier);
    const manager = getWebLLMManagerSnapshot();
    if (WEBLLM_DEBUG_LOG) {
      logWebLLM("init_selection", {
        requestId,
        selectionReason: normalizeSelectionReason(candidates.reason),
        tier: tier.tier,
        preferFallback: tier.preferFallback,
        order: candidates.order,
        managerState: manager.state,
      });
    }

    let firstError: unknown = null;
    for (const modelId of candidates.order) {
      try {
        const engine = await buildEngineForModel(requestId, modelId, options, timers, starts);
        singleton = { engine, selectedModelId: modelId };
        writeLastGoodSelection(modelId, options.reason ?? candidates.reason);
        clearSessionDisableCooldown();
        clearWebLLMFailureTracking();
        markWebLLMReady(requestId, modelId);
        options.onProgress?.("ready");
        return {
          engine,
          selectedModelId: modelId,
          timers,
          warnings,
          tier,
          selectionReason: normalizeSelectionReason(candidates.reason),
        };
      } catch (error) {
        firstError = firstError ?? error;
        const classification = classifyInitError(error);
        warnings.push(classification.code);
        if (classification.code === "EDU_WEBLLM_MISCONFIGURED" && typeof console !== "undefined") {
          console.warn("[edu] webllm.misconfig", {
            code: classification.code,
            modelId,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        const isPrimaryModel = modelId === candidates.order[0];
        if (isPrimaryModel && shouldTripAutoMitigation(classification.code)) {
          warnings.push("AUTO_MITIGATION_PRIMARY_TO_FALLBACK");
          continue;
        }
        if (!classification.retryable || options.mode !== "auto") {
          if (shouldTripAutoMitigation(classification.code)) {
            disableWebLLMForSession(requestId, classification.code, "primary/fallback model assets unavailable");
            writeSessionDisableCooldown(classification.code);
          }
          break;
        }
      }
    }

    const classified = classifyInitError(firstError);
    if (shouldTripAutoMitigation(classified.code)) {
      disableWebLLMForSession(requestId, classified.code, "model hosting validation failed for all candidates");
      writeSessionDisableCooldown(classified.code);
    }
    const e = new Error(`WebLLM init failed (${classified.code})`);
    (e as Error & { code?: string }).code = classified.code;
    throw e;
  };

  inflight = run()
    .then((result) => {
      logWebLLM("init_success", {
        requestId,
        selectedModelId: result.selectedModelId,
        selectionReason: result.selectionReason,
        normalizedSelectionReason: normalizeSelectionReason(result.selectionReason),
        timers: result.timers,
        warnings: result.warnings,
      });
      return result;
    })
    .catch((error) => {
      const code = (error as { code?: string })?.code;
      const message = error instanceof Error ? error.message : String(error);
      markWebLLMInitFailedSoft(requestId, code, message);
      if (code !== "EDU_WEBLLM_HARD_DISABLED" && code !== "EDU_WEBLLM_SESSION_DISABLED" && code !== "EDU_WEBLLM_BACKOFF") {
        recordWebLLMInitFailure();
      }
      const normalizedSelectionReason = code === "EDU_WEBLLM_HARD_DISABLED" || code === "EDU_WEBLLM_SESSION_DISABLED" || code === "EDU_WEBLLM_BACKOFF" ? "disabled" : undefined;
      logWebLLM("init_failed", {
        requestId,
        code: code ?? "EDU_WEBLLM_INIT_FAIL",
        message,
        selectionReason: normalizedSelectionReason,
      });
      throw error;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export async function prefetchWebLLMAssets(options?: {
  signal?: AbortSignal;
}): Promise<{ ready: boolean; message: string }> {
  const { primaryModelId, fallbackModelId } = getWebllmModelIds();
  if (!primaryModelId) {
    return { ready: false, message: "모델 ID가 없어 미리 확인할 수 없습니다." };
  }

  const lastGood = readLastGoodSelection();
  const candidates = [lastGood?.modelId, primaryModelId, fallbackModelId].filter(
    (modelId, idx, arr): modelId is string => Boolean(modelId) && arr.indexOf(modelId) === idx,
  );

  for (const modelId of candidates) {
    try {
      await resolveAssets(modelId, options?.signal);
      return { ready: true, message: `Ready to load (${modelId})` };
    } catch {
      // try next model candidate
    }
  }

  return { ready: false, message: "prefetch failed" };
}

export const getWebLLMLastGoodSelection = readLastGoodSelection;

export const resetWebLLMSingleton = () => {
  singleton = null;
  lastGoodSelectionMemory = null;
};
