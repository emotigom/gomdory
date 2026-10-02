import * as webllm from "@mlc-ai/web-llm";

import { routes } from "@/lib/standards/routes";
import { start as startWebLLM } from "@/lib/edu/llm/webllmWorkerBridge";
import type { WebLLMWorkerResponse } from "@/lib/edu/llm/webllmWorkerTypes";
import { selectPreferredWebLLMModel } from "@/lib/edu/llm/webllmStatus";

export type WebLLMBrowserCheckStatus = "ok" | "warn" | "fail" | "loading";

export type WebLLMBrowserCheck = {
  id: string;
  label: string;
  status: WebLLMBrowserCheckStatus;
  message: string;
  detail?: string;
  action?: string;
  code?: string;
};

export type WebLLMBrowserCheckSummary = {
  requestId: string;
  status: "ready" | "degraded" | "blocked";
  checks: WebLLMBrowserCheck[];
  modelId?: string;
  resolvedModelId?: string | null;
  autoSelected?: boolean;
};

const MODEL_CORS_ACTION_TEXT = [
  "models.gomdory.com에서 다음 CORS 설정을 허용해야 해요:",
  "- Origin: gomdory.com, gkrry.com, localhost",
  "- Methods: GET, HEAD (OPTIONS 추가 금지)",
  "- Headers: Range, Content-Type, If-None-Match, If-Modified-Since",
  "- Expose-Headers: Content-Length, ETag, Accept-Ranges, Content-Range",
  "- CORP는 R2 CORS 메뉴가 아니라 Zone Rules/Worker에서 주입: Cross-Origin-Resource-Policy: cross-origin",
].join("\n");

type HealthHeaderProbe = {
  status: number;
  headers: {
    acceptRanges: string | null;
    accessControlAllowOrigin: string | null;
    accessControlAllowMethods: string | null;
    accessControlAllowHeaders: string | null;
    accessControlExposeHeaders: string | null;
    accessControlMaxAge: string | null;
    cacheControl: string | null;
    etag: string | null;
    varyOrigin: boolean;
    crossOriginResourcePolicy?: string | null;
  };
};

type HealthProbeResult = {
  ok: boolean;
  status: number;
  head: HealthHeaderProbe | null;
  get: HealthHeaderProbe | null;
};

type HealthProbeSet = {
  origin: string;
  serverFetch: HealthProbeResult | null;
  browserLike: HealthProbeResult | null;
  preflight: HealthHeaderProbe | null;
};

type HealthSection = {
  modelId: string;
  modelConfigUrl: string;
  modelConfig: HealthProbeSet | null;
  wasmCandidateUrls: string[];
  selectedWasmUrl: string | null;
  wasm: HealthProbeSet | null;
};

type HealthResponse =
  | {
      ok: true;
      requestId?: string;
      primary: HealthSection;
      fallback?: HealthSection;
      coach?: HealthSection;
      env?: {
        source?: string;
        missingKeys?: string[];
      };
    }
  | {
      ok: false;
      requestId?: string;
      missing: string[];
      missingKeys?: string[];
      env?: {
        source?: string;
        missingKeys?: string[];
      };
      message: string;
    };

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new DOMException("Abort", "AbortError")));
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const formatHost = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

