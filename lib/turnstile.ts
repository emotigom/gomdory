import { hmacSha256, toHex } from "@/lib/crypto/webcrypto";
import { logEvent } from "@/lib/ops/logEvent";
import { readTurnstileFailOpen, readTurnstileLogSalt, readTurnstileSecretKey } from "@/lib/env/appConfig";
import { readEnvString } from "@/lib/server/runtimeEnv";

export type TurnstileVerificationResult = {
  ok: boolean;
  error?: string;
  errorCodes?: string[];
  status?: number;
  challengeTs?: string;
  skipped?: boolean;
  networkError?: boolean;
};

export type TurnstileFailureBucket =
  | "TOKEN_MISSING"
  | "TOKEN_EXPIRED_OR_REPLAY"
  | "BAD_REQUEST"
  | "NETWORK"
  | "SERVICE_DOWN"
  | "UNKNOWN";

export type TurnstileTelemetryContext = {
  requestId: string;
  route: string;
  action: string;
  originHost?: string | null;
  refererHost?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  shareCode?: string | null;
  cfRay?: string | null;
  colo?: string | null;
  cookiePresent?: boolean;
  expectedHostname?: string | null;
  expectedAction?: string | null;
  expectedCdata?: string | null;
  meta?: Record<string, unknown>;
};

export type TurnstileTelemetryResult =
  | { ok: true; requestId: string }
  | {
      ok: false;
      code: "TURNSTILE_FAILED";
      reasonBucket: TurnstileFailureBucket;
      retryable: boolean;
      userMessage: string;
      hint: string;
      requestId: string;
      errorCodes?: string[];
    };

const MIN_TURNSTILE_TOKEN_LENGTH = 20;
const DEFAULT_HINT =
  "브라우저에서 새로고침 후 다시 시도해 주세요. 계속 실패하면 다른 브라우저/시크릿 모드로 시도해 보세요.";

function resolveLogSecret() {
  // phase-5: keep behavior but route env access via canonical helper/fallback chain.
  return readTurnstileLogSalt() ?? readTurnstileSecretKey() ?? "";
}

async function hashValue(value: string | null | undefined, length: number) {
  if (!value) return undefined;
  const secret = resolveLogSecret();
  if (!secret) return undefined;
  const digest = await hmacSha256(value, secret);
  return toHex(digest).slice(0, length);
}

function extractHost(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value).host || undefined;
    }
  } catch {
    return undefined;
  }
  return value;
}

function classifyReasonBucket(
  errorCodes?: string[],
  status?: number,
  networkError?: boolean,
): TurnstileFailureBucket {
  if (networkError) return "NETWORK";
  if (status && status >= 500) return "SERVICE_DOWN";
  const codes = errorCodes ?? [];
  if (codes.includes("timeout-or-duplicate")) return "TOKEN_EXPIRED_OR_REPLAY";
  if (codes.includes("missing-input-response")) return "TOKEN_MISSING";
  if (codes.includes("invalid-input-response") || codes.includes("bad-request")) return "BAD_REQUEST";
  if (codes.includes("missing-input-secret") || codes.includes("invalid-input-secret")) return "SERVICE_DOWN";
  if (status && status >= 400 && status < 500) return "BAD_REQUEST";
  return "UNKNOWN";
}

function reasonMessage(reason: TurnstileFailureBucket) {
  switch (reason) {
    case "TOKEN_MISSING":
      return "보안 확인이 필요해요. 체크 후 다시 시도해 주세요.";
    case "TOKEN_EXPIRED_OR_REPLAY":
      return "보안 확인이 만료되었어요. 다시 체크하고 접속해 주세요.";
    case "BAD_REQUEST":
      return "보안 확인을 다시 진행해 주세요.";
    case "NETWORK":
    case "SERVICE_DOWN":
      return "네트워크가 불안정해요. 잠시 후 다시 시도해 주세요.";
    case "UNKNOWN":
    default:
      return "보안 확인에 문제가 발생했어요. 다시 시도해 주세요.";
  }
}

