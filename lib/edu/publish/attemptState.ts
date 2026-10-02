/**
 * This is a DB-independent state decision contract.
 * Actual mutation belongs in an RPC transaction with a row lock, expected
 * version, and lease-owner comparison. Claim must complete before R2
 * validation; capability request errors must not mutate the attempt state.
 */

export const EDU_PUBLISH_ATTEMPT_STATES = [
  "PREPARED",
  "VALIDATING",
  "PUBLISHED",
  "FAILED_RETRYABLE",
  "FAILED_RESTART_REQUIRED",
  "ABANDONED",
] as const;

export const EDU_PUBLISH_ATTEMPT_DEFAULT_LEASE_SECONDS = 5 * 60;
export const EDU_PUBLISH_ATTEMPT_MAX_SAME_ATTEMPT_RETRIES = 3;

export type EduPublishAttemptState = (typeof EDU_PUBLISH_ATTEMPT_STATES)[number];

export type EduPublishAttemptSnapshot = {
  state: EduPublishAttemptState;
  attemptVersion: number;
  retryCount: number;
  expiresAtSeconds: number;
  leaseOwner: string | null;
  leaseExpiresAtSeconds: number | null;
  projectId: string | null;
};

export type EduPublishAttemptClaimDecision =
  | {
      action: "claim";
      reason: "initial" | "retry" | "stale_lease_takeover";
      next: EduPublishAttemptSnapshot;
    }
  | { action: "reuse"; reason: "already_published"; projectId: string }
  | { action: "conflict"; reason: "lease_active"; retryAfterSeconds: number }
  | {
      action: "reject";
      reason:
        | "attempt_expired"
        | "restart_required"
        | "abandoned"
        | "retry_limit_exceeded"
        | "invalid_snapshot"
        | "invalid_input";
    };

export const EDU_PUBLISH_ATTEMPT_REQUEST_ONLY_FAILURE_CODES = [
  "CAPABILITY_INVALID",
  "CAPABILITY_EXPIRED",
  "CAPABILITY_MISMATCH",
  "ATTEMPT_STATE_CONFLICT",
  "ATTEMPT_LEASE_ACTIVE",
] as const;

export type EduPublishAttemptRequestOnlyFailureCode =
  (typeof EDU_PUBLISH_ATTEMPT_REQUEST_ONLY_FAILURE_CODES)[number];

export const EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES = [
  "R2_TEMPORARY_FAILURE",
  "DB_TEMPORARY_FAILURE",
  "RPC_TEMPORARY_FAILURE",
  "INTERNAL_EVALUATION_FAILED",
] as const;

export type EduPublishAttemptRetryableFailureCode =
  (typeof EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES)[number];

export const EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES = [
  "R2_OBJECT_MISSING",
  "R2_SIZE_MISMATCH",
  "R2_DIGEST_MISMATCH",
  "ATTEMPT_EXPIRED",
  "SLUG_CONFLICT",
] as const;

export type EduPublishAttemptRestartRequiredFailureCode =
  (typeof EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES)[number];

export function classifyEduPublishAttemptFailureMutation(
  code: unknown,
): "request_only" | "retryable" | "restart_required" | "unknown" {
  if (isOneOf(code, EDU_PUBLISH_ATTEMPT_REQUEST_ONLY_FAILURE_CODES)) return "request_only";
  if (isOneOf(code, EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES)) return "retryable";
  if (isOneOf(code, EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES)) return "restart_required";
  return "unknown";
}

export type EduPublishAttemptWorkerEvent =
  | { type: "publish_succeeded"; projectId: string }
  | { type: "retryable_failure"; failureCode: EduPublishAttemptRetryableFailureCode }
  | {
      type: "restart_required_failure";
      failureCode: EduPublishAttemptRestartRequiredFailureCode;
    };

