/**
 * This is the DB-independent decision contract for fail_edu_publish_commit_v1.
 * Capability verification and begin lease claim occur before this contract.
 * Actual mutation belongs in a row-locked RPC transaction.
 * Request-only capability errors must never become stored attempt failures.
 */

import {
  validateEduPublishBeginCommitBinding,
} from "@/lib/edu/publish/beginCommitContract";
import {
  EDU_PUBLISH_ATTEMPT_REQUEST_ONLY_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_STATES,
  classifyEduPublishAttemptFailureMutation,
  decideEduPublishAttemptWorkerTransition,
  type EduPublishAttemptRestartRequiredFailureCode,
  type EduPublishAttemptRetryableFailureCode,
  type EduPublishAttemptState,
} from "@/lib/edu/publish/attemptState";

export const EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES = [
  "R2_TEMPORARY_FAILURE",
  "DB_TEMPORARY_FAILURE",
  "RPC_TEMPORARY_FAILURE",
  "INTERNAL_EVALUATION_FAILED",
  "R2_OBJECT_MISSING",
  "R2_SIZE_MISMATCH",
  "R2_DIGEST_MISMATCH",
  "SLUG_CONFLICT",
] as const;

export type EduPublishFailCommitFailureCode =
  (typeof EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES)[number];

export const EDU_PUBLISH_FAIL_COMMIT_OUTCOMES = [
  "FAILED_RETRYABLE",
  "FAILED_RESTART_REQUIRED",
  "LEASE_EXPIRED",
  "LEASE_MISMATCH",
  "VERSION_MISMATCH",
  "BINDING_MISMATCH",
  "STATE_CONFLICT",
  "INVALID_INPUT",
] as const;

export type EduPublishFailCommitOutcome =
  (typeof EDU_PUBLISH_FAIL_COMMIT_OUTCOMES)[number];

export type EduPublishFailCommitHandlerAction =
  | "return_retryable_failure"
  | "return_restart_required"
  | "reject_lease_expired"
  | "reject_lease_mismatch"
  | "reject_version_mismatch"
  | "reject_binding"
  | "reject_state_conflict"
  | "fail_internal_contract";

export function decideEduPublishFailCommitHandlerAction(
  outcome: unknown,
): EduPublishFailCommitHandlerAction {
  switch (outcome) {
    case "FAILED_RETRYABLE":
      return "return_retryable_failure";
    case "FAILED_RESTART_REQUIRED":
      return "return_restart_required";
    case "LEASE_EXPIRED":
      return "reject_lease_expired";
    case "LEASE_MISMATCH":
      return "reject_lease_mismatch";
    case "VERSION_MISMATCH":
      return "reject_version_mismatch";
    case "BINDING_MISMATCH":
      return "reject_binding";
    case "STATE_CONFLICT":
      return "reject_state_conflict";
    case "INVALID_INPUT":
    default:
      return "fail_internal_contract";
  }
}

export type EduPublishFailCommitBinding = {
  attemptId: string;
  slug: string;
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;
  leaseOwner: string;
  expectedAttemptVersion: number;
  failureCode: EduPublishFailCommitFailureCode;
};

export type EduPublishFailCommitBindingValidation =
  | {
      ok: true;
      binding: EduPublishFailCommitBinding;
    }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "invalid_attempt"
        | "invalid_slug"
        | "invalid_manifest"
        | "invalid_lease_owner"
        | "invalid_version"
        | "invalid_failure_code";
    };

