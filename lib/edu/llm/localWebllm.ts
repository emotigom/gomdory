import * as webllm from "@mlc-ai/web-llm";
import { completeTextOnce, generateJson, withTimeout } from "./webllmClient";
import {
  getWebllmCoachModelId,
  getWebllmModelIds,
} from "./webllmConfig";
import { getWebllmModelRootUrl } from "./webllmAssetResolver";
import { resolveWebllmCanonicalAssetPlan } from "./webllmCanonicalAssetPlan";
import { selectPreferredWebLLMModel } from "./webllmStatus";
import { getGeneratorOverrideFlags } from "./diagnostics";
import { getEduWebLLMHardDisableFlag } from "./webllmFeatureFlags";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { recordEduEvent } from "@/lib/edu/opsEvent";

export type LocalChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LocalWebLLMResult =
  | {
      ok: true;
      modelId: string;
      modelChoice: LocalWebLLMModelChoice;
      usedFallback: boolean;
      autoSelected?: boolean;
      requestedModelId?: string;
      stalledAbortCount?: number;
      engineResetCount?: number;
    }
  | {
      ok: false;
      reason: "unsupported" | "config_missing" | "engine_error" | "timeout";
      message: string;
      shouldFallback: boolean;
      errorCode?: string;
      stalledAbortCount?: number;
      engineResetCount?: number;
    };

export type LocalWebLLMModelChoice = "primary" | "fallback";

export type LocalWebLLMJsonResult =
  | {
      ok: true;
      modelId: string;
      modelChoice: LocalWebLLMModelChoice;
      usedFallback: boolean;
      autoSelected?: boolean;
      requestedModelId?: string;
      usedResponseFormat: boolean;
      data: unknown;
      rawText: string;
    }
  | {
      ok: false;
      reason: "unsupported" | "config_missing" | "engine_error" | "timeout";
      message: string;
      shouldFallback: boolean;
      errorCode?: string;
    };

export type LocalWebLLMTextResult =
  | {
      ok: true;
      modelId: string;
      modelChoice: LocalWebLLMModelChoice;
      usedFallback: boolean;
      autoSelected?: boolean;
      requestedModelId?: string;
      content: string;
    }
  | {
      ok: false;
      reason: "unsupported" | "config_missing" | "engine_error" | "timeout";
      message: string;
      shouldFallback: boolean;
      errorCode?: string;
    };

type WebLLMEngine = webllm.MLCEngine;
type ChatCompletionRequestWithSignal<T extends webllm.ChatCompletionRequestBase> = T & {
  signal?: AbortSignal;
};

const FALLBACK_MESSAGE = "로컬 AI가 지금은 실행되기 어려워요. 잠시 후 다시 시도해 주세요.";
const CORS_FAILURE_MESSAGE =
  "CORS 설정 때문에 모델을 불러오지 못했어요. models.gomdory.com에 GET 허용 확인.";
const WEBGPU_DISABLED_MESSAGE = "WebGPU가 꺼져있어요. 브라우저 하드웨어 가속을 켜주세요.";
const DOWNLOAD_PROGRESS_MESSAGE = "모델 다운로드 중…(캐시되면 빨라져요)";
const PREPARE_PROGRESS_MESSAGE = "브라우저에서 모델 준비 중…(처음 1회 오래 걸려요)";
const FINAL_PROGRESS_MESSAGE = "거의 다 됐어요…";
const readEnvNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const STREAM_STALL_TIMEOUT_MS = readEnvNumber(
  process.env.NEXT_PUBLIC_EDU_COACH_WATCHDOG_MS,
  6_000,
);
const ENGINE_TIMEOUT_MS = readEnvNumber(
  process.env.NEXT_PUBLIC_EDU_WEBLLM_ENGINE_TIMEOUT_MS,
  60_000,
);
const GENERATOR_TIMEOUT_MS = readEnvNumber(
  process.env.NEXT_PUBLIC_EDU_GENERATOR_TIMEOUT_MS,
  12_000,
);
const COACH_FALLBACK_MESSAGE =
  "지금은 응답이 잠시 늦어졌어요. 잠깐 쉬었다가 다시 도전해 볼까요?";

const getHardDisabledError = () => ({
  message: "WebLLM이 운영자 kill-switch로 비활성화되었습니다.",
  code: "EDU_WEBLLM_HARD_DISABLED",
});

const enginePromises = new Map<string, Promise<{ engine: WebLLMEngine; modelId: string }>>();
const engineCache = new Map<string, WebLLMEngine>();
const modelIdAliases = new Map<string, string>();
const progressListeners = new Set<(message: string) => void>();
let lastProgressMessage = "";
let engineCleanupPromise: Promise<void> | null = null;

const isMapAsyncUnmappedError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /mapAsync/i.test(message) && /unmapped before mapping was resolved/i.test(message);
};

const isCleanupAbortError = (error: unknown) => {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
};

const isWebllmCleanupRaceError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/Buffer was unmapped before mapping was resolved/i.test(message)) {
    return true;
  }
  return isMapAsyncUnmappedError(error) || isCleanupAbortError(error);
};

const unloadEngineSafely = async (engine: WebLLMEngine) => {
  try {
    await engine.unload();
  } catch (error) {
    if (!isWebllmCleanupRaceError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error ?? "unknown");
    try {
      console.debug("[edu] webllm.cleanup_race_ignored", { message });
    } catch {
      // ignore console failures
    }
    void recordEduEvent({
      type: "webllm_cleanup_race_ignored",
      boardId: "edu_webllm",
      extra: {
        message,
        phase: "engine_unload",
      },
    });
  }
};
const transientErrorCodes = new Set([
  "EDU_WEBLLM_PREFLIGHT_MODEL_FAILED",
  "EDU_WEBLLM_PREFLIGHT_WASM_FAILED",
  "EDU_WEBLLM_ENGINE_INIT_FAILED",
]);