export type EduPublishAttemptWorkerTransitionDecision =
  | { action: "transition"; next: EduPublishAttemptSnapshot }
  | {
      action: "reject";
      reason:
        | "invalid_snapshot"
        | "invalid_input"
        | "invalid_state"
        | "version_mismatch"
        | "lease_owner_mismatch"
        | "lease_expired";
    };

export type EduPublishAttemptCleanupDecision =
  | { action: "transition"; next: EduPublishAttemptSnapshot; reason: "expired_nonterminal" }
  | { action: "keep"; reason: "not_expired" | "active_lease" | "terminal" }
  | { action: "reject"; reason: "invalid_snapshot" | "invalid_input" };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAttemptState(value: unknown): value is EduPublishAttemptState {
  return isOneOf(value, EDU_PUBLISH_ATTEMPT_STATES);
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isValidNullableString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isValidSnapshot(value: unknown): value is EduPublishAttemptSnapshot {
  if (!isPlainObject(value)) return false;
  if (!isAttemptState(value.state)) return false;
  if (!isNonNegativeSafeInteger(value.attemptVersion)) return false;
  if (!isNonNegativeSafeInteger(value.retryCount)) return false;
  if (!isPositiveSafeInteger(value.expiresAtSeconds)) return false;
  if (!isValidNullableString(value.leaseOwner)) return false;
  if (value.leaseExpiresAtSeconds !== null && !isPositiveSafeInteger(value.leaseExpiresAtSeconds)) return false;
  if (!isValidNullableString(value.projectId)) return false;

  switch (value.state) {
    case "PREPARED":
    case "FAILED_RETRYABLE":
    case "FAILED_RESTART_REQUIRED":
    case "ABANDONED":
      return value.leaseOwner === null && value.leaseExpiresAtSeconds === null && value.projectId === null;
    case "VALIDATING":
      return value.leaseOwner !== null && value.leaseExpiresAtSeconds !== null && value.projectId === null;
    case "PUBLISHED":
      return value.leaseOwner === null && value.leaseExpiresAtSeconds === null && value.projectId !== null;
  }
}

function increment(value: number): number | null {
  const next = value + 1;
  return Number.isSafeInteger(next) ? next : null;
}

function rejectClaim(reason: Extract<EduPublishAttemptClaimDecision, { action: "reject" }>["reason"]): EduPublishAttemptClaimDecision {
  return { action: "reject", reason };
}

function rejectWorker(reason: Extract<EduPublishAttemptWorkerTransitionDecision, { action: "reject" }>["reason"]): EduPublishAttemptWorkerTransitionDecision {
  return { action: "reject", reason };
}

function rejectCleanup(reason: Extract<EduPublishAttemptCleanupDecision, { action: "reject" }>["reason"]): EduPublishAttemptCleanupDecision {
  return { action: "reject", reason };
}

function nextValidatingSnapshot(
  snapshot: EduPublishAttemptSnapshot,
  input: { leaseOwner: string; leaseExpiresAtSeconds: number; retryCount?: number },
): EduPublishAttemptSnapshot | null {
  const attemptVersion = increment(snapshot.attemptVersion);
  if (attemptVersion === null) return null;
  return {
    state: "VALIDATING",
    attemptVersion,
    retryCount: input.retryCount ?? snapshot.retryCount,
    expiresAtSeconds: snapshot.expiresAtSeconds,
    leaseOwner: input.leaseOwner,
    leaseExpiresAtSeconds: input.leaseExpiresAtSeconds,
    projectId: null,
  };
}

export function decideEduPublishAttemptClaim(input: {
  snapshot: EduPublishAttemptSnapshot;
  nowSeconds: number;
  leaseOwner: string;
  leaseSeconds?: number;
  maxSameAttemptRetries?: number;
}): EduPublishAttemptClaimDecision {
  if (!isPlainObject(input)) return rejectClaim("invalid_input");
  if (!isValidSnapshot(input.snapshot)) return rejectClaim("invalid_snapshot");
  if (!isNonNegativeSafeInteger(input.nowSeconds) || !isNonEmptyString(input.leaseOwner)) {
    return rejectClaim("invalid_input");
  }

  const leaseSeconds = input.leaseSeconds === undefined ? EDU_PUBLISH_ATTEMPT_DEFAULT_LEASE_SECONDS : input.leaseSeconds;
  const maxSameAttemptRetries = input.maxSameAttemptRetries === undefined
    ? EDU_PUBLISH_ATTEMPT_MAX_SAME_ATTEMPT_RETRIES
    : input.maxSameAttemptRetries;
  if (!isPositiveSafeInteger(leaseSeconds) || !isNonNegativeSafeInteger(maxSameAttemptRetries)) {
    return rejectClaim("invalid_input");
  }
  const leaseExpiresAtSeconds = input.nowSeconds + leaseSeconds;
  if (!Number.isSafeInteger(leaseExpiresAtSeconds)) return rejectClaim("invalid_input");

  const { snapshot, nowSeconds } = input;

  if (snapshot.state === "PUBLISHED") {
    if (!isNonEmptyString(snapshot.projectId)) return rejectClaim("invalid_snapshot");
    return { action: "reuse", reason: "already_published", projectId: snapshot.projectId };
  }
  if (snapshot.state === "FAILED_RESTART_REQUIRED") return rejectClaim("restart_required");
  if (snapshot.state === "ABANDONED") return rejectClaim("abandoned");
  if (nowSeconds >= snapshot.expiresAtSeconds) return rejectClaim("attempt_expired");

  if (snapshot.state === "PREPARED") {
    const next = nextValidatingSnapshot(snapshot, { leaseOwner: input.leaseOwner, leaseExpiresAtSeconds });
    return next === null ? rejectClaim("invalid_snapshot") : { action: "claim", reason: "initial", next };
  }

  if (snapshot.state === "FAILED_RETRYABLE") {
    if (snapshot.retryCount >= maxSameAttemptRetries) return rejectClaim("retry_limit_exceeded");
    const retryCount = snapshot.retryCount + 1;
    if (!Number.isSafeInteger(retryCount)) return rejectClaim("invalid_snapshot");
    const next = nextValidatingSnapshot(snapshot, {
      leaseOwner: input.leaseOwner,
      leaseExpiresAtSeconds,
      retryCount,
    });
    return next === null ? rejectClaim("invalid_snapshot") : { action: "claim", reason: "retry", next };
  }

  if (snapshot.leaseExpiresAtSeconds === null) return rejectClaim("invalid_snapshot");
  if (nowSeconds < snapshot.leaseExpiresAtSeconds) {
    return {
      action: "conflict",
      reason: "lease_active",
      retryAfterSeconds: Math.max(1, Math.ceil(snapshot.leaseExpiresAtSeconds - nowSeconds)),
    };
  }
  const next = nextValidatingSnapshot(snapshot, { leaseOwner: input.leaseOwner, leaseExpiresAtSeconds });
  return next === null ? rejectClaim("invalid_snapshot") : { action: "claim", reason: "stale_lease_takeover", next };
}

export function decideEduPublishAttemptWorkerTransition(input: {
  snapshot: EduPublishAttemptSnapshot;
  expectedAttemptVersion: number;
  leaseOwner: string;
  nowSeconds: number;
  event: EduPublishAttemptWorkerEvent;
}): EduPublishAttemptWorkerTransitionDecision {
  if (!isPlainObject(input)) return rejectWorker("invalid_input");
  if (!isValidSnapshot(input.snapshot)) return rejectWorker("invalid_snapshot");
  if (
    !isNonNegativeSafeInteger(input.expectedAttemptVersion) ||
    !isNonNegativeSafeInteger(input.nowSeconds) ||
    !isNonEmptyString(input.leaseOwner) ||
    !isPlainObject(input.event)
  ) {
    return rejectWorker("invalid_input");
  }

  const eventType = input.event.type;
  if (eventType === "publish_succeeded") {
    if (!isNonEmptyString(input.event.projectId)) return rejectWorker("invalid_input");
  } else if (eventType === "retryable_failure") {
    if (!isOneOf(input.event.failureCode, EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES)) return rejectWorker("invalid_input");
  } else if (eventType === "restart_required_failure") {
    if (!isOneOf(input.event.failureCode, EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES)) return rejectWorker("invalid_input");
  } else {
    return rejectWorker("invalid_input");
  }

  const { snapshot } = input;
  if (snapshot.state !== "VALIDATING") return rejectWorker("invalid_state");
  if (input.expectedAttemptVersion !== snapshot.attemptVersion) return rejectWorker("version_mismatch");
  if (snapshot.leaseOwner !== input.leaseOwner) return rejectWorker("lease_owner_mismatch");
  if (snapshot.leaseExpiresAtSeconds === null) return rejectWorker("invalid_snapshot");
  if (input.nowSeconds >= snapshot.leaseExpiresAtSeconds) return rejectWorker("lease_expired");

  const attemptVersion = increment(snapshot.attemptVersion);
  if (attemptVersion === null) return rejectWorker("invalid_snapshot");
  if (eventType === "publish_succeeded") {
    return {
      action: "transition",
      next: {
        state: "PUBLISHED",
        attemptVersion,
        retryCount: snapshot.retryCount,
        expiresAtSeconds: snapshot.expiresAtSeconds,
        leaseOwner: null,
        leaseExpiresAtSeconds: null,
        projectId: input.event.projectId,
      },
    };
  }

  return {
    action: "transition",
    next: {
      state: eventType === "retryable_failure" ? "FAILED_RETRYABLE" : "FAILED_RESTART_REQUIRED",
      attemptVersion,
      retryCount: snapshot.retryCount,
      expiresAtSeconds: snapshot.expiresAtSeconds,
      leaseOwner: null,
      leaseExpiresAtSeconds: null,
      projectId: null,
    },
  };
}

export function decideEduPublishAttemptCleanup(input: {
  snapshot: EduPublishAttemptSnapshot;
  nowSeconds: number;
}): EduPublishAttemptCleanupDecision {
  if (!isPlainObject(input)) return rejectCleanup("invalid_input");
  if (!isValidSnapshot(input.snapshot)) return rejectCleanup("invalid_snapshot");
  if (!isNonNegativeSafeInteger(input.nowSeconds)) return rejectCleanup("invalid_input");

  const { snapshot, nowSeconds } = input;
  if (snapshot.state === "PUBLISHED" || snapshot.state === "FAILED_RESTART_REQUIRED" || snapshot.state === "ABANDONED") {
    return { action: "keep", reason: "terminal" };
  }
  if (snapshot.state === "VALIDATING") {
    if (snapshot.leaseExpiresAtSeconds === null) return rejectCleanup("invalid_snapshot");
    if (nowSeconds < snapshot.leaseExpiresAtSeconds) return { action: "keep", reason: "active_lease" };
    if (nowSeconds < snapshot.expiresAtSeconds) return { action: "keep", reason: "not_expired" };
  } else if (nowSeconds < snapshot.expiresAtSeconds) {
    return { action: "keep", reason: "not_expired" };
  }

  const attemptVersion = increment(snapshot.attemptVersion);
  if (attemptVersion === null) return rejectCleanup("invalid_snapshot");
  return {
    action: "transition",
    reason: "expired_nonterminal",
    next: {
      state: "ABANDONED",
      attemptVersion,
      retryCount: snapshot.retryCount,
      expiresAtSeconds: snapshot.expiresAtSeconds,
      leaseOwner: null,
      leaseExpiresAtSeconds: null,
      projectId: null,
    },
  };
}
