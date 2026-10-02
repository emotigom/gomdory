import { NextResponse } from "next/server";

import { getOrCreateRequestId } from "@/lib/http/requestId";
import { resolveWebllmCanonicalAssetPlan } from "@/lib/edu/llm/webllmCanonicalAssetPlan";
import { resolveWebllmDownloadPolicyFromRequest } from "@/lib/edu/llm/webllmAccessPolicy";
import { resolveWebllmContainedRolloutSnapshot } from "@/lib/edu/llm/webllmContainedRolloutSnapshot";
import { GOMDORY_CANONICAL_HOST } from "@/lib/routing/host";
import { readEnvString } from "@/lib/server/runtimeEnv";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HeaderProbe = {
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
    vary: string | null;
    varyOrigin: boolean;
    crossOriginResourcePolicy: string | null;
    crossOriginEmbedderPolicy: string | null;
  };
};

type ProbeResult = {
  ok: boolean;
  status: number;
  head: HeaderProbe | null;
  get: HeaderProbe | null;
  rangeGet: HeaderProbe | null;
};

type ProbeSet = {
  origin: string;
  serverFetch: ProbeResult | null;
  browserLike: ProbeResult | null;
  preflight: HeaderProbe | null;
};

const CORS_PROBE_ORIGIN = `https://${GOMDORY_CANONICAL_HOST}`;

const logWebllmHealth = (event: string, payload: Record<string, unknown>) => {
  if (typeof console === "undefined") return;
  console.info("[edu] webllm.health", { event, ts: new Date().toISOString(), ...payload });
};

const summarizeHeaders = (response: Response): HeaderProbe => ({
  status: response.status,
  headers: {
    acceptRanges: response.headers.get("accept-ranges"),
    accessControlAllowOrigin: response.headers.get("access-control-allow-origin"),
    accessControlAllowMethods: response.headers.get("access-control-allow-methods"),
    accessControlAllowHeaders: response.headers.get("access-control-allow-headers"),
    accessControlExposeHeaders: response.headers.get("access-control-expose-headers"),
    accessControlMaxAge: response.headers.get("access-control-max-age"),
    cacheControl: response.headers.get("cache-control"),
    etag: response.headers.get("etag"),
    vary: response.headers.get("vary"),
    varyOrigin: response.headers.get("vary")?.toLowerCase().includes("origin") ?? false,
    crossOriginResourcePolicy: response.headers.get("cross-origin-resource-policy"),
    crossOriginEmbedderPolicy: response.headers.get("cross-origin-embedder-policy"),
  },
});

const emptyProbe = (): HeaderProbe => ({
  status: 0,
  headers: {
    acceptRanges: null,
    accessControlAllowOrigin: null,
    accessControlAllowMethods: null,
    accessControlAllowHeaders: null,
    accessControlExposeHeaders: null,
    accessControlMaxAge: null,
    cacheControl: null,
    etag: null,
    vary: null,
    varyOrigin: false,
    crossOriginResourcePolicy: null,
    crossOriginEmbedderPolicy: null,
  },
});

const fetchHeadThenGet = async (
  url: string,
  options: { range?: boolean; headers?: HeadersInit } = {},
): Promise<ProbeResult> => {
  let headSummary: HeaderProbe | null = null;
  let headOk = false;
  try {
    const headHeaders = new Headers(options.headers);
    const head = await fetch(url, { method: "HEAD", cache: "no-store", headers: headHeaders });
    headSummary = summarizeHeaders(head);
    headOk = head.ok;
  } catch {
    headSummary = emptyProbe();
  }

  let getSummary: HeaderProbe | null = null;
  let getOk = false;
  try {
    const getHeaders = new Headers(options.headers);
    if (options.range) {
      getHeaders.set("Range", "bytes=0-0");
    }
    const get = await fetch(url, { method: "GET", cache: "no-store", headers: getHeaders });
    getSummary = summarizeHeaders(get);
    getOk = get.ok;
  } catch {
    getSummary = emptyProbe();
  }

  let rangeSummary: HeaderProbe | null = null;
  let rangeOk = false;
  if (options.range) {
    try {
      const rangeHeaders = new Headers(options.headers);
      rangeHeaders.set("Range", "bytes=0-0");
      const rangeGet = await fetch(url, { method: "GET", cache: "no-store", headers: rangeHeaders });
      rangeSummary = summarizeHeaders(rangeGet);
      rangeOk = rangeGet.ok;
    } catch {
      rangeSummary = emptyProbe();
    }
  }

  return {
    ok: headOk || getOk || rangeOk,
    status: rangeSummary?.status ?? getSummary?.status ?? headSummary?.status ?? 0,
    head: headSummary,
    get: getSummary,
    rangeGet: rangeSummary,
  };
};