type WebLLMHealthSection = {
  modelId: string;
  modelConfigUrl: string;
  selectedWasmUrl: string | null;
  wasmCandidateUrls: string[];
};

type WebLLMHealthResponse = {
  ok: boolean;
  hardDisabled?: boolean;
  primary?: WebLLMHealthSection;
  fallback?: WebLLMHealthSection;
  coach?: WebLLMHealthSection;
};

const HEALTH_CACHE_MAX_AGE_MS = 15_000;
let cachedHealthResponse: { at: number; data: WebLLMHealthResponse } | null = null;

async function fetchWebllmHealth(): Promise<WebLLMHealthResponse | null> {
  const now = Date.now();
  if (cachedHealthResponse && now - cachedHealthResponse.at < HEALTH_CACHE_MAX_AGE_MS) {
    return cachedHealthResponse.data;
  }
  const response = await fetch(apiV1Path("edu/webllm/health"), {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as WebLLMHealthResponse | null;
  if (!payload) return null;
  cachedHealthResponse = { at: now, data: payload };
  return payload;
}

async function resolveWebllmPathsWithHealthFallback(modelId: string): Promise<{ modelUrl: string; wasmCandidates: string[] }> {
  try {
    const canonicalPlan = resolveWebllmCanonicalAssetPlan();
    const section = [canonicalPlan.primary, canonicalPlan.fallback, canonicalPlan.coach].find(
      (entry) => entry?.modelId === modelId,
    );
    if (!section) {
      const error = new Error("모델 ID가 canonical plan에 없어요.");
      (error as Error & { code?: string }).code = "EDU_WEBLLM_ENV_MISSING";
      throw error;
    }
    const envCandidates = section.wasmCandidateUrls;
    return {
      modelUrl: section.modelRootUrl,
      wasmCandidates: envCandidates.length > 0 ? envCandidates : section.selectedWasmUrl ? [section.selectedWasmUrl] : [],
    };
  } catch (error) {
    if (getErrorCode(error) !== "EDU_WEBLLM_ENV_MISSING") {
      throw error;
    }
    const health = await fetchWebllmHealth();
    if (!health?.ok || health.hardDisabled === true) {
      throw error;
    }
    const sections = [health.primary, health.fallback, health.coach].filter(
      (section): section is WebLLMHealthSection => Boolean(section),
    );
    const matched = sections.find((section) => section.modelId === modelId);
    if (!matched?.modelConfigUrl) {
      const wrapped = new Error("health 응답에서 모델 경로를 찾지 못했어요.");
      (wrapped as Error & { code?: string; cause?: unknown }).code = "EDU_WEBLLM_HEALTH_FALLBACK_UNAVAILABLE";
      (wrapped as Error & { cause?: unknown }).cause = error;
      throw wrapped;
    }
    const wasmCandidates = [matched.selectedWasmUrl, ...(matched.wasmCandidateUrls ?? [])].filter(
      (value): value is string => Boolean(value),
    );
    if (wasmCandidates.length === 0) {
      const wrapped = new Error("health 응답에서 wasm 경로를 찾지 못했어요.");
      (wrapped as Error & { code?: string; cause?: unknown }).code = "EDU_WEBLLM_HEALTH_FALLBACK_UNAVAILABLE";
      (wrapped as Error & { cause?: unknown }).cause = error;
      throw wrapped;
    }
    return {
      modelUrl: getWebllmModelRootUrl(matched.modelConfigUrl),
      wasmCandidates,
    };
  }
}

type EngineLoadResult = {
  engine: WebLLMEngine;
  modelId: string;
  choice: LocalWebLLMModelChoice;
  shouldNoticeFallback: boolean;
  autoSelected?: boolean;
  requestedModelId?: string;
};

export type LocalWebLLMDiagnostics = {
  coach: {
    modelId: string | null;
    loaded: boolean;
    lastSuccessAt: number | null;
  };
  generator: {
    modelId: string | null;
    primaryLoaded: boolean;
    fallbackLoaded: boolean;
    lastSuccessAt: number | null;
  };
  modelIds: {
    primary: string;
    fallback: string | null;
  };
  loadedModelIds: string[];
  lastRequestDurations: {
    coachMs: number | null;
    generatorMs: number | null;
  };
  recentCounts: {
    coachStallAborts: number;
    generatorTimeouts: number;
    fallbackUsed: number;
    insuranceTemplateApplied: number;
    engineResets: number;
  };
  lastError: {
    scope: "coach" | "generator";
    message: string;
    code?: string;
    at: number;
  } | null;
};

const diagnosticsState = {
  lastCoachModelId: null as string | null,
  lastGeneratorModelId: null as string | null,
  lastCoachDurationMs: null as number | null,
  lastGeneratorDurationMs: null as number | null,
  lastError: null as LocalWebLLMDiagnostics["lastError"],
};

type MetricEntry = { at: number; count: number };

const METRIC_WINDOW_MS = 5 * 60 * 1000;

const metricsState = {
  coachStallAborts: [] as MetricEntry[],
  generatorTimeouts: [] as MetricEntry[],
  fallbackUsed: [] as MetricEntry[],
  insuranceApplied: [] as MetricEntry[],
  engineResets: [] as MetricEntry[],
  lastSuccessAt: {
    coach: null as number | null,
    generator: null as number | null,
  },
};

const pruneMetrics = (entries: MetricEntry[], now = Date.now()) => {
  const cutoff = now - METRIC_WINDOW_MS;
  while (entries.length > 0 && entries[0].at < cutoff) {
    entries.shift();
  }
};

const recordMetric = (entries: MetricEntry[], count = 1) => {
  if (!Number.isFinite(count) || count <= 0) return;
  const now = Date.now();
  entries.push({ at: now, count });
  pruneMetrics(entries, now);
};

const countMetric = (entries: MetricEntry[]) => {
  pruneMetrics(entries);
  return entries.reduce((sum, entry) => sum + entry.count, 0);
};

const recordSuccess = (scope: "coach" | "generator") => {
  metricsState.lastSuccessAt[scope] = Date.now();
};

const recordFallbackUsed = () => recordMetric(metricsState.fallbackUsed, 1);
const recordGeneratorTimeout = () => recordMetric(metricsState.generatorTimeouts, 1);
const recordCoachStallAborts = (count: number) =>
  recordMetric(metricsState.coachStallAborts, count);
const recordEngineReset = () => recordMetric(metricsState.engineResets, 1);

export const recordInsuranceTemplateApplied = () =>
  recordMetric(metricsState.insuranceApplied, 1);

function isLikelyCorsError(error: unknown) {
  if (error instanceof TypeError && /Failed to fetch|NetworkError/i.test(error.message)) {
    return true;
  }
  if (error instanceof Error && "cause" in error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    return cause instanceof TypeError && /Failed to fetch|NetworkError/i.test(cause.message);
  }
  return false;
}

function getErrorCode(error: unknown) {
  return error instanceof Error && "code" in error ? (error as { code?: string }).code : undefined;
}

function isTimeoutError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") return true;
    return /abort|aborted|timeout/i.test(error.message);
  }
  return false;
}

