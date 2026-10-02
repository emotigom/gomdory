import {
  EDU_PUBLISH_MANIFEST_SCHEMA_VERSION,
  classifyPublishAttemptCompatibility,
} from "@/lib/edu/publish/attemptCompatibility";
import {
  EDU_PUBLISH_ATTEMPT_DEFAULT_LEASE_SECONDS,
  EDU_PUBLISH_ATTEMPT_MAX_SAME_ATTEMPT_RETRIES,
  EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_STATES,
  type EduPublishAttemptRestartRequiredFailureCode,
  type EduPublishAttemptRetryableFailureCode,
  type EduPublishAttemptState,
} from "@/lib/edu/publish/attemptState";

/**
 * This is the DB-independent decision contract for begin_edu_publish_commit_v1.
 * Capability verification occurs before this contract. Actual mutation belongs
 * in a row-locked RPC transaction. PUBLISHED replay is terminal and remains
 * reusable after attempt expiry.
 */

export const EDU_PUBLISH_BEGIN_COMMIT_OUTCOMES = [
  "CLAIMED",
  "RECLAIMED_RETRYABLE",
  "TAKEN_OVER_STALE_LEASE",
  "ALREADY_PUBLISHED",
  "LEASE_ACTIVE",
  "ATTEMPT_EXPIRED",
  "BINDING_MISMATCH",
  "STATE_CONFLICT",
  "RETRY_EXHAUSTED",
  "INVALID_INPUT",
] as const;

export type EduPublishBeginCommitOutcome =
  (typeof EDU_PUBLISH_BEGIN_COMMIT_OUTCOMES)[number];

export type EduPublishBeginCommitHandlerAction =
  | "proceed"
  | "reuse_published"
  | "reject_lease_active"
  | "reject_attempt_expired"
  | "reject_binding"
  | "reject_state_conflict"
  | "reject_retry_exhausted"
  | "fail_internal_contract";

export function decideEduPublishBeginCommitHandlerAction(
  outcome: unknown,
): EduPublishBeginCommitHandlerAction {
  switch (outcome) {
    case "CLAIMED":
    case "RECLAIMED_RETRYABLE":
    case "TAKEN_OVER_STALE_LEASE":
      return "proceed";
    case "ALREADY_PUBLISHED":
      return "reuse_published";
    case "LEASE_ACTIVE":
      return "reject_lease_active";
    case "ATTEMPT_EXPIRED":
      return "reject_attempt_expired";
    case "BINDING_MISMATCH":
      return "reject_binding";
    case "STATE_CONFLICT":
      return "reject_state_conflict";
    case "RETRY_EXHAUSTED":
      return "reject_retry_exhausted";
    case "INVALID_INPUT":
    default:
      return "fail_internal_contract";
  }
}

export type EduPublishBeginCommitBinding = {
  attemptId: string;
  slug: string;
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;
  leaseOwner: string;
};

export type EduPublishBeginCommitBindingValidation =
  | {
      ok: true;
      binding: EduPublishBeginCommitBinding;
    }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "invalid_attempt"
        | "invalid_slug"
        | "invalid_manifest"
        | "invalid_lease_owner";
    };

export type EduPublishBeginCommitAttemptObservation = {
  attemptId: string;
  slug: string;
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;

  state: EduPublishAttemptState;

  attemptVersion: number;
  retryCount: number;
  commitCount: number;

  expiresAtSeconds: number;

  leaseOwner: string | null;
  leaseExpiresAtSeconds: number | null;

  projectId: string | null;
  failureCode:
    | EduPublishAttemptRetryableFailureCode
    | EduPublishAttemptRestartRequiredFailureCode
    | null;
};

export type EduPublishBeginCommitDecisionInput = {
  requested: unknown;
  nowSeconds: unknown;
  attempt: EduPublishBeginCommitAttemptObservation | null;
};

export type EduPublishBeginCommitMutationPatch = {
  state: "VALIDATING" | "ABANDONED";

  attemptVersion: number;
  retryCount: number;
  commitCount: number;

  leaseOwner: string | null;
  leaseExpiresAtSeconds: number | null;

  validationStartedAtSeconds: number | null;
  failedAtSeconds: number | null;

  failureCode: "ATTEMPT_EXPIRED" | null;
};