const fetchPreflight = async (url: string, options: { origin: string; requestHeaders?: string }) => {
  try {
    const headers = new Headers();
    headers.set("Origin", options.origin);
    headers.set("Access-Control-Request-Method", "GET");
    if (options.requestHeaders) {
      headers.set("Access-Control-Request-Headers", options.requestHeaders);
    }
    const response = await fetch(url, { method: "OPTIONS", cache: "no-store", headers });
    return summarizeHeaders(response);
  } catch {
    return emptyProbe();
  }
};

const fetchProbeSet = async (
  url: string,
  options: { range?: boolean; preflightHeaders?: string } = {},
): Promise<ProbeSet> => {
  const browserHeaders = new Headers();
  browserHeaders.set("Origin", CORS_PROBE_ORIGIN);
  const [serverFetch, browserLike, preflight] = await Promise.all([
    fetchHeadThenGet(url, { range: options.range }),
    fetchHeadThenGet(url, { range: options.range, headers: browserHeaders }),
    fetchPreflight(url, { origin: CORS_PROBE_ORIGIN, requestHeaders: options.preflightHeaders }),
  ]);
  return {
    origin: CORS_PROBE_ORIGIN,
    serverFetch,
    browserLike,
    preflight,
  };
};

const isProbeSetOk = (probe: ProbeSet | null) =>
  Boolean(probe?.serverFetch?.ok || probe?.browserLike?.ok);