function isGeneratorSchemaError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /response_format|JSON|json|schema|스키마/i.test(error.message);
}

function mergeAbortSignals(signal?: AbortSignal) {
  const controller = new AbortController();
  let externalAbort = false;
  const onAbort = () => {
    externalAbort = true;
    controller.abort();
  };
  if (signal) {
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort);
    }
  }
  return {
    signal: controller.signal,
    wasExternalAbort: () => externalAbort,
    abort: () => controller.abort(),
    cleanup: () => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    },
  };
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error) {
    return error.name === "AbortError";
  }
  return false;
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort);
    promise
      .then((value) => {
        cleanup();
        resolve(value);
      })
      .catch((error) => {
        cleanup();
        reject(error);
      });
  });
}

async function fetchOk(url: string) {
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

const fetchHeadOrGet = async (url: string) => {
  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (head.ok) {
      return { ok: true, status: head.status };
    }
  } catch {
    // ignore and fallback to GET
  }

  try {
    const get = await fetch(url, { method: "GET", cache: "no-store" });
    return { ok: get.ok, status: get.status };
  } catch (error) {
    return { ok: false, status: 0, error };
  }
};

async function preflightModelConfig(modelUrl: string) {
  const candidates = ["mlc-chat-config.json", "chat-config.json", "ndarray-cache.json"];
  let lastError: unknown = null;
  const attemptedUrls: string[] = [];
  for (const candidate of candidates) {
    const url = `${modelUrl}${candidate}`;
    attemptedUrls.push(url);
    try {
      await fetchOk(url);
      return;
    } catch (error) {
      lastError = error;
      // keep checking remaining candidates
    }
  }

  const error = new Error(
    `모델 설정 파일을 찾지 못했어요. R2 업로드 경로를 확인해 주세요. 요청: ${attemptedUrls.join(
      ", ",
    )}`,
  );
  (error as Error & { code?: string; cause?: unknown }).code = "EDU_WEBLLM_PREFLIGHT_MODEL_FAILED";
  (error as Error & { cause?: unknown }).cause = lastError ?? undefined;
  throw error;
}

async function preflightWasm(wasmCandidates: string[]) {
  let lastError: unknown = null;
  for (const wasmUrl of wasmCandidates) {
    const result = await fetchHeadOrGet(wasmUrl);
    if (result.ok) {
      return wasmUrl;
    }
    lastError = result.error ?? new Error(`HTTP ${result.status}`);
  }
  const error = new Error("WASM 파일을 불러오지 못했어요. R2 업로드 경로를 확인해 주세요.");
  (error as Error & { code?: string; cause?: unknown }).code = "EDU_WEBLLM_PREFLIGHT_WASM_FAILED";
  (error as Error & { cause?: unknown }).cause = lastError ?? undefined;
  throw error;
}

function emitProgress(message: string) {
  if (!message || message === lastProgressMessage) return;
  lastProgressMessage = message;
  for (const listener of progressListeners) {
    listener(message);
  }
}

const clampProgress = (progress: number) => Math.min(1, Math.max(0, progress));
const toPct = (progress: number) => Math.round(progress * 100);
const bucketPct = (pct: number, bucketSize = 5) => Math.floor(pct / bucketSize) * bucketSize;
const formatPct = (bucket: number) => String(bucket).padStart(2, "0");

function mapProgressMessage(report: webllm.InitProgressReport | null | undefined) {
  if (!report) return null;
  const rawProgress = typeof report.progress === "number" ? report.progress : 0;
  const progress = clampProgress(Number.isFinite(rawProgress) ? rawProgress : 0);
  const pct = toPct(progress);
  const bucket = bucketPct(pct);
  const pctStr = formatPct(Math.min(100, Math.max(0, bucket)));
  const fallbackMessage =
    progress >= 0.9
      ? FINAL_PROGRESS_MESSAGE
      : progress >= 0.55
        ? PREPARE_PROGRESS_MESSAGE
        : DOWNLOAD_PROGRESS_MESSAGE;
  if (!Number.isFinite(rawProgress)) return fallbackMessage;
  if (progress >= 0.9) return `거의 다 됐어요… ${pctStr}%`;
  if (progress >= 0.55) return `브라우저에서 모델 준비 중… ${pctStr}%`;
  return `모델 다운로드 중… ${pctStr}%`;
}

