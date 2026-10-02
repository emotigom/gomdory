import {
  readEduOpenAiProxyBaseUrl,
  readEduOpenAiProxyChatPath,
  readEduOpenAiProxyDecoratePath,
  readEduOpenAiProxyHealthPath,
  readEduOpenAiProxyTimeoutMs,
  readEduOpenAiProxyToken,
  readOpenAiDirectDisabled,
} from "@/lib/env/appConfig";
import {
  EDU_PROVIDER_RESULT,
  EDU_PROVIDER_TARGET,
  buildProviderFailureEnvelope,
  buildProviderResultStatus,
  normalizeProviderAttemptedValue,
  type EduAiProviderAttempted,
  type EduProviderResult,
  type EduProviderStatusCategory,
} from "@/lib/edu/providerBoundary";

import { type EduRouteResponseDraft } from "@/lib/server/eduRouteAdapterContracts";
import { emitEduRouteJsonResponse } from "@/lib/server/eduRouteAdapterUtils";

// -----------------------------------------------------------------------------
// phase-57 boundary clarification map (student mainline backend/service axis)
// -----------------------------------------------------------------------------
// 1) Adapter contracts      : `eduRouteAdapterContracts` (type-only contracts)
// 2) Adapter utilities      : `eduRouteAdapterUtils` (emit/run/read shared utils)
// 3) Identity helper        : `eduAiBackendIdentity` (lesson/share/rate-key normalize)
// 4) Backend/service helper : this file (`postEduAiBackend`, chat/coach service step)
// 5) Compatibility bridge   : keep-for-now re-exports below (rollback-safe aliases)
//
// IMPORTANT
// - This phase is clarification-only (comments/grouping/export organization).
// - Runtime behavior, response shape, provider fallback semantics remain unchanged.

// [keep-for-now re-export bridge | phase-56 stricter-threshold review]
// Scope: compatibility shim for student mainline route callsites that previously imported
// adapter contract/utility/identity symbols from this backend/service module.
//
// phase-56 inventory snapshot (stricter threshold, code search 기준):
//   - contract/utility/identity direct imports are converged at active student routes
//     (`ai/chat`, `coach/chat`, decorate handler).
//   - no active callsite currently imports adapter contract/utility/identity symbols
//     from this module via re-export.
//   - phase-54: removed truly unused `normalizeEduLessonId` re-export.
//   - phase-55: removed truly unused `EduRouteJsonResponseEmitter` type re-export.
//   - phase-56: additional removable candidate was not promoted because
//     keep-for-now alias 삭제 금지 + hidden/external consumer uncertainty under
//     stricter threshold made hold/observation safer than third shrinkage.
//   - backend service helpers (`postEduAiBackend`, student chat service helpers) remain
//     intentionally consumed from this module and are outside bridge shrinkage scope.
//
// Policy for this phase:
//   - keep-for-now: retain bridge exports for rollback-safe compatibility.
//   - hold: no third tiny shrinkage in phase-56 unless usage 0 + runtime-noop +
//     keep-for-now 정책 충돌 없음이 동시에 성립.
//   - observation-only: wrapper alias naming remains stable while service helper imports
//     continue from this module.
//
// Guardrails:
//   1) Do not expand bridge surface beyond compatibility symbols.
//   2) Do not mass-remove keep-for-now aliases in phase-56.

// --- compatibility bridge: adapter contract symbols (type-only re-export) ---
export type {
  EduRouteAdapterContext,
  EduRouteJsonResponseInput,
  EduRouteResponseDraft,
  RunEduRouteAdapterInput,
} from "@/lib/server/eduRouteAdapterContracts";

// [keep-for-now re-export bridge] prefer direct utility imports at new/updated callsites:
//   @/lib/server/eduRouteAdapterUtils
// phase-53 note: currently no known external imports of these utility symbols via
// `@/lib/server/eduAiBackendClient`; retained for rollback-safe compatibility only.
// --- compatibility bridge: adapter utility symbols ---
export { emitEduRouteJsonResponse, readEduRouteJsonBody, runEduRouteAdapter } from "@/lib/server/eduRouteAdapterUtils";

