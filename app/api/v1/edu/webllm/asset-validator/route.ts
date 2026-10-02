import { NextResponse } from "next/server";

import {
  readWebllmEnvValue,
} from "@/lib/edu/llm/webllmConfig";
import { resolveWebllmCanonicalAssetPlan } from "@/lib/edu/llm/webllmCanonicalAssetPlan";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { GKRRY_HOSTS, GOMDORY_CANONICAL_HOST, GOMDORY_HOSTS } from "@/lib/routing/host";
import { resolveWebllmDownloadPolicyFromRequest } from "@/lib/edu/llm/webllmAccessPolicy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FailureCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CORS_BLOCKED"
  | "RANGE_UNSUPPORTED"
  | "MISCONFIG_URL"
  | "UNKNOWN";

type ProbeHeaders = {
  accessControlAllowOrigin: string | null;
  vary: string | null;
  acceptRanges: string | null;
  etag: string | null;
  contentRange: string | null;
};

type ProbeRecord = {
  method: "HEAD" | "GET" | "OPTIONS";
  url: string;
  status: number | null;
  headers: ProbeHeaders;
};

type ProbeStep = {
  ok: boolean;
  step: string;
  failureCode: FailureCode | null;
  message: string;
  url: string;
  recommendedFix: string;
  probes: ProbeRecord[];
};

type ModelValidation = {
  modelId: string;
  origin: string;
  configHead: ProbeStep;
  wasmHead: ProbeStep;
  wasmRangeGet: ProbeStep;
  wasmRange: ProbeStep;
  cors: ProbeStep;
  rootCause: ProbeStep;
  summary: {
    configOk: boolean;
    wasmOk: boolean;
    rangeOk: boolean;
    corsOk: boolean;
  };
  ok: boolean;
};

const RANGE_HEADER_VALUE = "bytes=0-1023";
const DEFAULT_PROBE_ORIGIN = `https://${GOMDORY_CANONICAL_HOST}`;

const MODEL_CORS_ALLOWED_ORIGINS = [
  ...Array.from(new Set([...GOMDORY_HOSTS, ...GKRRY_HOSTS])).map((host) => `https://${host}`),
  "http://localhost:3000",
];

const toObjectKey = (url: string) => {
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return url;
  }
};


const headersFromResponse = (response: Response | null): ProbeHeaders => ({
  accessControlAllowOrigin: response?.headers.get("access-control-allow-origin") ?? null,
  vary: response?.headers.get("vary") ?? null,
  acceptRanges: response?.headers.get("accept-ranges") ?? null,
  etag: response?.headers.get("etag") ?? null,
  contentRange: response?.headers.get("content-range") ?? null,
});

const isCorsAllowed = (allowOrigin: string | null) => {
  if (!allowOrigin) return false;
  const normalized = allowOrigin.trim();
  return normalized === "*" || /^https?:\/\//i.test(normalized);
};

const classifyStatus = (status: number | null): FailureCode => {
  if (status === 404) return "NOT_FOUND";
  if (status === 403) return "FORBIDDEN";
  return "UNKNOWN";
};

const safeFetch = async (url: string, init: RequestInit) => {
  try {
    const response = await fetch(url, { ...init, cache: "no-store" });
    return response;
  } catch {
    return null;
  }
};

const toOrigin = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
  }
};

const selectProbeOrigin = (request: Request) => {
  const requestOrigin = toOrigin(request.headers.get("origin"));
  if (requestOrigin) return requestOrigin;

  const smokeTeacherOrigin = toOrigin(readWebllmEnvValue("SMOKE_TEACHER_ORIGIN"));
  if (smokeTeacherOrigin) return smokeTeacherOrigin;

  const siteUrlOrigin = toOrigin(readWebllmEnvValue("NEXT_PUBLIC_SITE_URL"));
  if (siteUrlOrigin) return siteUrlOrigin;

  return DEFAULT_PROBE_ORIGIN;
};

const buildProbeRecord = (method: "HEAD" | "GET" | "OPTIONS", url: string, response: Response | null): ProbeRecord => ({
  method,
  url,
  status: response?.status ?? null,
  headers: headersFromResponse(response),
});

const inferMisconfigUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname || parsed.pathname === "/") return true;
    return false;
  } catch {
    return true;
  }
};

const createStep = (input: Omit<ProbeStep, "recommendedFix"> & { recommendedFix?: string }): ProbeStep => ({
  ...input,
  recommendedFix: input.recommendedFix ?? "R2 object key/권한/CORS 설정을 점검하세요.",
});

const selectRootCause = (steps: ProbeStep[]): ProbeStep => {
  const failed = steps.find((step) => !step.ok);
  return (
    failed ??
    createStep({
      ok: true,
      step: "root_cause",
      failureCode: null,
      message: "No blocking issue detected.",
      url: "",
      probes: [],
      recommendedFix: "",
    })
  );
};

const validateModelAssets = async (input: {
  modelId: string;
  configUrl: string;
  wasmUrl: string;
  origin: string;
}) => {
  const probeHeaders = {
    Origin: input.origin,
  };
  const misconfig = inferMisconfigUrl(input.configUrl) || inferMisconfigUrl(input.wasmUrl);
  const configHeadResponse = misconfig ? null : await safeFetch(input.configUrl, { method: "HEAD", headers: probeHeaders });
  const configGetResponse = misconfig ? null : await safeFetch(input.configUrl, { method: "GET", headers: probeHeaders });
  const wasmHeadResponse = misconfig ? null : await safeFetch(input.wasmUrl, { method: "HEAD", headers: probeHeaders });
  const wasmRangeResponse = misconfig
    ? null
    : await safeFetch(input.wasmUrl, {
        method: "GET",
        headers: {
          ...probeHeaders,
          Range: RANGE_HEADER_VALUE,
        },
      });
  const configHead = createStep({
    ok: !misconfig && configHeadResponse?.status === 200,
    step: "config_head",
    failureCode: misconfig ? "MISCONFIG_URL" : configHeadResponse?.status === 200 ? null : classifyStatus(configHeadResponse?.status ?? null),
    message:
      misconfig
        ? `Model URL is malformed. objectKey=${toObjectKey(input.configUrl)}`
        : `mlc-chat-config.json HEAD status=${configHeadResponse?.status ?? "fetch_failed"}`,
    url: input.configUrl,
    recommendedFix: "MODEL_BASE/MODEL_SUBDIR를 확인하고 <MODEL_ID>/resolve/main/mlc-chat-config.json 경로가 실제 R2 key와 일치해야 합니다.",
    probes: [buildProbeRecord("HEAD", input.configUrl, configHeadResponse), buildProbeRecord("GET", input.configUrl, configGetResponse)],
  });

  const wasmHead = createStep({
    ok: !misconfig && wasmHeadResponse?.status === 200,
    step: "wasm_head",
    failureCode: misconfig ? "MISCONFIG_URL" : wasmHeadResponse?.status === 200 ? null : classifyStatus(wasmHeadResponse?.status ?? null),
    message: misconfig ? `WASM URL is malformed. objectKey=${toObjectKey(input.wasmUrl)}` : `wasm HEAD status=${wasmHeadResponse?.status ?? "fetch_failed"}`,
    url: input.wasmUrl,
    recommendedFix: "WASM object key 및 공개 권한을 확인하고 libBase/<MODEL_ID>/<MODEL_ID>.wasm 경로를 점검하세요.",
    probes: [buildProbeRecord("HEAD", input.wasmUrl, wasmHeadResponse)],
  });

  const rangeStatus = wasmRangeResponse?.status ?? null;
  const acceptRanges = wasmRangeResponse?.headers.get("accept-ranges") ?? wasmHeadResponse?.headers.get("accept-ranges") ?? null;
  const rangeStatusOk = rangeStatus === 206 || rangeStatus === 200;
  const acceptRangesOk = typeof acceptRanges === "string" && acceptRanges.toLowerCase() === "bytes";

  const wasmRangeGet = createStep({
    ok: !misconfig && Boolean(rangeStatusOk),
    step: "wasm_range_get",
    failureCode: misconfig ? "MISCONFIG_URL" : rangeStatusOk ? null : classifyStatus(rangeStatus),
    message: `wasm Range GET status=${rangeStatus ?? "fetch_failed"}`,
    url: input.wasmUrl,
    recommendedFix: "WASM GET 요청이 성공해야 합니다. R2 object 공개/경로를 확인하세요.",
    probes: [buildProbeRecord("GET", input.wasmUrl, wasmRangeResponse)],
  });

  const wasmRange = createStep({
    ok: !misconfig && (rangeStatus === 206 || (rangeStatus === 200 && acceptRangesOk)),
    step: "wasm_range",
    failureCode: misconfig
      ? "MISCONFIG_URL"
      : rangeStatusOk && (!acceptRangesOk && rangeStatus !== 206)
        ? "RANGE_UNSUPPORTED"
      : rangeStatusOk
          ? null
          : classifyStatus(rangeStatus),
    message:
      rangeStatus === 200
        ? `Range GET returned 200. accept-ranges=${acceptRanges ?? "none"}`
        : `range status=${rangeStatus ?? "fetch_failed"}, accept-ranges=${acceptRanges ?? "none"}`,
    url: input.wasmUrl,
    recommendedFix:
      "R2 public bucket + Accept-Ranges: bytes + ExposeHeaders(accept-ranges, content-range) 설정을 확인하세요.",
    probes: [buildProbeRecord("HEAD", input.wasmUrl, wasmHeadResponse), buildProbeRecord("GET", input.wasmUrl, wasmRangeResponse)],
  });

  const corsHeader =
    configHeadResponse?.headers.get("access-control-allow-origin") ??
    configGetResponse?.headers.get("access-control-allow-origin") ??
    wasmRangeResponse?.headers.get("access-control-allow-origin") ??
    wasmHeadResponse?.headers.get("access-control-allow-origin") ??
    null;
  const cors = createStep({
    ok: !misconfig && isCorsAllowed(corsHeader),
    step: "cors",
    failureCode: misconfig ? "MISCONFIG_URL" : isCorsAllowed(corsHeader) ? null : "CORS_BLOCKED",
    message: `access-control-allow-origin=${corsHeader ?? "missing"}`,
    url: input.configUrl,
    recommendedFix:
      "R2 CORS AllowedOrigins에 서비스 origin을 추가하고 AllowedMethods는 GET/HEAD(필요 시 PUT)만 사용하세요. OPTIONS는 추가하지 마세요.",
    probes: [
      buildProbeRecord("HEAD", input.configUrl, configHeadResponse),
      buildProbeRecord("GET", input.configUrl, configGetResponse),
      buildProbeRecord("GET", input.wasmUrl, wasmRangeResponse),
      buildProbeRecord("HEAD", input.wasmUrl, wasmHeadResponse),
    ],
  });

  const rootCause = selectRootCause([configHead, wasmHead, wasmRangeGet, wasmRange, cors]);

  const result: ModelValidation = {
    modelId: input.modelId,
    origin: input.origin,
    configHead,
    wasmHead,
    wasmRangeGet,
    wasmRange,
    cors,
    rootCause,
    summary: {
      configOk: configHead.ok,
      wasmOk: wasmHead.ok,
      rangeOk: wasmRange.ok,
      corsOk: cors.ok,
    },
    ok: configHead.ok && wasmHead.ok && wasmRange.ok && cors.ok,
  };

  return result;
};

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const probeOrigin = selectProbeOrigin(request);
  const respond = (payload: Record<string, unknown>) => {
    const response = NextResponse.json(payload, { status: 200 });
    response.headers.set("cache-control", "no-store");
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-gom-request-id", requestId);
    return response;
  };

  try {
    const downloadPolicy = resolveWebllmDownloadPolicyFromRequest(request);
    if (!downloadPolicy.downloadAllowed) {
      const response = NextResponse.json(
        {
          ok: false,
          code: "WEBLLM_DOWNLOAD_BLOCKED",
          message: "Sample lesson without jt: WebLLM model download is disabled.",
          requestId,
        },
        { status: 403 },
      );
      response.headers.set("cache-control", "no-store");
      response.headers.set("x-request-id", requestId);
      response.headers.set("x-gom-request-id", requestId);
      return response;
    }

    const canonicalPlan = resolveWebllmCanonicalAssetPlan();
    const missing = canonicalPlan.missingKeys;
    if (canonicalPlan.statusCode === "WEBLLM_DERIVED_URL_INVALID" || !canonicalPlan.primary) {
      return respond({
        ok: false,
        requestId,
        missing,
        errors: [
          {
            modelId: "asset-validator",
            step: "canonical_plan_invalid",
            message: "Derived WebLLM URL plan is invalid.",
            failureCode: "MISCONFIG_URL",
          },
        ],
        canonicalStatus: canonicalPlan.statusCode,
        invalidReasons: canonicalPlan.invalidReasons,
      });
    }

    const primary = await validateModelAssets({
      modelId: canonicalPlan.primary.modelId,
      configUrl: canonicalPlan.primary.modelConfigUrl,
      wasmUrl: canonicalPlan.primary.selectedWasmUrl ?? "",
      origin: probeOrigin,
    });

    const fallback = canonicalPlan.fallback
      ? await validateModelAssets({
          modelId: canonicalPlan.fallback.modelId,
          configUrl: canonicalPlan.fallback.modelConfigUrl,
          wasmUrl: canonicalPlan.fallback.selectedWasmUrl ?? "",
          origin: probeOrigin,
        })
      : null;

    const coach = canonicalPlan.coach
      ? await validateModelAssets({
          modelId: canonicalPlan.coach.modelId,
          configUrl: canonicalPlan.coach.modelConfigUrl,
          wasmUrl: canonicalPlan.coach.selectedWasmUrl ?? "",
          origin: probeOrigin,
        })
      : null;

    const ok = primary.ok && (fallback ? fallback.ok : true) && (coach ? coach.ok : true);
    const errors = [primary, fallback, coach]
      .filter((entry): entry is ModelValidation => Boolean(entry))
      .filter((entry) => !entry.ok)
      .map((entry) => ({ modelId: entry.modelId, step: entry.rootCause.step, message: entry.rootCause.message, failureCode: entry.rootCause.failureCode }));

    return respond({
      ok,
      requestId,
      origin: probeOrigin,
      canonicalStatus: canonicalPlan.statusCode,
      invalidReasons: canonicalPlan.invalidReasons,
      runtimeModelOrder: canonicalPlan.runtimeModelOrder,
      missing,
      errors,
      corsTemplates: {
        downloadOnly: {
          AllowedOrigins: MODEL_CORS_ALLOWED_ORIGINS,
          AllowedMethods: ["GET", "HEAD"],
          AllowedHeaders: ["Range", "Content-Type", "If-None-Match", "If-Modified-Since", "Accept"],
          ExposeHeaders: ["ETag", "Accept-Ranges", "Content-Range", "Content-Length", "Content-Type"],
          MaxAgeSeconds: 86400,
        },
        uploadEnabled: {
          AllowedOrigins: MODEL_CORS_ALLOWED_ORIGINS,
          AllowedMethods: ["GET", "HEAD", "PUT"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag", "Accept-Ranges", "Content-Range", "Content-Length", "Content-Type"],
          MaxAgeSeconds: 86400,
        },
      },
      guidance: {
        options: "R2 CORS AllowedMethods does not accept OPTIONS. Do not add OPTIONS.",
      },
      primary,
      fallback: fallback ?? undefined,
      coach: coach ?? undefined,
    });
  } catch (error) {
    return respond({
      ok: false,
      requestId,
      missing: [],
      errors: [
        {
          modelId: "asset-validator",
          step: "unexpected_error",
          message: error instanceof Error ? error.message : "Unknown error",
          failureCode: "UNKNOWN",
        },
      ],
      message: "Validator failed unexpectedly. See errors for details.",
    });
  }
}