export type EduPublishBeginCommitDecision =
  | {
      action: "mutate";
      outcome:
        | "CLAIMED"
        | "RECLAIMED_RETRYABLE"
        | "TAKEN_OVER_STALE_LEASE"
        | "ATTEMPT_EXPIRED";
      next: EduPublishBeginCommitMutationPatch;
    }
  | {
      action: "return";
      outcome: "ALREADY_PUBLISHED";
      projectId: string;
    }
  | {
      action: "return";
      outcome:
        | "LEASE_ACTIVE"
        | "ATTEMPT_EXPIRED"
        | "BINDING_MISMATCH"
        | "STATE_CONFLICT"
        | "RETRY_EXHAUSTED"
        | "INVALID_INPUT";
    }
  | {
      action: "raise";
      reason:
        | "stored_attempt_invalid"
        | "counter_overflow"
        | "lease_expiry_overflow";
    };

type PlainObject = Record<string, unknown>;
type FailureCode =
  | EduPublishAttemptRetryableFailureCode
  | EduPublishAttemptRestartRequiredFailureCode;

const CANONICAL_LEASE_OWNER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function isPlainObject(value: unknown): value is PlainObject {
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

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isValidAttemptId(value: unknown): value is string {
  return classifyPublishAttemptCompatibility({
    publishAttemptId: value,
    declaredManifestDigest: "0".repeat(64),
    manifestSchemaVersion: EDU_PUBLISH_MANIFEST_SCHEMA_VERSION,
  }).mode === "attempt_v1";
}

function isValidSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 64 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

function isValidManifestDigest(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

function isValidLeaseOwner(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_LEASE_OWNER_UUID.test(value);
}

function invalidBinding(
  reason: Exclude<EduPublishBeginCommitBindingValidation, { ok: true }>['reason'],
): EduPublishBeginCommitBindingValidation {
  return { ok: false, reason };
}

export function validateEduPublishBeginCommitBinding(
  value: unknown,
): EduPublishBeginCommitBindingValidation {
  if (!isPlainObject(value)) return invalidBinding("invalid_payload");
  if (!isValidAttemptId(value.attemptId)) return invalidBinding("invalid_attempt");
  if (!isValidSlug(value.slug)) return invalidBinding("invalid_slug");
  if (
    value.manifestSchemaVersion !== EDU_PUBLISH_MANIFEST_SCHEMA_VERSION ||
    !isValidManifestDigest(value.declaredManifestDigest)
  ) {
    return invalidBinding("invalid_manifest");
  }
  if (!isValidLeaseOwner(value.leaseOwner)) return invalidBinding("invalid_lease_owner");

  return {
    ok: true,
    binding: {
      attemptId: value.attemptId,
      slug: value.slug,
      manifestSchemaVersion: EDU_PUBLISH_MANIFEST_SCHEMA_VERSION,
      declaredManifestDigest: value.declaredManifestDigest,
      leaseOwner: value.leaseOwner,
    },
  };
}

function isValidFailureCode(value: unknown): value is FailureCode {
  return (
    isOneOf(value, EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES) ||
    isOneOf(value, EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES)
  );
}

function isValidStoredAttemptObservation(
  value: unknown,
): value is EduPublishBeginCommitAttemptObservation {
  if (!isPlainObject(value)) return false;
  if (!isValidAttemptId(value.attemptId)) return false;
  if (!isValidSlug(value.slug)) return false;
  if (value.manifestSchemaVersion !== EDU_PUBLISH_MANIFEST_SCHEMA_VERSION) return false;
  if (!isValidManifestDigest(value.declaredManifestDigest)) return false;
  if (!isOneOf(value.state, EDU_PUBLISH_ATTEMPT_STATES)) return false;
  if (!isNonNegativeSafeInteger(value.attemptVersion)) return false;
  if (
    !isNonNegativeSafeInteger(value.retryCount) ||
    value.retryCount > EDU_PUBLISH_ATTEMPT_MAX_SAME_ATTEMPT_RETRIES
  ) {
    return false;
  }
  if (!isNonNegativeSafeInteger(value.commitCount)) return false;
  if (!isPositiveSafeInteger(value.expiresAtSeconds)) return false;

  const validLeaseOwner = value.leaseOwner === null || isValidLeaseOwner(value.leaseOwner);
  const validLeaseExpiry =
    value.leaseExpiresAtSeconds === null || isPositiveSafeInteger(value.leaseExpiresAtSeconds);
  if (!validLeaseOwner || !validLeaseExpiry) return false;
  if ((value.leaseOwner === null) !== (value.leaseExpiresAtSeconds === null)) return false;

  if (value.projectId !== null && !isNonEmptyString(value.projectId)) return false;
  if (value.failureCode !== null && !isValidFailureCode(value.failureCode)) return false;

  switch (value.state) {
    case "PREPARED":
      return (
        value.leaseOwner === null &&
        value.leaseExpiresAtSeconds === null &&
        value.projectId === null &&
        value.failureCode === null
      );
    case "VALIDATING":
      return (
        value.leaseOwner !== null &&
        value.leaseExpiresAtSeconds !== null &&
        value.projectId === null &&
        value.failureCode === null
      );
    case "PUBLISHED":
      return (
        value.leaseOwner === null &&
        value.leaseExpiresAtSeconds === null &&
        value.projectId !== null &&
        value.failureCode === null
      );
    case "FAILED_RETRYABLE":
      return (
        value.leaseOwner === null &&
        value.leaseExpiresAtSeconds === null &&
        value.projectId === null &&
        isOneOf(value.failureCode, EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES)
      );
    case "FAILED_RESTART_REQUIRED":
      return (
        value.leaseOwner === null &&
        value.leaseExpiresAtSeconds === null &&
        value.projectId === null &&
        isOneOf(value.failureCode, EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES)
      );
    case "ABANDONED":
      return (
        value.leaseOwner === null &&
        value.leaseExpiresAtSeconds === null &&
        value.projectId === null &&
        value.failureCode === "ATTEMPT_EXPIRED"
      );
  }
}

function sameBinding(
  requested: EduPublishBeginCommitBinding,
  attempt: EduPublishBeginCommitAttemptObservation,
): boolean {
  return (
    requested.attemptId === attempt.attemptId &&
    requested.slug === attempt.slug &&
    requested.manifestSchemaVersion === attempt.manifestSchemaVersion &&
    requested.declaredManifestDigest === attempt.declaredManifestDigest
  );
}

function increment(value: number): number | null {
  const next = value + 1;
  return Number.isSafeInteger(next) ? next : null;
}

function calculateLeaseExpiry(
  nowSeconds: number,
  attemptExpiresAtSeconds: number,
): number | null {
  const requestedLeaseEnd = nowSeconds + EDU_PUBLISH_ATTEMPT_DEFAULT_LEASE_SECONDS;
  if (!Number.isSafeInteger(requestedLeaseEnd)) return null;
  return Math.min(attemptExpiresAtSeconds, requestedLeaseEnd);
}

function expiryTransition(
  attempt: EduPublishBeginCommitAttemptObservation,
  nowSeconds: number,
): EduPublishBeginCommitDecision {
  const attemptVersion = increment(attempt.attemptVersion);
  if (attemptVersion === null) return { action: "raise", reason: "counter_overflow" };
  return {
    action: "mutate",
    outcome: "ATTEMPT_EXPIRED",
    next: {
      state: "ABANDONED",
      attemptVersion,
      retryCount: attempt.retryCount,
      commitCount: attempt.commitCount,
      leaseOwner: null,
      leaseExpiresAtSeconds: null,
      validationStartedAtSeconds: null,
      failedAtSeconds: nowSeconds,
      failureCode: "ATTEMPT_EXPIRED",
    },
  };
}

function validatingTransition(input: {
  attempt: EduPublishBeginCommitAttemptObservation;
  requested: EduPublishBeginCommitBinding;
  nowSeconds: number;
  outcome: "CLAIMED" | "RECLAIMED_RETRYABLE" | "TAKEN_OVER_STALE_LEASE";
  retryCount: number;
}): EduPublishBeginCommitDecision {
  const attemptVersion = increment(input.attempt.attemptVersion);
  const commitCount = increment(input.attempt.commitCount);
  if (attemptVersion === null || commitCount === null) {
    return { action: "raise", reason: "counter_overflow" };
  }

  const leaseExpiresAtSeconds = calculateLeaseExpiry(
    input.nowSeconds,
    input.attempt.expiresAtSeconds,
  );
  if (leaseExpiresAtSeconds === null) {
    return { action: "raise", reason: "lease_expiry_overflow" };
  }

  return {
    action: "mutate",
    outcome: input.outcome,
    next: {
      state: "VALIDATING",
      attemptVersion,
      retryCount: input.retryCount,
      commitCount,
      leaseOwner: input.requested.leaseOwner,
      leaseExpiresAtSeconds,
      validationStartedAtSeconds: input.nowSeconds,
      failedAtSeconds: null,
      failureCode: null,
    },
  };
}

export function decideEduPublishBeginCommit(
  input: EduPublishBeginCommitDecisionInput,
): EduPublishBeginCommitDecision {
  if (!isPlainObject(input)) return { action: "return", outcome: "INVALID_INPUT" };

  const requested = validateEduPublishBeginCommitBinding(input.requested);
  if (!requested.ok) return { action: "return", outcome: "INVALID_INPUT" };
  if (!isNonNegativeSafeInteger(input.nowSeconds)) {
    return { action: "return", outcome: "INVALID_INPUT" };
  }

  if (input.attempt !== null && !isValidStoredAttemptObservation(input.attempt)) {
    return { action: "raise", reason: "stored_attempt_invalid" };
  }
  if (input.attempt === null) return { action: "return", outcome: "BINDING_MISMATCH" };

  const attempt = input.attempt;
  const nowSeconds = input.nowSeconds;

  if (!sameBinding(requested.binding, attempt)) {
    return { action: "return", outcome: "BINDING_MISMATCH" };
  }

  if (attempt.state === "PUBLISHED") {
    if (attempt.projectId === null) return { action: "raise", reason: "stored_attempt_invalid" };
    return {
      action: "return",
      outcome: "ALREADY_PUBLISHED",
      projectId: attempt.projectId,
    };
  }
  if (attempt.state === "FAILED_RESTART_REQUIRED") {
    return { action: "return", outcome: "STATE_CONFLICT" };
  }
  if (attempt.state === "ABANDONED") {
    return { action: "return", outcome: "ATTEMPT_EXPIRED" };
  }

  if (attempt.expiresAtSeconds <= nowSeconds) return expiryTransition(attempt, nowSeconds);

  if (attempt.state === "PREPARED") {
    return validatingTransition({
      attempt,
      requested: requested.binding,
      nowSeconds,
      outcome: "CLAIMED",
      retryCount: attempt.retryCount,
    });
  }

  if (attempt.state === "FAILED_RETRYABLE") {
    if (attempt.retryCount >= EDU_PUBLISH_ATTEMPT_MAX_SAME_ATTEMPT_RETRIES) {
      return { action: "return", outcome: "RETRY_EXHAUSTED" };
    }
    const retryCount = increment(attempt.retryCount);
    if (retryCount === null) return { action: "raise", reason: "counter_overflow" };
    return validatingTransition({
      attempt,
      requested: requested.binding,
      nowSeconds,
      outcome: "RECLAIMED_RETRYABLE",
      retryCount,
    });
  }

  if (attempt.leaseExpiresAtSeconds === null) {
    return { action: "raise", reason: "stored_attempt_invalid" };
  }
  if (attempt.leaseExpiresAtSeconds > nowSeconds) {
    return { action: "return", outcome: "LEASE_ACTIVE" };
  }
  return validatingTransition({
    attempt,
    requested: requested.binding,
    nowSeconds,
    outcome: "TAKEN_OVER_STALE_LEASE",
    retryCount: attempt.retryCount,
  });
}