// [keep-for-now helper re-export bridge | phase-54 first actual shrinkage]
// Identity/rate-limit normalization helpers are still re-exported for compatibility,
// but phase-54에서 0-usage가 확인된 normalizeEduLessonId re-export를 1건 제거했다.
// 유지 항목(buildEduStudentRouteIdentity/buildEduStudentRateLimitKey/normalizeEduShareCode)은
// rollback-safe 관찰을 위해 keep-for-now 상태를 유지한다.
// --- compatibility bridge: identity helper symbols ---
export {
  buildEduStudentRateLimitKey,
  buildEduStudentRouteIdentity,
  normalizeEduShareCode,
} from "@/lib/server/eduAiBackendIdentity";

// -----------------------------------------------------------------------------
// backend/service helper contracts and diagnostics (runtime source-of-truth)
// -----------------------------------------------------------------------------

export type EduAiMappedReason =
  | "backend_unavailable"
  | "backend_timeout"
  | "backend_auth"
  | "openai_auth"
  | "openai_capacity"
  | "openai_upstream_5xx"
  | "unsupported_region"
  | "route_runtime_error"
  | "unknown";


export type EduAiBackendDiagnostics = {
  backendConfigured: boolean;
  backendStatus: number | null;
  backendRequestId: string | null;
  mappedReason: EduAiMappedReason;
  timeoutHit: boolean;
  providerAttempted: EduAiProviderAttempted;
  providerResult: EduProviderResult;
  providerStatusCategory: EduProviderStatusCategory;
  route?: string;
};

// [backend/service helper] providerBoundary diagnostics vocabulary adapter.
const buildBackendDiagnosticsProviderShape = (input: { status: number | null; timeoutHit: boolean; result?: unknown }) =>
  buildProviderResultStatus({
    status: input.status,
    timeoutHit: input.timeoutHit,
    result: input.result,
  });

const joinUrl = (base: string, path: string) => {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

// [backend/service helper] direct-openai gate passthrough used by decorate path.
export function isOpenAiDirectDisabled() {
  return readOpenAiDirectDisabled();
}

// [backend/service helper] backend proxy endpoint/token/timeout assembly.
export function readEduAiBackendConfig(kind: "chat" | "coach" | "decorate" | "health") {
  const baseUrl = readEduOpenAiProxyBaseUrl();
  const token = readEduOpenAiProxyToken();
  const timeoutMs = readEduOpenAiProxyTimeoutMs();

  const chatPath = readEduOpenAiProxyChatPath();
  const decoratePath = readEduOpenAiProxyDecoratePath();
  const healthPath = readEduOpenAiProxyHealthPath();

  const path =
    kind === "decorate"
      ? decoratePath
      : kind === "health"
        ? healthPath
        : kind === "coach"
          ? `${chatPath}?mode=coach`
          : chatPath;

  return {
    baseUrl,
    token,
    timeoutMs,
    configured: Boolean(baseUrl),
    endpointUrl: baseUrl ? joinUrl(baseUrl, path) : null,
  };
}

// [backend/service helper] backend status/snippet -> stable mapped reason taxonomy.
export function mapBackendFailure(status: number | null, bodySnippet: string | null, timeoutHit: boolean): EduAiMappedReason {
  if (timeoutHit) return "backend_timeout";
  if (status === null) return "backend_unavailable";
  if (status === 401 || status === 403) return "backend_auth";
  if (status === 429) return "openai_capacity";
  if (status >= 500) return "openai_upstream_5xx";
  const lowered = (bodySnippet ?? "").toLowerCase();
  if (lowered.includes("unsupported_country_region_territory") || lowered.includes("country, region, or territory not supported")) {
    return "unsupported_region";
  }
  if (lowered.includes("invalid_api_key") || lowered.includes("authentication")) return "openai_auth";
  return "unknown";
}

// [backend/service helper] backend response answer decoder (`message` -> `answer`).
export function readEduBackendAnswerOrNull(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as { message?: unknown; answer?: unknown };
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.answer === "string") return payload.answer;
  return null;
}

export function readEduBackendAnswerText(body: unknown): string {
  return readEduBackendAnswerOrNull(body) ?? "";
}