async function ensureEngineReady(modelId: string): Promise<{ engine: WebLLMEngine; modelId: string }> {
  const resolvedId = modelIdAliases.get(modelId) ?? modelId;
  const list = (webllm.prebuiltAppConfig?.model_list ?? []) as webllm.ModelRecord[];
  const selection = selectPreferredWebLLMModel(list, resolvedId);
  if (!selection.modelId) {
    const error = new Error("로컬 모델 정보를 찾지 못했어요. 모델 ID를 확인해 주세요.");
    (error as Error & { code?: string }).code = "EDU_WEBLLM_MODEL_ID_UNKNOWN";
    throw error;
  }
  if (selection.autoSelected && selection.modelId !== resolvedId) {
    modelIdAliases.set(resolvedId, selection.modelId);
  }
  const finalModelId = selection.modelId;

  const existing = enginePromises.get(finalModelId) ?? enginePromises.get(resolvedId);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const { modelUrl, wasmCandidates } = await resolveWebllmPathsWithHealthFallback(finalModelId);
    const rec = list.find((item) => item.model_id === finalModelId);
    if (!rec) {
      const error = new Error("로컬 모델 정보를 찾지 못했어요. 모델 ID를 확인해 주세요.");
      (error as Error & { code?: string }).code = "EDU_WEBLLM_MODEL_ID_UNKNOWN";
      throw error;
    }

    emitProgress(DOWNLOAD_PROGRESS_MESSAGE);
    await preflightModelConfig(modelUrl);
    const resolvedWasmUrl = await preflightWasm(wasmCandidates);

    const patchedRec: webllm.ModelRecord = {
      ...rec,
      model: modelUrl,
      model_lib: resolvedWasmUrl,
    };

    const appConfig = { model_list: [patchedRec] };

    try {
      const engine = await webllm.CreateMLCEngine(finalModelId, {
        appConfig,
        initProgressCallback: (report) => {
          const message = mapProgressMessage(report);
          if (message) emitProgress(message);
        },
      });

      engineCache.set(finalModelId, engine);
      return { engine, modelId: finalModelId };
    } catch (error) {
      const wrapped = new Error(
        error instanceof Error ? error.message : "엔진 초기화에 실패했습니다.",
      );
      (wrapped as Error & { code?: string; cause?: unknown }).code = "EDU_WEBLLM_ENGINE_INIT_FAILED";
      (wrapped as Error & { cause?: unknown }).cause = error;
      throw wrapped;
    }
  })();

  enginePromises.set(resolvedId, promise);
  enginePromises.set(finalModelId, promise);

  promise.finally(() => {
    progressListeners.clear();
    lastProgressMessage = "";
  });

  return promise;
}

function recordError(scope: "coach" | "generator", error: unknown) {
  const code = getErrorCode(error);
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : FALLBACK_MESSAGE;
  diagnosticsState.lastError = {
    scope,
    message,
    code,
    at: Date.now(),
  };
}

const logCoachStreamEvent = (stage: string, detail?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  try {
    console.info("[edu][coach_stream]", { stage, ...detail });
  } catch {
    // ignore logging failures
  }
};

function recordDuration(scope: "coach" | "generator", durationMs: number, modelId?: string) {
  if (!Number.isFinite(durationMs)) return;
  if (scope === "coach") {
    diagnosticsState.lastCoachDurationMs = durationMs;
    if (modelId) diagnosticsState.lastCoachModelId = modelId;
  } else {
    diagnosticsState.lastGeneratorDurationMs = durationMs;
    if (modelId) diagnosticsState.lastGeneratorModelId = modelId;
  }
}

export async function disposeAllLocalWebLLMEngines() {
  if (engineCleanupPromise) {
    await engineCleanupPromise;
    return;
  }
  engineCleanupPromise = (async () => {
    const modelIds = Array.from(new Set([...engineCache.keys(), ...enginePromises.keys()]));
    await Promise.all(
      modelIds.map(async (modelId) => {
        const engine = engineCache.get(modelId);
        if (engine) {
          try {
            await unloadEngineSafely(engine);
          } catch {
            // ignore unload failures
          }
        }
        engineCache.delete(modelId);
        enginePromises.delete(modelId);
      }),
    );
    progressListeners.clear();
    lastProgressMessage = "";
  })();
  try {
    await engineCleanupPromise;
  } finally {
    engineCleanupPromise = null;
  }
}

export async function resetLocalWebLLMEngine(scope: "coach" | "generator") {
  const { primaryModelId, fallbackModelId } = getWebllmModelIds();
  const targets =
    scope === "coach"
      ? [diagnosticsState.lastCoachModelId ?? primaryModelId]
      : [
          diagnosticsState.lastGeneratorModelId ?? primaryModelId,
          fallbackModelId ?? null,
        ].filter((value): value is string => Boolean(value));

  for (const modelId of targets) {
    const engine = engineCache.get(modelId);
    if (engine) {
      try {
        await unloadEngineSafely(engine);
      } catch {
        // ignore unload failures
      }
      engineCache.delete(modelId);
    }
    enginePromises.delete(modelId);
  }

  if (diagnosticsState.lastError?.scope === scope) {
    diagnosticsState.lastError = null;
  }
  if (scope === "coach") {
    metricsState.coachStallAborts = [];
  }
  if (scope === "generator") {
    metricsState.generatorTimeouts = [];
  }
}