export const runWebLLMBrowserChecks = async (): Promise<WebLLMBrowserCheckSummary> => {
  const checks: WebLLMBrowserCheck[] = [];
  let status: WebLLMBrowserCheckSummary["status"] = "ready";
  let requestId = `webllm-${Date.now()}`;
  const markDegraded = () => {
    if (status === "ready") {
      status = "degraded";
    }
  };

  const healthPath = routes.api.v1("edu", "webllm", "health");
  const healthResponse = (await fetch(healthPath, {
    method: "GET",
    cache: "no-store",
  }).then((res) => res.json())) as HealthResponse | null;

  if (!healthResponse) {
    checks.push({
      id: "health",
      label: "서버 상태",
      status: "fail",
      message: "서버 상태를 불러오지 못했어요.",
      action: `서버 로그에서 ${healthPath} 요청을 확인하세요.`,
      code: "HEALTH_UNAVAILABLE",
    });
    return { requestId, status: "blocked", checks };
  }

  requestId = healthResponse.requestId ?? requestId;

  if (!healthResponse.ok) {
    checks.push({
      id: "env",
      label: "환경 변수",
      status: "fail",
      message: "필수 환경 변수가 비어 있어요.",
      detail: healthResponse.missing.join(", "),
      action: "운영 환경 변수에 모델 ID/BASE/LIB를 설정하세요.",
      code: "ENV_MISSING",
    });
    return { requestId, status: "blocked", checks };
  }

  const primaryPaths = healthResponse.primary;

  const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  if (!hasWebGPU) {
    checks.push({
      id: "webgpu",
      label: "WebGPU 지원",
      status: "fail",
      message: "이 브라우저에서 GPU 가속을 사용할 수 없어요.",
      action: "브라우저 하드웨어 가속을 켜거나 다른 기기를 사용하세요.",
      code: "WEBGPU_UNSUPPORTED",
    });
    status = "blocked";
  } else {
    try {
      const adapter = await (
        navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }
      ).gpu?.requestAdapter();
      if (!adapter) {
        checks.push({
          id: "adapter",
          label: "GPU 어댑터",
          status: "fail",
          message: "GPU 어댑터를 찾을 수 없어요.",
          action: "브라우저 설정에서 하드웨어 가속을 확인하세요.",
          code: "WEBGPU_ADAPTER_MISSING",
        });
        status = "blocked";
      } else {
        checks.push({
          id: "adapter",
          label: "GPU 어댑터",
          status: "ok",
          message: "GPU 어댑터 확인 완료",
        });
      }
    } catch {
      checks.push({
        id: "adapter",
        label: "GPU 어댑터",
        status: "fail",
        message: "GPU 어댑터 요청에 실패했어요.",
        action: "브라우저 하드웨어 가속과 실험 설정을 확인하세요.",
        code: "WEBGPU_ADAPTER_FAILED",
      });
      status = "blocked";
    }
  }

  const modelList = (webllm.prebuiltAppConfig?.model_list ?? []) as webllm.ModelRecord[];
  const modelSelection = selectPreferredWebLLMModel(modelList, primaryPaths.modelId);
  if (!modelSelection.modelId) {
    checks.push({
      id: "modelId",
      label: "모델 ID",
      status: "fail",
      message: "prebuilt 모델 목록에 없는 모델 ID예요.",
      action: "지원되는 모델 ID로 변경하세요.",
      code: "MODEL_ID_UNKNOWN",
    });
    status = "blocked";
  } else if (modelSelection.autoSelected) {
    checks.push({
      id: "modelId",
      label: "모델 ID",
      status: "warn",
      message: "모델 ID가 자동 대체되었어요.",
      detail: `요청: ${primaryPaths.modelId} → 대체: ${modelSelection.modelId}`,
      action: "원하는 모델 ID로 환경 변수를 수정하세요.",
      code: "MODEL_ID_AUTO_SELECTED",
    });
    markDegraded();
  } else {
    checks.push({
      id: "modelId",
      label: "모델 ID",
      status: "ok",
      message: "모델 ID 확인 완료",
    });
  }

  const selectProbeResult = (
    probe: HealthProbeSet | null,
    mode: "serverFetch" | "browserLike" = "browserLike",
  ) =>
    (mode === "browserLike" ? probe?.browserLike ?? probe?.serverFetch : probe?.serverFetch) ??
    null;

  const hasHeader = (
    probe: HealthProbeSet | null,
    header: keyof HealthHeaderProbe["headers"],
    mode: "serverFetch" | "browserLike" = "browserLike",
  ) => {
    const selected = selectProbeResult(probe, mode);
    return Boolean(selected?.head?.headers?.[header] || selected?.get?.headers?.[header]);
  };


  const csvHeaderIncludes = (value: string | null | undefined, token: string) =>
    value
      ?.split(",")
      .map((part) => part.trim().toLowerCase())
      .includes(token.toLowerCase()) ?? false;

  const hasAllowOrigin = (value: string | null | undefined, expectedOrigin: string) => {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) return false;
    return normalized === "*" || normalized === expectedOrigin.toLowerCase() || /^https?:\/\//i.test(normalized);
  };

  const hasRequiredPreflight = (probe: HealthProbeSet | null, options: { requireRange: boolean }) => {
    const preflight = probe?.preflight?.headers;
    if (!hasAllowOrigin(preflight?.accessControlAllowOrigin, probe?.origin ?? "")) return false;
    const methods = preflight?.accessControlAllowMethods;
    const headers = preflight?.accessControlAllowHeaders;
    const methodOk = csvHeaderIncludes(methods, "GET") && csvHeaderIncludes(methods, "HEAD");
    if (!methodOk) return false;
    if (!options.requireRange) return true;
    return csvHeaderIncludes(headers, "Range");
  };

  const hasRequiredExposeHeaders = (probe: HealthProbeSet | null) => {
    const selected = selectProbeResult(probe, "browserLike");
    const expose = selected?.get?.headers?.accessControlExposeHeaders ?? selected?.head?.headers?.accessControlExposeHeaders;
    return (
      csvHeaderIncludes(expose, "Content-Length") &&
      csvHeaderIncludes(expose, "ETag") &&
      csvHeaderIncludes(expose, "Accept-Ranges")
    );
  };

  const hasCorpForCoep = (probe: HealthProbeSet | null) => {
    const selected = selectProbeResult(probe, "browserLike");
    const corp = selected?.get?.headers?.crossOriginResourcePolicy ?? selected?.head?.headers?.crossOriginResourcePolicy;
    return corp?.trim().toLowerCase() === "cross-origin";
  };

  const buildAssetAction = (flags: { corsMissing: boolean; rangeMissing: boolean; exposeMissing: boolean; corpMissing: boolean }) => {
    const actions = [];
    if (flags.corsMissing) actions.push(MODEL_CORS_ACTION_TEXT);
    if (flags.rangeMissing) {
      actions.push("Range 요청을 처리할 수 있도록 Accept-Ranges 헤더를 노출하세요.");
    }
    if (flags.exposeMissing) {
      actions.push("Access-Control-Expose-Headers에 Content-Length, ETag, Accept-Ranges를 포함하세요.");
    }
    if (flags.corpMissing) {
      actions.push("CORP가 누락되었습니다. R2 CORS 메뉴가 아니라 Cloudflare Zone Rules(Transform Rules/Response Header Modification) 또는 Worker에서 Cross-Origin-Resource-Policy: cross-origin을 주입하세요.");
    }
    return actions.length > 0 ? actions.join("\n") : undefined;
  };

  const buildAssetCheck = (
    section: HealthSection | undefined,
    options: {
      id: string;
      label: string;
      failureStatus: WebLLMBrowserCheckStatus;
      missingMessage: string;
      missingCode: string;
    },
  ): WebLLMBrowserCheck => {
    if (!section) {
      return {
        id: options.id,
        label: options.label,
        status: options.failureStatus,
        message: options.missingMessage,
        action: options.failureStatus === "warn" ? undefined : "환경 변수 설정을 확인하세요.",
        code: options.missingCode,
      };
    }

    const modelConfigOk = selectProbeResult(section.modelConfig)?.ok ?? false;
    const wasmOk = selectProbeResult(section.wasm)?.ok ?? false;
    const modelCors = selectProbeResult(section.modelConfig, "browserLike");
    const wasmCors = selectProbeResult(section.wasm, "browserLike");
    const corsMissing =
      !hasAllowOrigin(
        modelCors?.get?.headers?.accessControlAllowOrigin ?? modelCors?.head?.headers?.accessControlAllowOrigin,
        section.modelConfig?.origin ?? "",
      ) ||
      !hasAllowOrigin(
        wasmCors?.get?.headers?.accessControlAllowOrigin ?? wasmCors?.head?.headers?.accessControlAllowOrigin,
        section.wasm?.origin ?? "",
      );
    const rangeMissing = !hasHeader(section.wasm, "acceptRanges", "serverFetch");
    const exposeMissing = !hasRequiredExposeHeaders(section.wasm);
    const corpMissing = !hasCorpForCoep(section.modelConfig) || !hasCorpForCoep(section.wasm);
    const isOk = modelConfigOk && wasmOk && !corsMissing && !rangeMissing && !exposeMissing && !corpMissing;
    const detail = [
      section.modelConfigUrl ? `model: ${formatHost(section.modelConfigUrl)}` : null,
      section.selectedWasmUrl ? `wasm: ${formatHost(section.selectedWasmUrl)}` : null,
      selectProbeResult(section.modelConfig)?.status
        ? `model status: ${selectProbeResult(section.modelConfig)?.status}`
        : null,
      selectProbeResult(section.wasm)?.status ? `wasm status: ${selectProbeResult(section.wasm)?.status}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const action = buildAssetAction({ corsMissing, rangeMissing, exposeMissing, corpMissing });

    return {
      id: options.id,
      label: options.label,
      status: isOk ? "ok" : options.failureStatus,
      message: isOk
        ? "모델/wasm 접근 OK"
        : corpMissing
          ? "CORP 헤더 누락: R2 CORS 메뉴가 아니라 Zone Rules/Worker에서 설정하세요."
          : corsMissing || rangeMissing || exposeMissing
            ? "자산 헤더 설정을 확인해 주세요."
            : "모델 또는 WASM 접근에 실패했어요.",
      detail: detail || undefined,
      action,
      code: isOk
        ? undefined
        : corsMissing
          ? "CORS_HEADERS_MISSING"
          : rangeMissing
            ? "RANGE_HEADER_MISSING"
            : exposeMissing
              ? "EXPOSE_HEADERS_MISSING"
              : corpMissing
                ? "CORP_HEADER_MISSING"
                : "ASSET_UNREACHABLE",
    };
  };

  const hasBrowserCors = (section: HealthSection | undefined) => {
    if (!section) return false;
    const browserModel = selectProbeResult(section.modelConfig, "browserLike");
    const browserWasm = selectProbeResult(section.wasm, "browserLike");
    const browserLikeOk =
      hasAllowOrigin(
        browserModel?.get?.headers?.accessControlAllowOrigin ?? browserModel?.head?.headers?.accessControlAllowOrigin,
        section.modelConfig?.origin ?? "",
      ) &&
      hasAllowOrigin(
        browserWasm?.get?.headers?.accessControlAllowOrigin ?? browserWasm?.head?.headers?.accessControlAllowOrigin,
        section.wasm?.origin ?? "",
      );
    const preflightOk =
      hasRequiredPreflight(section.modelConfig, { requireRange: false }) &&
      hasRequiredPreflight(section.wasm, { requireRange: true });
    const exposeOk = hasRequiredExposeHeaders(section.wasm);
    const corpOk = hasCorpForCoep(section.modelConfig) && hasCorpForCoep(section.wasm);
    return browserLikeOk && preflightOk && exposeOk && corpOk;
  };

  const primaryAssetCheck = buildAssetCheck(primaryPaths, {
    id: "assets-primary",
    label: "Primary 모델 자산",
    failureStatus: "fail",
    missingMessage: "Primary 모델 설정이 없습니다.",
    missingCode: "PRIMARY_MISSING",
  });
  checks.push(primaryAssetCheck);
  if (primaryAssetCheck.status === "fail") {
    status = "blocked";
  }

  const primaryCorsOk = hasBrowserCors(primaryPaths);
  checks.push({
    id: "cors-browser-like",
    label: "CORS (browser-like)",
    status: primaryCorsOk ? "ok" : "warn",
    message: primaryCorsOk ? "CORS OK (browser-like)" : "CORS missing (browser-like)",
    action: primaryCorsOk ? undefined : "models.gomdory.com의 R2 CORS 규칙을 확인하세요.",
    code: primaryCorsOk ? undefined : "CORS_BROWSER_LIKE_MISSING",
  });
  if (!primaryCorsOk) {
    markDegraded();
  }

  const fallbackAssetCheck = buildAssetCheck(healthResponse.fallback, {
    id: "assets-fallback",
    label: "Fallback 모델 자산",
    failureStatus: "fail",
    missingMessage: "Fallback 모델이 설정되지 않았어요.",
    missingCode: "FALLBACK_MISSING",
  });
  checks.push(fallbackAssetCheck);
  if (fallbackAssetCheck.status === "fail") {
    markDegraded();
  }

  const coachPaths = healthResponse.coach;
  if (!coachPaths?.modelId) {
    checks.push({
      id: "coach-modelId",
      label: "코치 모델 ID",
      status: "warn",
      message: "코치 모델이 설정되지 않았어요.",
      action: "코치 모델 ID를 설정하면 스트림 코칭을 사용할 수 있어요.",
      code: "COACH_MODEL_MISSING",
    });
    markDegraded();
  } else {
    const coachSelection = selectPreferredWebLLMModel(modelList, coachPaths.modelId);
    if (!coachSelection.modelId) {
      checks.push({
        id: "coach-modelId",
        label: "코치 모델 ID",
        status: "warn",
        message: "코치 모델 ID가 prebuilt 목록에 없어요.",
        action: "지원되는 코치 모델 ID로 변경하세요.",
        code: "COACH_MODEL_ID_UNKNOWN",
      });
      markDegraded();
    } else if (coachSelection.autoSelected) {
      checks.push({
        id: "coach-modelId",
        label: "코치 모델 ID",
        status: "warn",
        message: "코치 모델 ID가 자동 대체되었어요.",
        detail: `요청: ${coachPaths.modelId} → 대체: ${coachSelection.modelId}`,
        action: "원하는 코치 모델 ID로 환경 변수를 수정하세요.",
        code: "COACH_MODEL_ID_AUTO_SELECTED",
      });
      markDegraded();
    } else {
      checks.push({
        id: "coach-modelId",
        label: "코치 모델 ID",
        status: "ok",
        message: "코치 모델 ID 확인 완료",
      });
    }

  }

  const coachAssetCheck = buildAssetCheck(coachPaths, {
    id: "assets-coach",
    label: "코치 모델 자산",
    failureStatus: "warn",
    missingMessage: "코치 모델이 설정되지 않았어요.",
    missingCode: "COACH_MISSING",
  });
  checks.push(coachAssetCheck);
  if (coachAssetCheck.status === "warn") {
    markDegraded();
  }

  if (status !== "blocked") {
    try {
      const warmupResponse = (await withTimeout(
        startWebLLM(`${requestId}-warmup`, { kind: "warmup" }) as Promise<WebLLMWorkerResponse>,
        15000,
      )) as WebLLMWorkerResponse;
      if (warmupResponse.type === "result" && warmupResponse.kind === "warmup") {
        const detail = (warmupResponse.result.message ?? "").toLowerCase();
        const healthMissingKeys = healthResponse.env?.missingKeys ?? [];
        const classifiedMessage =
          /401|unauthorized|auth/.test(detail)
            ? "auth error"
            : /cors|forbidden|blocked|network/.test(detail)
              ? "fetch blocked"
              : /env_missing|config_missing|edu_webllm_env_missing/.test(detail) && healthMissingKeys.length > 0
                ? "env missing"
                : /timeout|다운로드|준비|모델/.test(detail)
                  ? "model not ready"
                  : "engine error";
        checks.push({
          id: "warmup",
          label: "1회 워밍업",
          status: warmupResponse.result.ok ? "ok" : "warn",
          message: warmupResponse.result.ok
            ? "워밍업 성공"
            : `${classifiedMessage}: ${warmupResponse.result.message ?? "워밍업 실패"}`,
          action: warmupResponse.result.ok ? undefined : "네트워크/모델 캐시 상태를 확인하세요.",
        });
        if (!warmupResponse.result.ok) {
          status = "degraded";
        }
      } else {
        checks.push({
          id: "warmup",
          label: "1회 워밍업",
          status: "warn",
          message: "워밍업 응답을 확인하지 못했어요.",
          action: "브라우저 콘솔과 네트워크 상태를 확인하세요.",
          code: "WARMUP_NO_RESULT",
        });
        status = "degraded";
      }
    } catch {
      checks.push({
        id: "warmup",
        label: "1회 워밍업",
        status: "fail",
        message: "워밍업이 제한 시간 내에 끝나지 않았어요.",
        action: "모델 다운로드/캐시 상태를 확인하세요.",
        code: "WARMUP_TIMEOUT",
      });
      status = "degraded";
    }
  }

  return {
    requestId,
    status,
    checks,
    modelId: primaryPaths.modelId,
    resolvedModelId: modelSelection.modelId,
    autoSelected: modelSelection.autoSelected,
  };
};