const resolveCandidate = async (urls: string[], options: { range?: boolean; preflightHeaders?: string } = {}) => {
  let last: { url: string; result: ProbeSet } | null = null;
  for (const url of urls) {
    const result = await fetchProbeSet(url, options);
    last = { url, result };
    if (isProbeSetOk(result)) {
      return last;
    }
  }
  return last;
};

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const downloadPolicy = resolveWebllmDownloadPolicyFromRequest(request);
  const dispatchExperiment = readEnvString("NEXT_PUBLIC_EDU_WEBLLM_DISPATCH_EXPERIMENT") ?? "off";
  const activationExperiment = readEnvString("NEXT_PUBLIC_EDU_WEBLLM_ACTIVATION_EXPERIMENT") ?? "off";
  const dispatchKillSwitchRaw = readEnvString("NEXT_PUBLIC_EDU_WEBLLM_DISPATCH_KILL_SWITCH") ?? "false";
  const killSwitchOn = /^(1|true|yes|on)$/i.test(dispatchKillSwitchRaw.trim());

  if (!downloadPolicy.downloadAllowed) {
    const snapshot = resolveWebllmContainedRolloutSnapshot({
      lessonScope: "unknown",
      bootstrapReady: false,
      canonicalReady: false,
      healthReady: false,
      killSwitchOn,
      dispatchExperiment,
      activationExperiment,
      shouldAttemptLocalInit: false,
      shouldUseServerFallback: true,
      statusCode: "WEBLLM_DOWNLOAD_BLOCKED",
    });
    const response = NextResponse.json({
      ok: true,
      requestId,
      webllmBlocked: true,
      reason: "WEBLLM_DOWNLOAD_BLOCKED",
      message: "Sample lesson without jt: WebLLM model download is disabled.",
      rolloutSnapshot: snapshot,
    });
    response.headers.set("cache-control", "no-store");
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-gom-request-id", requestId);
    return response;
  }

  const plan = resolveWebllmCanonicalAssetPlan();
  const missing = plan.missingKeys;

  if (missing.length > 0) {
    const snapshot = resolveWebllmContainedRolloutSnapshot({
      lessonScope: "unknown",
      bootstrapReady: false,
      canonicalReady: false,
      healthReady: false,
      killSwitchOn,
      dispatchExperiment,
      activationExperiment,
      shouldAttemptLocalInit: false,
      shouldUseServerFallback: true,
      canonicalStatus: plan.statusCode,
      statusCode: "WEBLLM_ENV_MISSING",
      invalidReasons: plan.invalidReasons,
    });
    logWebllmHealth("missing_env", { requestId, missing });
    const response = NextResponse.json({
      ok: false,
      requestId,
      missing,
      missingKeys: missing,
      env: {
        source: plan.envSource,
        missingKeys: missing,
      },
      message: "로컬 모델 환경 변수가 비어 있어요. 누락 키를 확인해 주세요.",
      rolloutSnapshot: snapshot,
    });
    response.headers.set("cache-control", "no-store");
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-gom-request-id", requestId);
    return response;
  }

  if (plan.statusCode === "WEBLLM_DERIVED_URL_INVALID" || !plan.primary) {
    const snapshot = resolveWebllmContainedRolloutSnapshot({
      lessonScope: "unknown",
      bootstrapReady: true,
      canonicalReady: false,
      healthReady: false,
      killSwitchOn,
      dispatchExperiment,
      activationExperiment,
      shouldAttemptLocalInit: false,
      shouldUseServerFallback: true,
      canonicalStatus: plan.statusCode,
      statusCode: "WEBLLM_DERIVED_URL_INVALID",
      invalidReasons: plan.invalidReasons,
    });
    const response = NextResponse.json({
      ok: false,
      requestId,
      missing: [],
      missingKeys: [],
      env: {
        source: plan.envSource,
        missingKeys: [],
      },
      code: "WEBLLM_DERIVED_URL_INVALID",
      message: "파생된 WebLLM URL이 유효하지 않아 진단을 진행할 수 없어요.",
      invalidReasons: plan.invalidReasons,
      rolloutSnapshot: snapshot,
    });
    response.headers.set("cache-control", "no-store");
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-gom-request-id", requestId);
    return response;
  }

  const primaryModelConfigUrl = plan.primary.modelConfigUrl;
  const primaryWasmCandidates = plan.primary.wasmCandidateUrls;
  const fallbackModelConfigUrl = plan.fallback?.modelConfigUrl ?? null;
  const fallbackWasmCandidates = plan.fallback?.wasmCandidateUrls ?? [];
  const coachModelConfigUrl = plan.coach?.modelConfigUrl ?? null;
  const coachWasmCandidates = plan.coach?.wasmCandidateUrls ?? [];

  const primaryModelConfigCheck = await fetchProbeSet(primaryModelConfigUrl, {
    preflightHeaders: "Content-Type, If-None-Match",
  });
  const primaryWasmCheck = await resolveCandidate(primaryWasmCandidates, {
    range: true,
    preflightHeaders: "Range, Content-Type, If-None-Match",
  });

  const fallbackModelConfigCheck = fallbackModelConfigUrl
    ? await fetchProbeSet(fallbackModelConfigUrl, { preflightHeaders: "Content-Type, If-None-Match" })
    : null;
  const fallbackWasmCheck = fallbackWasmCandidates.length
    ? await resolveCandidate(fallbackWasmCandidates, {
        range: true,
        preflightHeaders: "Range, Content-Type, If-None-Match",
      })
    : null;

  const coachModelConfigCheck = coachModelConfigUrl
    ? await fetchProbeSet(coachModelConfigUrl, { preflightHeaders: "Content-Type, If-None-Match" })
    : null;
  const coachWasmCheck = coachWasmCandidates.length
    ? await resolveCandidate(coachWasmCandidates, {
        range: true,
        preflightHeaders: "Range, Content-Type, If-None-Match",
      })
    : null;

  logWebllmHealth("resolve_result", {
    requestId,
    primary: {
      modelConfigUrl: primaryModelConfigUrl,
      modelConfigStatus: primaryModelConfigCheck.serverFetch?.status ?? primaryModelConfigCheck.browserLike?.status ?? null,
      wasmCandidateUrls: primaryWasmCandidates,
      selectedWasmUrl: primaryWasmCheck?.url ?? null,
      wasmStatus: primaryWasmCheck?.result.serverFetch?.status ?? primaryWasmCheck?.result.browserLike?.status ?? null,
    },
    fallback: plan.fallback
      ? {
          modelConfigUrl: fallbackModelConfigUrl,
          modelConfigStatus:
            fallbackModelConfigCheck?.serverFetch?.status ?? fallbackModelConfigCheck?.browserLike?.status ?? null,
          wasmCandidateUrls: fallbackWasmCandidates,
          selectedWasmUrl: fallbackWasmCheck?.url ?? null,
          wasmStatus: fallbackWasmCheck?.result.serverFetch?.status ?? fallbackWasmCheck?.result.browserLike?.status ?? null,
        }
      : null,
    coach: plan.coach
      ? {
          modelConfigUrl: coachModelConfigUrl,
          modelConfigStatus: coachModelConfigCheck?.serverFetch?.status ?? coachModelConfigCheck?.browserLike?.status ?? null,
          wasmCandidateUrls: coachWasmCandidates,
          selectedWasmUrl: coachWasmCheck?.url ?? null,
          wasmStatus: coachWasmCheck?.result.serverFetch?.status ?? coachWasmCheck?.result.browserLike?.status ?? null,
        }
      : null,
  });

  const snapshot = resolveWebllmContainedRolloutSnapshot({
    lessonScope: "unknown",
    bootstrapReady: !plan.hardDisable && missing.length === 0,
    canonicalReady: plan.statusCode === "WEBLLM_READY",
    healthReady: isProbeSetOk(primaryModelConfigCheck) && Boolean(primaryWasmCheck?.result && isProbeSetOk(primaryWasmCheck.result)),
    degradedBlocked: false,
    killSwitchOn,
    dispatchExperiment,
    activationExperiment,
    shouldAttemptLocalInit: !plan.hardDisable && plan.statusCode === "WEBLLM_READY",
    shouldUseServerFallback: plan.hardDisable || plan.statusCode !== "WEBLLM_READY",
    canonicalStatus: plan.statusCode,
    statusCode: plan.statusCode,
    invalidReasons: plan.invalidReasons,
  });

  const response = NextResponse.json({
    ok: true,
      requestId,
      env: {
        source: plan.envSource,
        missingKeys: [] as string[],
      },
    hardDisabled: plan.hardDisable,
    canonicalStatus: plan.statusCode,
    invalidReasons: plan.invalidReasons,
    rolloutSnapshot: snapshot,
    runtimeModelOrder: plan.runtimeModelOrder,
    resolvedConfig: {
      modelBase: plan.resolvedConfig.modelBase,
      libBase: plan.resolvedConfig.libBase,
      hardDisableRaw: plan.hardDisableRaw ?? null,
      coachModelId: plan.coach?.modelId ?? null,
      coachWasmUrl: plan.coach?.selectedWasmUrl ?? null,
    },
    primary: {
      modelId: plan.primary.modelId,
      modelConfigUrl: primaryModelConfigUrl,
      modelConfig: primaryModelConfigCheck,
      wasmCandidateUrls: primaryWasmCandidates,
      selectedWasmUrl: primaryWasmCheck?.url ?? null,
      wasm: primaryWasmCheck?.result ?? null,
    },
    fallback: plan.fallback
      ? {
          modelId: plan.fallback.modelId,
          modelConfigUrl: fallbackModelConfigUrl,
          modelConfig: fallbackModelConfigCheck,
          wasmCandidateUrls: fallbackWasmCandidates,
          selectedWasmUrl: fallbackWasmCheck?.url ?? null,
          wasm: fallbackWasmCheck?.result ?? null,
        }
      : undefined,
    coach: plan.coach
      ? {
          modelId: plan.coach.modelId,
          modelConfigUrl: coachModelConfigUrl,
          modelConfig: coachModelConfigCheck,
          wasmCandidateUrls: coachWasmCandidates,
          selectedWasmUrl: coachWasmCheck?.url ?? null,
          wasm: coachWasmCheck?.result ?? null,
        }
      : undefined,
  });
  response.headers.set("cache-control", "no-store");
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-gom-request-id", requestId);
  return response;
}