export function getLocalWebLLMDiagnostics(): LocalWebLLMDiagnostics {
  const { primaryModelId, fallbackModelId } = getWebllmModelIds();
  const coachModelId = diagnosticsState.lastCoachModelId;
  const generatorModelId = diagnosticsState.lastGeneratorModelId;
  return {
    coach: {
      modelId: coachModelId,
      loaded: coachModelId ? engineCache.has(coachModelId) : false,
      lastSuccessAt: metricsState.lastSuccessAt.coach,
    },
    generator: {
      modelId: generatorModelId,
      primaryLoaded: engineCache.has(primaryModelId),
      fallbackLoaded: Boolean(fallbackModelId && engineCache.has(fallbackModelId)),
      lastSuccessAt: metricsState.lastSuccessAt.generator,
    },
    modelIds: {
      primary: primaryModelId,
      fallback: fallbackModelId ?? null,
    },
    loadedModelIds: Array.from(engineCache.keys()),
    lastRequestDurations: {
      coachMs: diagnosticsState.lastCoachDurationMs,
      generatorMs: diagnosticsState.lastGeneratorDurationMs,
    },
    recentCounts: {
      coachStallAborts: countMetric(metricsState.coachStallAborts),
      generatorTimeouts: countMetric(metricsState.generatorTimeouts),
      fallbackUsed: countMetric(metricsState.fallbackUsed),
      insuranceTemplateApplied: countMetric(metricsState.insuranceApplied),
      engineResets: countMetric(metricsState.engineResets),
    },
    lastError: diagnosticsState.lastError,
  };
}

function shouldAttemptFallback(error: unknown) {
  if (getErrorCode(error) && transientErrorCodes.has(getErrorCode(error) ?? "")) {
    return true;
  }
  if (isLikelyCorsError(error)) return true;
  if (error instanceof Error) {
    return /timeout|fetch|network|wasm|init/i.test(error.message);
  }
  return false;
}

async function ensureEngineReadyWithFallback(options: {
  preferredModelId?: string;
  signal?: AbortSignal;
}): Promise<EngineLoadResult> {
  const { primaryModelId, fallbackModelId } = getWebllmModelIds();
  const preferred = options.preferredModelId ?? primaryModelId;
  const isPreferredPrimary = preferred === primaryModelId;
  const primaryTarget = isPreferredPrimary ? primaryModelId : preferred;
  const fallbackTarget = isPreferredPrimary ? fallbackModelId : primaryModelId;

  const attemptPrimary = async () => {
    const engineData = await raceWithAbort(ensureEngineReady(primaryTarget), options.signal);
    const choice: LocalWebLLMModelChoice =
      engineData.modelId === primaryModelId ? "primary" : "fallback";
    const autoSelected = engineData.modelId !== primaryTarget;
    return {
      ...engineData,
      choice,
      shouldNoticeFallback: autoSelected,
      autoSelected,
      requestedModelId: primaryTarget,
    };
  };

  try {
    return await attemptPrimary();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (!fallbackTarget || !shouldAttemptFallback(error)) {
      throw error;
    }
    const engineData = await raceWithAbort(ensureEngineReady(fallbackTarget), options.signal);
    const choice: LocalWebLLMModelChoice =
      engineData.modelId === primaryModelId ? "primary" : "fallback";
    const autoSelected = engineData.modelId !== fallbackTarget;
    return {
      ...engineData,
      choice,
      shouldNoticeFallback: true,
      autoSelected,
      requestedModelId: fallbackTarget,
    };
  }
}