function isRetryable(reason: TurnstileFailureBucket) {
  switch (reason) {
    case "TOKEN_MISSING":
    case "TOKEN_EXPIRED_OR_REPLAY":
    case "BAD_REQUEST":
    case "NETWORK":
    case "SERVICE_DOWN":
    case "UNKNOWN":
    default:
      return true;
  }
}

function toUserMessage(errorCodes?: string[]): string {
  const codes = errorCodes ?? [];

  // 가장 흔한 케이스: 이미 사용된 토큰 재사용, 또는 만료
  if (codes.includes("timeout-or-duplicate")) {
    return "Turnstile 인증이 만료되었거나 이미 사용되었습니다. 다시 인증해주세요.";
  }

  if (codes.includes("missing-input-response")) {
    return "Turnstile 토큰이 누락되었습니다. 다시 시도해주세요.";
  }

  if (codes.includes("invalid-input-response")) {
    return "Turnstile 토큰이 유효하지 않습니다. 다시 인증해주세요.";
  }

  if (codes.includes("missing-input-secret") || codes.includes("invalid-input-secret")) {
    return "서버 Turnstile 설정이 올바르지 않습니다. 관리자에게 문의해주세요.";
  }

  if (codes.includes("internal-error")) {
    return "Turnstile 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  // 그 외에는 원본 코드들을 보여주되, 너무 비면 일반 메시지
  return codes.length ? `Turnstile 인증 실패: ${codes.join(", ")}` : "Turnstile 인증에 실패했습니다. 다시 시도해주세요.";
}

async function performTurnstileVerification(
  token: string,
  ip?: string | null,
  expected?: { hostname?: string; action?: string; cdata?: string },
): Promise<TurnstileVerificationResult> {
  if (!token) {
    return { ok: false, error: "Turnstile 토큰이 없습니다. 다시 인증해주세요." };
  }

  const secret = readTurnstileSecretKey();
  if (!secret) {
    if (readTurnstileFailOpen()) {
      console.warn("[turnstile] FAIL_OPEN enabled; skipping verification");
      return { ok: true, skipped: true };
    }
    return { ok: false, error: "TURNSTILE_SECRET_KEY is not set", status: 500 };
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  if (ip) {
    formData.append("remoteip", ip);
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      return {
        ok: false,
        error: `Turnstile 검증 서버 응답 오류 (status: ${response.status})`,
        status: response.status,
      };
    }

    const data = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
      challenge_ts?: string;
      hostname?: string;
      action?: string;
      cdata?: string;
    };

    if (!data?.success) {
      return {
        ok: false,
        error: toUserMessage(data?.["error-codes"]),
        errorCodes: data?.["error-codes"],
        challengeTs: data?.challenge_ts,
      };
    }
    if ((expected?.hostname && data.hostname !== expected.hostname) || (expected?.action && data.action !== expected.action) || (expected?.cdata && data.cdata !== expected.cdata)) {
      return { ok: false, error: "Turnstile response binding mismatch", errorCodes: ["invalid-input-response"] };
    }

    return { ok: true, challengeTs: data?.challenge_ts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `Turnstile 검증 중 오류가 발생했습니다: ${message}`, networkError: true };
  }
}

export async function verifyTurnstileToken(
  token: string,
  ip?: string | null,
): Promise<TurnstileVerificationResult> {
  return performTurnstileVerification(token, ip);
}