// [backend/service helper] canonical backend POST step (chat/coach/decorate/health).
export async function postEduAiBackend(input: {
  route: string;
  kind: "chat" | "coach" | "decorate" | "health";
  payload?: unknown;
  requestId: string;
  fetchFn?: typeof fetch;
}) {
  const fetchFn = input.fetchFn ?? fetch;
  const config = readEduAiBackendConfig(input.kind);
  if (!config.configured || !config.endpointUrl) {
    return {
      ok: false as const,
      diagnostics: {
        route: input.route,
        backendConfigured: false,
        backendStatus: null,
        backendRequestId: null,
        mappedReason: "backend_unavailable" as EduAiMappedReason,
        timeoutHit: false,
        providerAttempted: normalizeProviderAttemptedValue(EDU_PROVIDER_TARGET.backendProxy),
        ...buildBackendDiagnosticsProviderShape({ status: null, timeoutHit: false, result: EDU_PROVIDER_RESULT.failed }),
      },
      status: 503,
      body: null,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), config.timeoutMs);
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-request-id": input.requestId,
      "x-gom-request-id": input.requestId,
    };
    if (config.token) {
      headers.authorization = `Bearer ${config.token}`;
    }

    const response = await fetchFn(config.endpointUrl, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: input.payload === undefined ? undefined : JSON.stringify(input.payload),
    });

    const text = await response.text().catch(() => "");
    const snippet = text.slice(0, 300);
    const parsed = text ? ((JSON.parse(text) as unknown) ?? null) : null;
    const mappedReason = response.ok ? "unknown" : mapBackendFailure(response.status, snippet, false);

    return {
      ok: response.ok,
      status: response.status,
      body: parsed,
      diagnostics: {
        route: input.route,
        backendConfigured: true,
        backendStatus: response.status,
        backendRequestId: response.headers.get("x-request-id") ?? response.headers.get("x-gom-request-id"),
        mappedReason,
        timeoutHit: false,
        providerAttempted: normalizeProviderAttemptedValue(EDU_PROVIDER_TARGET.backendProxy),
        ...buildBackendDiagnosticsProviderShape({
          status: response.status,
          timeoutHit: false,
          result: response.ok ? EDU_PROVIDER_RESULT.ok : EDU_PROVIDER_RESULT.failed,
        }),
      },
    };
  } catch (error) {
    const timeoutHit = error instanceof Error && error.name === "AbortError";
    return {
      ok: false as const,
      status: timeoutHit ? 504 : 502,
      body: null,
      diagnostics: {
        route: input.route,
        backendConfigured: true,
        backendStatus: null,
        backendRequestId: null,
        mappedReason: timeoutHit ? "backend_timeout" : "backend_unavailable",
        timeoutHit,
        providerAttempted: normalizeProviderAttemptedValue(EDU_PROVIDER_TARGET.backendProxy),
        ...buildBackendDiagnosticsProviderShape({ status: null, timeoutHit, result: EDU_PROVIDER_RESULT.failed }),
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

type EduAiBackendCallResult = Awaited<ReturnType<typeof postEduAiBackend>>;

type EduAiBackendAnswerStepInput = {
  route: string;
  requestId: string;
  kind: "chat" | "coach";
  payload: unknown;
  fetchFn?: typeof fetch;
};

export type EduAiBackendAnswerStepResult =
  | {
      ok: true;
      backend: EduAiBackendCallResult;
      answer: string;
    }
  | {
      ok: false;
      stage: "backend_failure" | "answer_missing";
      backend: EduAiBackendCallResult;
    };

// [route-local alias wrapper] keep-for-now alias used by existing chat/coach callsites.
export type EduAiStudentRouteResponseAssembly = EduRouteResponseDraft;

// [backend/service helper] route payload envelope helper: backend failure branch.
export function buildEduAiStudentBackendFailureEnvelope<TBase extends Record<string, unknown>>(input: {
  base: TBase;
  backend: EduAiBackendCallResult;
  result?: unknown;
}) {
  return buildProviderFailureEnvelope({
    base: input.base,
    diagnostics: input.backend.diagnostics,
    result: input.result,
  });
}

// [backend/service helper] route payload envelope helper: answer missing branch.
export function buildEduAiStudentAnswerMissingPayload(input: { message: string; code?: string; reason?: string }) {
  const payload: Record<string, unknown> = {
    ok: false,
    message: input.message,
  };
  if (input.code) payload.code = input.code;
  if (input.reason) payload.reason = input.reason;
  return payload;
}

// [backend/service helper] route payload envelope helper: success branch.
export function buildEduAiStudentSuccessPayload(input: {
  answer: string;
  includeMessage?: boolean;
  provider?: string;
  remoteTargetKind?: string;
}) {
  const payload: Record<string, unknown> = {
    ok: true,
    answer: input.answer,
  };
  if (input.includeMessage) payload.message = input.answer;
  if (input.provider) payload.provider = input.provider;
  if (input.remoteTargetKind) payload.remoteTargetKind = input.remoteTargetKind;
  return payload;
}

export type EduServiceStepDecisionHandlers<TDraft> = {
  onBackendFailure: (input: { backend: EduAiBackendCallResult }) => TDraft;
  onAnswerMissing: (input: { backend: EduAiBackendCallResult }) => TDraft;
  onSuccess: (input: { backend: EduAiBackendCallResult; answer: string }) => TDraft;
};

type EduAiStudentBackendStepDecisionHandlers<T> = EduServiceStepDecisionHandlers<T>;

// [backend/service helper] route service entry for chat/coach backend step orchestration.
export async function runEduAiStudentChatRouteService(input: {
  route: string;
  requestId: string;
  kind: "chat" | "coach";
  payload: unknown;
  fetchFn?: typeof fetch;
  handlers: EduAiStudentBackendStepDecisionHandlers<EduAiStudentRouteResponseAssembly>;
}): Promise<EduAiStudentRouteResponseAssembly> {
  const step = await runEduAiStudentChatBackendStep({
    route: input.route,
    requestId: input.requestId,
    kind: input.kind,
    payload: input.payload,
    fetchFn: input.fetchFn,
  });

  return finalizeEduAiStudentChatBackendResponse({
    step,
    handlers: input.handlers,
  });
}

export function emitEduAiStudentRouteJsonResponse(input: {
  payload: Record<string, unknown>;
  status: number;
  requestId: string;
  extraHeaders?: Record<string, string>;
}) {
  // [route-local alias wrapper] chat/coach naming is preserved for callsite readability.
  return emitEduRouteJsonResponse(input);
}

// [backend/service helper] service-step decision mapper (backend failure / missing / success).
export function decideEduAiStudentChatBackendStepResult<T>(input: {
  step: EduAiBackendAnswerStepResult;
  handlers: EduAiStudentBackendStepDecisionHandlers<T>;
}): T {
  if (input.step.ok) {
    return input.handlers.onSuccess({
      backend: input.step.backend,
      answer: input.step.answer,
    });
  }

  if (input.step.stage === "backend_failure") {
    return input.handlers.onBackendFailure({ backend: input.step.backend });
  }

  return input.handlers.onAnswerMissing({ backend: input.step.backend });
}

// [backend/service helper] route response finalizer alias.
export function finalizeEduAiStudentChatBackendResponse(input: {
  step: EduAiBackendAnswerStepResult;
  handlers: EduAiStudentBackendStepDecisionHandlers<EduAiStudentRouteResponseAssembly>;
}): EduAiStudentRouteResponseAssembly {
  return decideEduAiStudentChatBackendStepResult({
    step: input.step,
    handlers: input.handlers,
  });
}

// [backend/service helper] backend call + answer extraction step.
export async function runEduAiStudentChatBackendStep(input: EduAiBackendAnswerStepInput): Promise<EduAiBackendAnswerStepResult> {
  const backend = await postEduAiBackend({
    route: input.route,
    kind: input.kind,
    requestId: input.requestId,
    payload: input.payload,
    fetchFn: input.fetchFn,
  });

  if (!backend.ok) {
    return {
      ok: false,
      stage: "backend_failure",
      backend,
    };
  }

  const answer = readEduBackendAnswerOrNull(backend.body ?? null);
  if (!answer) {
    return {
      ok: false,
      stage: "answer_missing",
      backend,
    };
  }

  return {
    ok: true,
    backend,
    answer,
  };
}