export async function warmupLocalWebLLMEngine(options: {
  preferredModelId?: string;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; modelId?: string; usedFallback?: boolean; message?: string }> {
  const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  if (!hasWebGPU) {
    return { ok: false, message: WEBGPU_DISABLED_MESSAGE };
  }
  if (getEduWebLLMHardDisableFlag()) {
    const disabled = getHardDisabledError();
    return { ok: false, message: disabled.message };
  }

  if (options.onProgress) {
    progressListeners.add(options.onProgress);
  }

  try {
    const { modelId, shouldNoticeFallback } = await ensureEngineReadyWithFallback({
      preferredModelId: options.preferredModelId,
      signal: options.signal,
    });
    return { ok: true, modelId, usedFallback: shouldNoticeFallback };
  } catch (error) {
    if (isAbortError(error)) {
      return { ok: false, message: FALLBACK_MESSAGE };
    }
    const code = getErrorCode(error);
    if (code === "EDU_WEBLLM_ENV_MISSING" || code === "EDU_WEBLLM_MODEL_ID_UNKNOWN") {
      return { ok: false, message: error instanceof Error ? error.message : FALLBACK_MESSAGE };
    }
    if (isLikelyCorsError(error)) {
      return { ok: false, message: CORS_FAILURE_MESSAGE };
    }
    return { ok: false, message: error instanceof Error ? error.message : FALLBACK_MESSAGE };
  } finally {
    if (options.onProgress) {
      progressListeners.delete(options.onProgress);
    }
  }
}

export async function streamLocalWebLLMChat(options: {
  messages: LocalChatMessage[];
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
  temperature?: number;
  onProgress?: (message: string) => void;
  preferredModelId?: string;
  stallTimeoutMs?: number;
}): Promise<LocalWebLLMResult> {
  const startedAt = performance.now();
  const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  if (!hasWebGPU) {
    recordError("coach", WEBGPU_DISABLED_MESSAGE);
    return {
      ok: false,
      reason: "unsupported",
      message: WEBGPU_DISABLED_MESSAGE,
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_UNSUPPORTED",
    };
  }
  if (getEduWebLLMHardDisableFlag()) {
    const disabled = getHardDisabledError();
    recordError("coach", disabled.message);
    return {
      ok: false,
      reason: "engine_error",
      message: disabled.message,
      shouldFallback: true,
      errorCode: disabled.code,
    };
  }

  if (options.signal?.aborted) {
    recordError("coach", FALLBACK_MESSAGE);
    return {
      ok: false,
      reason: "timeout",
      message: FALLBACK_MESSAGE,
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_TIMEOUT",
      stalledAbortCount: 0,
    };
  }

  const hasInvalidSystemMessage =
    options.messages[0]?.role !== "system" ||
    options.messages.slice(1).some((message) => message.role === "system");
  if (hasInvalidSystemMessage) {
    recordError("coach", "system 메시지는 첫 번째여야 합니다.");
    return {
      ok: false,
      reason: "config_missing",
      message: "system 메시지는 첫 번째여야 합니다.",
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_CONFIG_INVALID",
      stalledAbortCount: 0,
    };
  }

  const lastMessage = options.messages[options.messages.length - 1];
  const lastRole = (lastMessage as { role?: string } | undefined)?.role;
  if (!lastMessage || (lastRole !== "user" && lastRole !== "tool")) {
    recordError("coach", "마지막 메시지는 user/tool이어야 합니다.");
    return {
      ok: false,
      reason: "config_missing",
      message: "마지막 메시지는 user/tool이어야 합니다.",
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_CONFIG_INVALID",
      stalledAbortCount: 0,
    };
  }

  if (options.onProgress) {
    progressListeners.add(options.onProgress);
  }

  try {
    const stallTimeoutMs = options.stallTimeoutMs ?? STREAM_STALL_TIMEOUT_MS;
    let attempt = 0;
    let stalledAbortCount = 0;
    let engineResetCount = 0;
    const coachModelId = getWebllmCoachModelId();
    let engineData = await ensureEngineReadyWithFallback({
      preferredModelId: options.preferredModelId ?? coachModelId,
      signal: options.signal,
    });

    while (attempt < 2) {
      const controller = mergeAbortSignals(options.signal);
      let stalled = false;
      let lastTokenAt = Date.now();
      const watchdog = globalThis.setInterval(() => {
        if (!stalled && Date.now() - lastTokenAt > stallTimeoutMs) {
          stalled = true;
          stalledAbortCount += 1;
          logCoachStreamEvent("coach_stream_stall_detected", {
            stallMs: Date.now() - lastTokenAt,
            modelId: engineData.modelId,
          });
          controller.abort();
        }
      }, 1000);

      try {
        const stream = (await engineData.engine.chat.completions.create({
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          stream: true,
          signal: controller.signal,
        } as ChatCompletionRequestWithSignal<webllm.ChatCompletionRequestStreaming>)) as AsyncIterable<{
          choices?: Array<{ delta?: { content?: string } }>;
        }>;

        for await (const chunk of stream) {
          if (controller.signal.aborted) {
            throw new Error("stream aborted");
          }
          const delta = chunk?.choices?.[0]?.delta?.content;
          if (delta) {
            lastTokenAt = Date.now();
            options.onChunk(delta);
          }
        }

        globalThis.clearInterval(watchdog);
        controller.cleanup();
        recordDuration("coach", performance.now() - startedAt, engineData.modelId);
        recordSuccess("coach");
        if (engineData.shouldNoticeFallback) {
          recordFallbackUsed();
        }
        recordCoachStallAborts(stalledAbortCount);
        return {
          ok: true,
          modelId: engineData.modelId,
          modelChoice: engineData.choice,
          usedFallback: engineData.shouldNoticeFallback,
          autoSelected: engineData.autoSelected,
          requestedModelId: engineData.requestedModelId,
          stalledAbortCount,
          engineResetCount,
        };
      } catch (error) {
        globalThis.clearInterval(watchdog);
        controller.cleanup();
        if (controller.wasExternalAbort()) {
          recordError("coach", FALLBACK_MESSAGE);
          recordCoachStallAborts(stalledAbortCount);
          return {
            ok: false,
            reason: "timeout",
            message: FALLBACK_MESSAGE,
            shouldFallback: false,
            errorCode: "EDU_WEBLLM_TIMEOUT",
            stalledAbortCount,
            engineResetCount,
          };
        }
        if (stalled || /abort/i.test(error instanceof Error ? error.message : "")) {
          attempt += 1;
          engineResetCount += 1;
          recordEngineReset();
          logCoachStreamEvent("coach_stream_abort", {
            attempt,
            modelId: engineData.modelId,
          });
          try {
            await resetLocalWebLLMEngine("coach");
          } catch {
            // ignore reset failures
          }
          if (attempt < 2) {
            logCoachStreamEvent("coach_stream_retry", {
              attempt,
              modelId: engineData.modelId,
            });
            engineData = await ensureEngineReadyWithFallback({
              preferredModelId: options.preferredModelId,
              signal: options.signal,
            });
            continue;
          }
          logCoachStreamEvent("coach_stream_insurance", {
            attempt,
            modelId: engineData.modelId,
          });
          recordError("coach", COACH_FALLBACK_MESSAGE);
          recordCoachStallAborts(stalledAbortCount);
          return {
            ok: false,
            reason: "timeout",
            message: COACH_FALLBACK_MESSAGE,
            shouldFallback: false,
            errorCode: "EDU_WEBLLM_TIMEOUT",
            stalledAbortCount,
            engineResetCount,
          };
        }
        throw error;
      }
    }

    recordCoachStallAborts(stalledAbortCount);
    return {
      ok: false,
      reason: "timeout",
      message: COACH_FALLBACK_MESSAGE,
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_TIMEOUT",
      stalledAbortCount,
      engineResetCount,
    };
  } catch (error) {
    if (isTimeoutError(error) || isAbortError(error)) {
      recordError("coach", FALLBACK_MESSAGE);
      return {
        ok: false,
        reason: "timeout",
        message: FALLBACK_MESSAGE,
        shouldFallback: false,
        errorCode: "EDU_WEBLLM_TIMEOUT",
        stalledAbortCount: 0,
        engineResetCount: 0,
      };
    }
    recordError("coach", error);
    const code = getErrorCode(error);
    if (code === "EDU_WEBLLM_ENV_MISSING" || code === "EDU_WEBLLM_MODEL_ID_UNKNOWN") {
      return {
        ok: false,
        reason: "config_missing",
        message: error instanceof Error ? error.message : FALLBACK_MESSAGE,
        shouldFallback: false,
        errorCode: code,
        stalledAbortCount: 0,
        engineResetCount: 0,
      };
    }

    if (isLikelyCorsError(error)) {
      return {
        ok: false,
        reason: "engine_error",
        message: CORS_FAILURE_MESSAGE,
        shouldFallback: shouldAttemptFallback(error),
        errorCode: "EDU_WEBLLM_CORS_BLOCKED",
        stalledAbortCount: 0,
        engineResetCount: 0,
      };
    }

    return {
      ok: false,
      reason: "engine_error",
      message: error instanceof Error ? error.message : FALLBACK_MESSAGE,
      shouldFallback: shouldAttemptFallback(error),
      errorCode: code ?? "EDU_WEBLLM_ENGINE_ERROR",
      stalledAbortCount: 0,
      engineResetCount: 0,
    };
  } finally {
    if (options.onProgress) {
      progressListeners.delete(options.onProgress);
    }
    const duration = performance.now() - startedAt;
    if (Number.isFinite(duration) && duration > 0) {
      recordDuration("coach", duration);
    }
  }
}

export async function generateLocalWebLLMJson(options: {
  messages: LocalChatMessage[];
  schema?: Record<string, unknown>;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
  temperature?: number;
  preferredModelId?: string;
  timeoutMs?: number;
  engineTimeoutMs?: number;
  useResponseFormat?: boolean;
  maxTokens?: number;
}): Promise<LocalWebLLMJsonResult> {
  const startedAt = performance.now();
  const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  if (!hasWebGPU) {
    recordError("generator", WEBGPU_DISABLED_MESSAGE);
    return {
      ok: false,
      reason: "unsupported",
      message: WEBGPU_DISABLED_MESSAGE,
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_UNSUPPORTED",
    };
  }
  if (getEduWebLLMHardDisableFlag()) {
    const disabled = getHardDisabledError();
    recordError("generator", disabled.message);
    return {
      ok: false,
      reason: "engine_error",
      message: disabled.message,
      shouldFallback: true,
      errorCode: disabled.code,
    };
  }

  if (options.signal?.aborted) {
    recordError("generator", FALLBACK_MESSAGE);
    recordGeneratorTimeout();
    return {
      ok: false,
      reason: "timeout",
      message: FALLBACK_MESSAGE,
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_TIMEOUT",
    };
  }

  const hasInvalidSystemMessage =
    options.messages[0]?.role !== "system" ||
    options.messages.slice(1).some((message) => message.role === "system");
  if (hasInvalidSystemMessage) {
    recordError("generator", "system 메시지는 첫 번째여야 합니다.");
    return {
      ok: false,
      reason: "config_missing",
      message: "system 메시지는 첫 번째여야 합니다.",
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_CONFIG_INVALID",
    };
  }

  if (options.onProgress) {
    progressListeners.add(options.onProgress);
  }

  let timeoutRecorded = false;
  try {
    const { primaryModelId, fallbackModelId } = getWebllmModelIds();
    const overrides = getGeneratorOverrideFlags();
    const preferred =
      overrides.forceFallback && fallbackModelId
        ? fallbackModelId
        : options.preferredModelId ?? primaryModelId;
    const fallbackCandidate =
      overrides.forceFallback
        ? null
        : fallbackModelId && fallbackModelId !== preferred
          ? fallbackModelId
          : null;
    const candidates: Array<{ modelId: string; allowRetry: boolean }> = [
      { modelId: preferred, allowRetry: true },
      ...(fallbackCandidate ? [{ modelId: fallbackCandidate, allowRetry: false }] : []),
    ];
    const timeoutMs = options.timeoutMs ?? GENERATOR_TIMEOUT_MS;
    const engineTimeoutMs = options.engineTimeoutMs ?? ENGINE_TIMEOUT_MS;
    let lastError: unknown = null;

    for (const { modelId, allowRetry } of candidates) {
      const choice: LocalWebLLMModelChoice = modelId === primaryModelId ? "primary" : "fallback";
      const shouldNoticeFallback = choice === "fallback";
      let engineData: { engine: WebLLMEngine; modelId: string };
      try {
        engineData = await withTimeout(
          (signal) => raceWithAbort(ensureEngineReady(modelId), signal),
          engineTimeoutMs,
          options.signal,
        );
      } catch (error) {
        if (isAbortError(error)) {
          if (!timeoutRecorded) {
            recordGeneratorTimeout();
            timeoutRecorded = true;
          }
          recordError("generator", FALLBACK_MESSAGE);
          return {
            ok: false,
            reason: "timeout",
            message: FALLBACK_MESSAGE,
            shouldFallback: false,
            errorCode: "EDU_WEBLLM_TIMEOUT",
          };
        }
        lastError = error;
        continue;
      }
      let attempt = 0;
      const maxAttempts = allowRetry ? 2 : 1;
      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          const result = await withTimeout(
            (signal) =>
              generateJson({
                engine: engineData.engine,
                messages: options.messages,
                temperature: options.temperature,
                schema: options.schema,
                useResponseFormat: options.useResponseFormat,
                maxTokens: options.maxTokens,
                signal,
              }),
            timeoutMs,
            options.signal,
          );
          recordDuration("generator", performance.now() - startedAt, engineData.modelId);
          recordSuccess("generator");
          if (shouldNoticeFallback) {
            recordFallbackUsed();
          }
          return {
            ok: true,
            modelId: engineData.modelId,
            modelChoice: choice,
            usedFallback: shouldNoticeFallback,
            autoSelected: engineData.modelId !== modelId,
            requestedModelId: modelId,
            usedResponseFormat: result.usedResponseFormat,
            data: result.data,
            rawText: result.rawText,
          };
        } catch (error) {
          lastError = error;
          if (isTimeoutError(error) && !timeoutRecorded) {
            recordGeneratorTimeout();
            timeoutRecorded = true;
          }
          const shouldRetry = isTimeoutError(error) || isGeneratorSchemaError(error);
          if (attempt < 2 && shouldRetry) {
            continue;
          }
          break;
        }
      }
    }

    throw lastError ?? new Error(FALLBACK_MESSAGE);
  } catch (error) {
    if (isTimeoutError(error) && !timeoutRecorded) {
      recordGeneratorTimeout();
      timeoutRecorded = true;
    }
    if (isAbortError(error)) {
      recordError("generator", FALLBACK_MESSAGE);
      return {
        ok: false,
        reason: "timeout",
        message: FALLBACK_MESSAGE,
        shouldFallback: false,
        errorCode: "EDU_WEBLLM_TIMEOUT",
      };
    }
    recordError("generator", error);
    const code = getErrorCode(error);
    if (code === "EDU_WEBLLM_ENV_MISSING" || code === "EDU_WEBLLM_MODEL_ID_UNKNOWN") {
      return {
        ok: false,
        reason: "config_missing",
        message: error instanceof Error ? error.message : FALLBACK_MESSAGE,
        shouldFallback: false,
        errorCode: code,
      };
    }

    if (isLikelyCorsError(error)) {
      return {
        ok: false,
        reason: "engine_error",
        message: CORS_FAILURE_MESSAGE,
        shouldFallback: shouldAttemptFallback(error),
        errorCode: "EDU_WEBLLM_CORS_BLOCKED",
      };
    }

    return {
      ok: false,
      reason: "engine_error",
      message: error instanceof Error ? error.message : FALLBACK_MESSAGE,
      shouldFallback: shouldAttemptFallback(error),
      errorCode: code ?? "EDU_WEBLLM_ENGINE_ERROR",
    };
  } finally {
    if (options.onProgress) {
      progressListeners.delete(options.onProgress);
    }
    const duration = performance.now() - startedAt;
    if (Number.isFinite(duration) && duration > 0) {
      recordDuration("generator", duration);
    }
  }
}

