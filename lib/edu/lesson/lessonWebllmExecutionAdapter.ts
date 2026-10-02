import type { WebLLMStatus } from "@/lib/edu/llm/webllmStatus";

export type LessonWebllmDecorateBypassReason =
  | "ENV_MISSING"
  | "SLOW_INIT"
  | "QUOTA_EXCEEDED"
  | "HEALTH_FALLBACK"
  | "NOT_READY_STRICT"
  | null;

export type LessonWebllmUnavailableReason =
  | "env_missing"
  | "loading_too_long"
  | "disabled"
  | "unavailable"
  | null;

type ResolveLessonWebllmDecorateBoundaryInput = {
  decorateQuotaExceeded: boolean;
  webllmStatusCode: string | null;
  webllmStatusAt: number | null;
  effectiveStatus: WebLLMStatus;
  effectiveWebllmEnabled: boolean;
  hasModelHost: boolean;
  hasWasmHost: boolean;
  readyWaitMs: number;
  nowMs: number;
};

export type ResolveLessonWebllmDecorateBoundaryResult = {
  bypassDecision: {
    bypass: boolean;
    reason: LessonWebllmDecorateBypassReason;
  };
  isLoadingTooLong: boolean;
  bypassTelemetry: {
    webllmStatus: WebLLMStatus;
    webllmCode: string | null;
    isLoadingTooLong: boolean;
    sawQuotaExceeded: boolean;
    decision: boolean;
  };
  webllmUnavailableReason: LessonWebllmUnavailableReason;
};

export const resolveLessonWebllmDecorateBoundary = (
  input: ResolveLessonWebllmDecorateBoundaryInput,
): ResolveLessonWebllmDecorateBoundaryResult => {
  const {
    decorateQuotaExceeded,
    webllmStatusCode,
    webllmStatusAt,
    effectiveStatus,
    effectiveWebllmEnabled,
    hasModelHost,
    hasWasmHost,
    readyWaitMs,
    nowMs,
  } = input;

  const isLoadingTooLong =
    (effectiveStatus === "LOADING" || webllmStatusCode === "WEBLLM_LOADING") &&
    Boolean(webllmStatusAt && nowMs - webllmStatusAt > readyWaitMs);

  const bypassDecision = (() => {
    if (decorateQuotaExceeded) {
      return { bypass: true, reason: "QUOTA_EXCEEDED" as const };
    }
    if (webllmStatusCode === "WEBLLM_HEALTH_FALLBACK") {
      return { bypass: true, reason: "HEALTH_FALLBACK" as const };
    }
    if (effectiveStatus === "ENV_MISSING" || webllmStatusCode === "WEBLLM_ENV_MISSING") {
      return { bypass: true, reason: "ENV_MISSING" as const };
    }
    if (isLoadingTooLong) {
      return { bypass: true, reason: "SLOW_INIT" as const };
    }
    const explicitReadyCode =
      !webllmStatusCode || webllmStatusCode === "WEBLLM_READY" || webllmStatusCode === "OK";
    const strictReady = effectiveStatus === "READY" && explicitReadyCode && hasModelHost && hasWasmHost;
    if (!strictReady) {
      return { bypass: true, reason: "NOT_READY_STRICT" as const };
    }
    return { bypass: false, reason: null };
  })();

  const webllmUnavailableReason: LessonWebllmUnavailableReason =
    effectiveStatus === "ENV_MISSING" || webllmStatusCode === "WEBLLM_ENV_MISSING"
      ? "env_missing"
      : effectiveStatus === "DISABLED" || !effectiveWebllmEnabled
        ? "disabled"
        : effectiveStatus === "UNSUPPORTED" ||
            effectiveStatus === "ASSET_UNREACHABLE" ||
            effectiveStatus === "CORS_BLOCKED" ||
            effectiveStatus === "MODEL_ID_UNKNOWN"
          ? "unavailable"
          : isLoadingTooLong
            ? "loading_too_long"
            : null;

  return {
    bypassDecision,
    isLoadingTooLong,
    bypassTelemetry: {
      webllmStatus: effectiveStatus,
      webllmCode: webllmStatusCode ?? null,
      isLoadingTooLong,
      sawQuotaExceeded: decorateQuotaExceeded,
      decision: bypassDecision.bypass,
    },
    webllmUnavailableReason,
  };
};

export const resolveLessonWebllmErrorStatus = (input: {
  errorCode?: string | null;
  reason?: string;
  hasWebllmEnvEffective: boolean;
}): WebLLMStatus => {
  const { errorCode, reason, hasWebllmEnvEffective } = input;
  if (errorCode === "EDU_WEBLLM_ENV_MISSING") {
    return hasWebllmEnvEffective ? "ERROR" : "ENV_MISSING";
  }
  if (errorCode === "EDU_WEBLLM_HEALTH_FALLBACK_UNAVAILABLE") return "ERROR";
  if (errorCode === "EDU_WEBLLM_MODEL_ID_UNKNOWN") return "MODEL_ID_UNKNOWN";
  if (errorCode === "EDU_WEBLLM_CORS_BLOCKED") return "CORS_BLOCKED";
  if (errorCode === "EDU_WEBLLM_PREFLIGHT_MODEL_FAILED" || errorCode === "EDU_WEBLLM_PREFLIGHT_WASM_FAILED") {
    return "ASSET_UNREACHABLE";
  }
  if (errorCode === "EDU_WEBLLM_UNSUPPORTED") return "UNSUPPORTED";
  if (errorCode === "WEBLLM_DOWNLOAD_BLOCKED") return "DISABLED";
  if (reason === "timeout") return "ERROR";
  if (reason === "config_missing") return "ERROR";
  return "ERROR";
};