export type EduPublishFailCommitAttemptObservation = {
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

export type EduPublishFailCommitDecisionInput = {
  requested: unknown;
  nowSeconds: unknown;
  attempt: EduPublishFailCommitAttemptObservation | null;
};

export type EduPublishFailCommitMutationPatch = {
  state: "FAILED_RETRYABLE" | "FAILED_RESTART_REQUIRED";

  attemptVersion: number;
  retryCount: number;
  commitCount: number;

  leaseOwner: null;
  leaseExpiresAtSeconds: null;

  projectId: null;
  failureCode: EduPublishFailCommitFailureCode;
  failedAtSeconds: number;
};

export type EduPublishFailCommitDecision =
  | {
      action: "mutate";
      outcome: "FAILED_RETRYABLE" | "FAILED_RESTART_REQUIRED";
      next: EduPublishFailCommitMutationPatch;
    }
  | {
      action: "return";
      outcome:
        | "LEASE_EXPIRED"
        | "LEASE_MISMATCH"
        | "VERSION_MISMATCH"
        | "BINDING_MISMATCH"
        | "STATE_CONFLICT"
        | "INVALID_INPUT";
    }
  | {
      action: "raise";
      reason:
        | "stored_attempt_invalid"
        | "counter_overflow"
        | "worker_contract_failure";
    };

type PlainObject = Record<string, unknown>;
type StoredFailureCode =
  | EduPublishAttemptRetryableFailureCode
  | EduPublishAttemptRestartRequiredFailureCode;
type WorkerRejectionReason =
  | "invalid_snapshot"
  | "invalid_input"
  | "invalid_state"
  | "version_mismatch"
  | "lease_owner_mismatch"
  | "lease_expired";

const FAIL_COMMIT_BINDING_KEYS = [
  "attemptId",
  "slug",
  "manifestSchemaVersion",
  "declaredManifestDigest",
  "leaseOwner",
  "expectedAttemptVersion",
  "failureCode",
] as const;

const OBSERVATION_VALIDATION_LEASE_OWNER =
  "00000000-0000-4000-8000-000000000001";

function isPlainObject(value: unknown): value is PlainObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnKeys(value: PlainObject, keys: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value);
  return (
    ownKeys.length === keys.length &&
    ownKeys.every((key) => typeof key === "string" && keys.includes(key)) &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
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

function invalidBinding(
  reason: Exclude<EduPublishFailCommitBindingValidation, { ok: true }>["reason"],
): EduPublishFailCommitBindingValidation {
  return { ok: false, reason };
}

function isAllowedFailCommitFailureCode(
  value: unknown,
): value is EduPublishFailCommitFailureCode {
  const classification = classifyEduPublishAttemptFailureMutation(value);
  if (isOneOf(value, EDU_PUBLISH_ATTEMPT_REQUEST_ONLY_FAILURE_CODES)) return false;
  if (!isOneOf(value, EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES)) return false;
  return classification === "retryable" || classification === "restart_required";
}

export function validateEduPublishFailCommitBinding(
  value: unknown,
): EduPublishFailCommitBindingValidation {
  if (!isPlainObject(value) || !hasExactOwnKeys(value, FAIL_COMMIT_BINDING_KEYS)) {
    return invalidBinding("invalid_payload");
  }

  const beginValidation = validateEduPublishBeginCommitBinding({
    attemptId: value.attemptId,
    slug: value.slug,
    manifestSchemaVersion: value.manifestSchemaVersion,
    declaredManifestDigest: value.declaredManifestDigest,
    leaseOwner: value.leaseOwner,
  });
  if (!beginValidation.ok) return invalidBinding(beginValidation.reason);
  if (!isNonNegativeSafeInteger(value.expectedAttemptVersion)) {
    return invalidBinding("invalid_version");
  }
  if (!isAllowedFailCommitFailureCode(value.failureCode)) {
    return invalidBinding("invalid_failure_code");
  }

  return {
    ok: true,
    binding: {
      ...beginValidation.binding,
      expectedAttemptVersion: value.expectedAttemptVersion,
      failureCode: value.failureCode,
    },
  };
}

function isValidStoredFailureCode(value: unknown): value is StoredFailureCode {
  return (
    isOneOf(value, EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES) ||
    isOneOf(value, EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES)
  );
}

function isValidObservationIdentity(value: PlainObject): boolean {
  const validation = validateEduPublishBeginCommitBinding({
    attemptId: value.attemptId,
    slug: value.slug,
    manifestSchemaVersion: value.manifestSchemaVersion,
    declaredManifestDigest: value.declaredManifestDigest,
    leaseOwner: value.leaseOwner ?? OBSERVATION_VALIDATION_LEASE_OWNER,
  });
  return validation.ok;
}

function isValidStoredAttemptObservation(
  value: unknown,
): value is EduPublishFailCommitAttemptObservation {
  if (!isPlainObject(value)) return false;
  if (!isValidObservationIdentity(value)) return false;
  if (!isOneOf(value.state, EDU_PUBLISH_ATTEMPT_STATES)) return false;
  if (!isNonNegativeSafeInteger(value.attemptVersion)) return false;
  if (!isNonNegativeSafeInteger(value.retryCount) || value.retryCount > 3) return false;
  if (!isNonNegativeSafeInteger(value.commitCount)) return false;
  if (!isPositiveSafeInteger(value.expiresAtSeconds)) return false;

  const validLeaseOwner = value.leaseOwner === null ||
    validateEduPublishBeginCommitBinding({
      attemptId: value.attemptId,
      slug: value.slug,
      manifestSchemaVersion: value.manifestSchemaVersion,
      declaredManifestDigest: value.declaredManifestDigest,
      leaseOwner: value.leaseOwner,
    }).ok;
  const validLeaseExpiry =
    value.leaseExpiresAtSeconds === null || isPositiveSafeInteger(value.leaseExpiresAtSeconds);
  if (!validLeaseOwner || !validLeaseExpiry) return false;
  if ((value.leaseOwner === null) !== (value.leaseExpiresAtSeconds === null)) return false;

  if (value.projectId !== null && !isNonEmptyString(value.projectId)) return false;
  if (
    value.failureCode !== null &&
    value.failureCode !== "ATTEMPT_EXPIRED" &&
    !isValidStoredFailureCode(value.failureCode)
  ) {
    return false;
  }

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
  requested: EduPublishFailCommitBinding,
  attempt: EduPublishFailCommitAttemptObservation,
): boolean {
  return (
    requested.attemptId === attempt.attemptId &&
    requested.slug === attempt.slug &&
    requested.manifestSchemaVersion === attempt.manifestSchemaVersion &&
    requested.declaredManifestDigest === attempt.declaredManifestDigest
  );
}

function mapWorkerRejection(reason: WorkerRejectionReason): EduPublishFailCommitDecision {
  switch (reason) {
    case "invalid_state":
      return { action: "return", outcome: "STATE_CONFLICT" };
    case "version_mismatch":
      return { action: "return", outcome: "VERSION_MISMATCH" };
    case "lease_owner_mismatch":
      return { action: "return", outcome: "LEASE_MISMATCH" };
    case "lease_expired":
      return { action: "return", outcome: "LEASE_EXPIRED" };
    case "invalid_snapshot":
      return { action: "raise", reason: "stored_attempt_invalid" };
    case "invalid_input":
      return { action: "raise", reason: "worker_contract_failure" };
  }
}

export function decideEduPublishFailCommit(
  input: EduPublishFailCommitDecisionInput,
): EduPublishFailCommitDecision {
  if (!isPlainObject(input)) return { action: "return", outcome: "INVALID_INPUT" };

  const requestedValidation = validateEduPublishFailCommitBinding(input.requested);
  if (!requestedValidation.ok) return { action: "return", outcome: "INVALID_INPUT" };
  if (!isNonNegativeSafeInteger(input.nowSeconds)) {
    return { action: "return", outcome: "INVALID_INPUT" };
  }

  if (input.attempt !== null && !isValidStoredAttemptObservation(input.attempt)) {
    return { action: "raise", reason: "stored_attempt_invalid" };
  }
  if (input.attempt === null) return { action: "return", outcome: "BINDING_MISMATCH" };

  const requested = requestedValidation.binding;
  const attempt = input.attempt;
  const nowSeconds = input.nowSeconds;

  if (!sameBinding(requested, attempt)) {
    return { action: "return", outcome: "BINDING_MISMATCH" };
  }

  if (attempt.state === "VALIDATING" && attempt.attemptVersion === Number.MAX_SAFE_INTEGER) {
    return { action: "raise", reason: "counter_overflow" };
  }

  const classification = classifyEduPublishAttemptFailureMutation(requested.failureCode);
  const worker = classification === "retryable"
    ? decideEduPublishAttemptWorkerTransition({
        snapshot: {
          state: attempt.state,
          attemptVersion: attempt.attemptVersion,
          retryCount: attempt.retryCount,
          expiresAtSeconds: attempt.expiresAtSeconds,
          leaseOwner: attempt.leaseOwner,
          leaseExpiresAtSeconds: attempt.leaseExpiresAtSeconds,
          projectId: attempt.projectId,
        },
        expectedAttemptVersion: requested.expectedAttemptVersion,
        leaseOwner: requested.leaseOwner,
        nowSeconds,
        event: {
          type: "retryable_failure",
          failureCode: requested.failureCode as EduPublishAttemptRetryableFailureCode,
        },
      })
    : decideEduPublishAttemptWorkerTransition({
        snapshot: {
          state: attempt.state,
          attemptVersion: attempt.attemptVersion,
          retryCount: attempt.retryCount,
          expiresAtSeconds: attempt.expiresAtSeconds,
          leaseOwner: attempt.leaseOwner,
          leaseExpiresAtSeconds: attempt.leaseExpiresAtSeconds,
          projectId: attempt.projectId,
        },
        expectedAttemptVersion: requested.expectedAttemptVersion,
        leaseOwner: requested.leaseOwner,
        nowSeconds,
        event: {
          type: "restart_required_failure",
          failureCode: requested.failureCode as EduPublishAttemptRestartRequiredFailureCode,
        },
      });

  if (worker.action === "reject") return mapWorkerRejection(worker.reason);
  if (classification !== "retryable" && classification !== "restart_required") {
    return { action: "raise", reason: "worker_contract_failure" };
  }

  const expectedState = classification === "retryable"
    ? "FAILED_RETRYABLE"
    : "FAILED_RESTART_REQUIRED";
  if (
    worker.next.state !== expectedState ||
    worker.next.leaseOwner !== null ||
    worker.next.leaseExpiresAtSeconds !== null ||
    worker.next.projectId !== null
  ) {
    return { action: "raise", reason: "worker_contract_failure" };
  }

  return {
    action: "mutate",
    outcome: expectedState,
    next: {
      state: expectedState,
      attemptVersion: worker.next.attemptVersion,
      retryCount: worker.next.retryCount,
      commitCount: attempt.commitCount,
      leaseOwner: null,
      leaseExpiresAtSeconds: null,
      projectId: null,
      failureCode: requested.failureCode,
      failedAtSeconds: nowSeconds,
    },
  };
}