export async function completeLocalWebLLMText(options: {
  messages: LocalChatMessage[];
  signal?: AbortSignal;
  temperature?: number;
  preferredModelId?: string;
}): Promise<LocalWebLLMTextResult> {
  const startedAt = performance.now();
  const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  if (!hasWebGPU) {
    recordError("coach", WEBGPU_DISABLED_MESSAGE);
    return {
      ok: false,
      reason: "unsupported",
      message: WEBGPU_DISABLED_MESSAGE,
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_UNSUPPORTED",
    };
  }
  if (getEduWebLLMHardDisableFlag()) {
    const disabled = getHardDisabledError();
    recordError("coach", disabled.message);
    return {
      ok: false,
      reason: "engine_error",
      message: disabled.message,
      shouldFallback: true,
      errorCode: disabled.code,
    };
  }

  if (options.signal?.aborted) {
    recordError("coach", FALLBACK_MESSAGE);
    return {
      ok: false,
      reason: "timeout",
      message: FALLBACK_MESSAGE,
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_TIMEOUT",
    };
  }

  const hasInvalidSystemMessage =
    options.messages[0]?.role !== "system" ||
    options.messages.slice(1).some((message) => message.role === "system");
  if (hasInvalidSystemMessage) {
    recordError("coach", "system 메시지는 첫 번째여야 합니다.");
    return {
      ok: false,
      reason: "config_missing",
      message: "system 메시지는 첫 번째여야 합니다.",
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_CONFIG_INVALID",
    };
  }

  const lastMessage = options.messages[options.messages.length - 1];
  const lastRole = (lastMessage as { role?: string } | undefined)?.role;
  if (!lastMessage || (lastRole !== "user" && lastRole !== "tool")) {
    recordError("coach", "마지막 메시지는 user/tool이어야 합니다.");
    return {
      ok: false,
      reason: "config_missing",
      message: "마지막 메시지는 user/tool이어야 합니다.",
      shouldFallback: false,
      errorCode: "EDU_WEBLLM_CONFIG_INVALID",
    };
  }

  try {
    const { engine, modelId, choice, shouldNoticeFallback, autoSelected, requestedModelId } =
      await ensureEngineReadyWithFallback({
      preferredModelId: options.preferredModelId,
      signal: options.signal,
    });

    const result = await completeTextOnce({
      engine,
      messages: options.messages,
      temperature: options.temperature,
      signal: options.signal,
    });

    recordDuration("coach", performance.now() - startedAt, modelId);
    recordSuccess("coach");
    if (shouldNoticeFallback) {
      recordFallbackUsed();
    }
    return {
      ok: true,
      modelId,
      modelChoice: choice,
      usedFallback: shouldNoticeFallback,
      autoSelected,
      requestedModelId,
      content: result.content,
    };
  } catch (error) {
    if (isAbortError(error)) {
      recordError("coach", FALLBACK_MESSAGE);
      return {
        ok: false,
        reason: "timeout",
        message: FALLBACK_MESSAGE,
        shouldFallback: false,
        errorCode: "EDU_WEBLLM_TIMEOUT",
      };
    }
    recordError("coach", error);
    const code = getErrorCode(error);
    if (code === "EDU_WEBLLM_ENV_MISSING" || code === "EDU_WEBLLM_MODEL_ID_UNKNOWN") {
      return {
        ok: false,
        reason: "config_missing",
        message: error instanceof Error ? error.message : FALLBACK_MESSAGE,
        shouldFallback: false,
        errorCode: code,
      };
    }

    if (isLikelyCorsError(error)) {
      return {
        ok: false,
        reason: "engine_error",
        message: CORS_FAILURE_MESSAGE,
        shouldFallback: shouldAttemptFallback(error),
        errorCode: "EDU_WEBLLM_CORS_BLOCKED",
      };
    }

    return {
      ok: false,
      reason: "engine_error",
      message: error instanceof Error ? error.message : FALLBACK_MESSAGE,
      shouldFallback: shouldAttemptFallback(error),
      errorCode: code ?? "EDU_WEBLLM_ENGINE_ERROR",
    };
  } finally {
    const duration = performance.now() - startedAt;
    if (Number.isFinite(duration) && duration > 0) {
      recordDuration("coach", duration);
    }
  }
}