export async function verifyTurnstileTokenWithTelemetry(
  token: string,
  context: TurnstileTelemetryContext,
): Promise<TurnstileTelemetryResult> {
  const startedAt = Date.now();
  const trimmedToken = token.trim();
  const originHost = extractHost(context.originHost ?? undefined);
  const refererHost = extractHost(context.refererHost ?? undefined);
  const expectedHostname = extractHost(context.expectedHostname ?? originHost ?? refererHost);
  const env = readEnvString("VERCEL_ENV") ?? readEnvString("NODE_ENV") ?? "unknown";

  const metaBase: Record<string, unknown> = {
    originHost,
    refererHost,
    env,
    cfRay: context.cfRay ?? undefined,
    colo: context.colo ?? undefined,
    cookiePresent: context.cookiePresent ?? undefined,
    ...(context.meta ?? {}),
  };

  const [ipHash, uaHash, shareCodeHash] = await Promise.all([
    hashValue(context.ip ?? undefined, 10),
    hashValue(context.userAgent ?? undefined, 10),
    hashValue(context.shareCode ?? undefined, 8),
  ]);

  const enrichedMeta = {
    ...metaBase,
    ipHash,
    uaHash,
    shareCodeHash,
  };

  if (!trimmedToken || trimmedToken.length < MIN_TURNSTILE_TOKEN_LENGTH) {
    const reasonBucket: TurnstileFailureBucket = "TOKEN_MISSING";
    const userMessage = reasonMessage(reasonBucket);
    const hint = DEFAULT_HINT;
    logEvent({
      level: "warn",
      stage: "turnstile_verify",
      requestId: context.requestId,
      route: context.route,
      action: context.action,
      ok: false,
      code: "TURNSTILE_FAILED",
      reason: reasonBucket,
      meta: {
        ...enrichedMeta,
        verifyLatencyMs: Date.now() - startedAt,
        reasonBucket,
      },
    });
    logEvent({
      level: "warn",
      stage: "turnstile_fail_bucket",
      requestId: context.requestId,
      route: context.route,
      action: context.action,
      ok: false,
      code: "TURNSTILE_FAILED",
      reason: reasonBucket,
      meta: {
        reasonBucket,
        originHost,
        refererHost,
      },
    });
    return {
      ok: false,
      code: "TURNSTILE_FAILED",
      reasonBucket,
      retryable: isRetryable(reasonBucket),
      userMessage,
      hint,
      requestId: context.requestId,
    };
  }

  const result = await performTurnstileVerification(trimmedToken, context.ip ?? undefined, {
    hostname: expectedHostname,
    action: context.expectedAction ?? undefined,
    cdata: context.expectedCdata ?? undefined,
  });
  const latencyMs = Date.now() - startedAt;
  let tokenAgeMs: number | undefined;
  if (result.challengeTs) {
    const parsed = new Date(result.challengeTs).getTime();
    tokenAgeMs = Number.isFinite(parsed) ? Math.max(0, Date.now() - parsed) : undefined;
  }

  if (result.ok) {
    logEvent({
      level: "info",
      stage: "turnstile_verify",
      requestId: context.requestId,
      route: context.route,
      action: context.action,
      ok: true,
      meta: {
        ...enrichedMeta,
        verifyLatencyMs: latencyMs,
        tokenAgeMs,
        skipped: result.skipped ?? undefined,
      },
    });
    return { ok: true, requestId: context.requestId };
  }

  const reasonBucket = classifyReasonBucket(result.errorCodes, result.status, result.networkError);
  const userMessage = reasonMessage(reasonBucket);
  const hint = DEFAULT_HINT;

  logEvent({
    level: "warn",
    stage: "turnstile_verify",
    requestId: context.requestId,
    route: context.route,
    action: context.action,
    ok: false,
    code: "TURNSTILE_FAILED",
    reason: reasonBucket,
    meta: {
      ...enrichedMeta,
      verifyLatencyMs: latencyMs,
      tokenAgeMs,
      reasonBucket,
      errorCodes: result.errorCodes ?? undefined,
      status: result.status ?? undefined,
    },
  });
  logEvent({
    level: "warn",
    stage: "turnstile_fail_bucket",
    requestId: context.requestId,
    route: context.route,
    action: context.action,
    ok: false,
    code: "TURNSTILE_FAILED",
    reason: reasonBucket,
    meta: {
      reasonBucket,
      originHost,
      refererHost,
    },
  });

  return {
    ok: false,
    code: "TURNSTILE_FAILED",
    reasonBucket,
    retryable: isRetryable(reasonBucket),
    userMessage,
    hint,
    requestId: context.requestId,
    errorCodes: result.errorCodes,
  };
}
