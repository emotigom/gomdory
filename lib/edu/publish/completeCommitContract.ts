/**
 * This is the DB-independent decision contract for complete_edu_publish_commit_v1.
 * Capability verification, begin lease claim, and R2 byte verification occur
 * first. Actual project creation and attempt/reservation mutation belong in one
 * row-locked RPC transaction.
 */

import {
  validateEduPublishBeginCommitBinding,
} from "@/lib/edu/publish/beginCommitContract";
import {
  EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_STATES,
  decideEduPublishAttemptWorkerTransition,
  type EduPublishAttemptRestartRequiredFailureCode,
  type EduPublishAttemptRetryableFailureCode,
  type EduPublishAttemptState,
} from "@/lib/edu/publish/attemptState";
import type {
  EduPublishSlugReservationState,
} from "@/lib/edu/publish/prepareAttemptContract";

export const EDU_PUBLISH_COMPLETE_COMMIT_OUTCOMES = [
  "PUBLISHED",
  "ALREADY_PUBLISHED",
  "LEASE_EXPIRED",
  "LEASE_MISMATCH",
  "VERSION_MISMATCH",
  "BINDING_MISMATCH",
  "RESERVATION_MISMATCH",
  "STATE_CONFLICT",
  "INVALID_INPUT",
] as const;

export type EduPublishCompleteCommitOutcome =
  (typeof EDU_PUBLISH_COMPLETE_COMMIT_OUTCOMES)[number];

export type EduPublishCompleteCommitHandlerAction =
  | "return_published"
  | "return_already_published"
  | "reject_lease_expired"
  | "reject_lease_mismatch"
  | "reject_version_mismatch"
  | "reject_binding"
  | "reject_reservation"
  | "reject_state_conflict"
  | "fail_internal_contract";

export function decideEduPublishCompleteCommitHandlerAction(
  outcome: unknown,
): EduPublishCompleteCommitHandlerAction {
  switch (outcome) {
    case "PUBLISHED":
      return "return_published";
    case "ALREADY_PUBLISHED":
      return "return_already_published";
    case "LEASE_EXPIRED":
      return "reject_lease_expired";
    case "LEASE_MISMATCH":
      return "reject_lease_mismatch";
    case "VERSION_MISMATCH":
      return "reject_version_mismatch";
    case "BINDING_MISMATCH":
      return "reject_binding";
    case "RESERVATION_MISMATCH":
      return "reject_reservation";
    case "STATE_CONFLICT":
      return "reject_state_conflict";
    case "INVALID_INPUT":
    default:
      return "fail_internal_contract";
  }
}

export type EduPublishCompleteCommitBinding = {
  attemptId: string;
  slug: string;
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;
  verifiedManifestDigest: string;
  leaseOwner: string;
  expectedAttemptVersion: number;
  projectId: string;
};

export type EduPublishCompleteCommitBindingValidation =
  | {
      ok: true;
      binding: EduPublishCompleteCommitBinding;
    }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "invalid_attempt"
        | "invalid_slug"
        | "invalid_manifest"
        | "invalid_verified_manifest"
        | "invalid_lease_owner"
        | "invalid_version"
        | "invalid_project";
    };

export type EduPublishCompleteCommitAttemptObservation = {
  attemptId: string;
  slug: string;
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;
  verifiedManifestDigest: string | null;

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

export type EduPublishCompleteCommitReservationObservation = {
  slug: string;
  attemptId: string | null;
  projectId: string | null;
  reservationState: EduPublishSlugReservationState;
};

export type EduPublishCompleteCommitDecisionInput = {
  requested: unknown;
  nowSeconds: unknown;

  attempt: EduPublishCompleteCommitAttemptObservation | null;

  reservation: EduPublishCompleteCommitReservationObservation | null;
};

export type EduPublishCompleteCommitAttemptMutationPatch = {
  state: "PUBLISHED";

  attemptVersion: number;
  retryCount: number;
  commitCount: number;

  leaseOwner: null;
  leaseExpiresAtSeconds: null;

  projectId: string;
  verifiedManifestDigest: string;

  failureCode: null;
  publishedAtSeconds: number;
};

export type EduPublishCompleteCommitReservationMutationPatch = {
  reservationState: "PROJECT_PUBLISHED";
  attemptId: string;
  projectId: string;
  convertedAtSeconds: number;
};

export type EduPublishCompleteCommitDecision =
  | {
      action: "mutate";
      outcome: "PUBLISHED";
      attemptNext: EduPublishCompleteCommitAttemptMutationPatch;
      reservationNext: EduPublishCompleteCommitReservationMutationPatch;
    }
  | {
      action: "return";
      outcome:
        | "ALREADY_PUBLISHED"
        | "LEASE_EXPIRED"
        | "LEASE_MISMATCH"
        | "VERSION_MISMATCH"
        | "BINDING_MISMATCH"
        | "RESERVATION_MISMATCH"
        | "STATE_CONFLICT"
        | "INVALID_INPUT";
    }
  | {
      action: "raise";
      reason:
        | "stored_attempt_invalid"
        | "stored_reservation_invalid"
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

const COMPLETE_COMMIT_BINDING_KEYS = [
  "attemptId",
  "slug",
  "manifestSchemaVersion",
  "declaredManifestDigest",
  "verifiedManifestDigest",
  "leaseOwner",
  "expectedAttemptVersion",
  "projectId",
] as const;

const ATTEMPT_OBSERVATION_KEYS = [
  "attemptId",
  "slug",
  "manifestSchemaVersion",
  "declaredManifestDigest",
  "verifiedManifestDigest",
  "state",
  "attemptVersion",
  "retryCount",
  "commitCount",
  "expiresAtSeconds",
  "leaseOwner",
  "leaseExpiresAtSeconds",
  "projectId",
  "failureCode",
] as const;

const RESERVATION_OBSERVATION_KEYS = [
  "slug",
  "attemptId",
  "projectId",
  "reservationState",
] as const;

const OBSERVATION_VALIDATION_LEASE_OWNER =
  "00000000-0000-4000-8000-000000000001";
const OBSERVATION_VALIDATION_ATTEMPT_ID =
  "00000000-0000-4000-8000-000000000001";
const ZERO_DIGEST = "0".repeat(64);
const SHA256_HEX = /^[0-9a-f]{64}$/;
const CANONICAL_PROJECT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

function hasRequiredOwnKeys(value: PlainObject, keys: readonly string[]): boolean {
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isValidProjectId(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_PROJECT_UUID.test(value);
}

function isValidSha256Digest(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX.test(value);
}

function invalidBinding(
  reason: Exclude<EduPublishCompleteCommitBindingValidation, { ok: true }>["reason"],
): EduPublishCompleteCommitBindingValidation {
  return { ok: false, reason };
}

export function validateEduPublishCompleteCommitBinding(
  value: unknown,
): EduPublishCompleteCommitBindingValidation {
  if (!isPlainObject(value) || !hasExactOwnKeys(value, COMPLETE_COMMIT_BINDING_KEYS)) {
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
  if (
    !isValidSha256Digest(value.verifiedManifestDigest) ||
    value.verifiedManifestDigest !== value.declaredManifestDigest
  ) {
    return invalidBinding("invalid_verified_manifest");
  }
  if (!isNonNegativeSafeInteger(value.expectedAttemptVersion)) {
    return invalidBinding("invalid_version");
  }
  if (
    !isValidProjectId(value.projectId) ||
    value.projectId === value.attemptId ||
    value.projectId === value.leaseOwner
  ) {
    return invalidBinding("invalid_project");
  }

  return {
    ok: true,
    binding: {
      ...beginValidation.binding,
      verifiedManifestDigest: value.verifiedManifestDigest,
      expectedAttemptVersion: value.expectedAttemptVersion,
      projectId: value.projectId,
    },
  };
}

function isValidStoredAttemptIdentity(value: PlainObject): boolean {
  const validation = validateEduPublishBeginCommitBinding({
    attemptId: value.attemptId,
    slug: value.slug,
    manifestSchemaVersion: value.manifestSchemaVersion,
    declaredManifestDigest: value.declaredManifestDigest,
    leaseOwner: value.leaseOwner ?? OBSERVATION_VALIDATION_LEASE_OWNER,
  });
  return validation.ok;
}

function isValidStoredFailureCode(value: unknown): value is StoredFailureCode {
  return (
    isOneOf(value, EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES) ||
    isOneOf(value, EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES)
  );
}

function isValidStoredAttemptObservation(
  value: unknown,
): value is EduPublishCompleteCommitAttemptObservation {
  if (
    !isPlainObject(value) ||
    !hasExactOwnKeys(value, ATTEMPT_OBSERVATION_KEYS) ||
    !isValidStoredAttemptIdentity(value)
  ) {
    return false;
  }
  if (!isValidSha256Digest(value.declaredManifestDigest)) return false;
  if (value.verifiedManifestDigest !== null && !isValidSha256Digest(value.verifiedManifestDigest)) {
    return false;
  }
  if (!isOneOf(value.state, EDU_PUBLISH_ATTEMPT_STATES)) return false;
  if (!isNonNegativeSafeInteger(value.attemptVersion)) return false;
  if (!isNonNegativeSafeInteger(value.retryCount) || value.retryCount > 3) return false;
  if (!isNonNegativeSafeInteger(value.commitCount)) return false;
  if (!isPositiveSafeInteger(value.expiresAtSeconds)) return false;

  const leaseOwnerValid =
    value.leaseOwner === null ||
    validateEduPublishBeginCommitBinding({
      attemptId: value.attemptId,
      slug: value.slug,
      manifestSchemaVersion: value.manifestSchemaVersion,
      declaredManifestDigest: value.declaredManifestDigest,
      leaseOwner: value.leaseOwner,
    }).ok;
  const leaseExpiryValid =
    value.leaseExpiresAtSeconds === null || isPositiveSafeInteger(value.leaseExpiresAtSeconds);
  if (!leaseOwnerValid || !leaseExpiryValid) return false;
  if ((value.leaseOwner === null) !== (value.leaseExpiresAtSeconds === null)) return false;
  if (value.projectId !== null && !isValidProjectId(value.projectId)) return false;
  if (value.failureCode !== null && !isValidStoredFailureCode(value.failureCode)) return false;

  switch (value.state) {
    case "PREPARED":
      return (
        value.leaseOwner === null &&
        value.leaseExpiresAtSeconds === null &&
        value.projectId === null &&
        value.verifiedManifestDigest === null &&
        value.failureCode === null
      );
    case "VALIDATING":
      return (
        value.leaseOwner !== null &&
        value.leaseExpiresAtSeconds !== null &&
        value.projectId === null &&
        value.verifiedManifestDigest === null &&
        value.failureCode === null
      );
    case "PUBLISHED":
      return (
        value.leaseOwner === null &&
        value.leaseExpiresAtSeconds === null &&
        value.projectId !== null &&
        value.verifiedManifestDigest !== null &&
        value.verifiedManifestDigest === value.declaredManifestDigest &&
        value.failureCode === null
      );
    case "FAILED_RETRYABLE":
      return (
        value.leaseOwner === null &&
        value.leaseExpiresAtSeconds === null &&
        value.projectId === null &&
        value.verifiedManifestDigest === null &&
        isOneOf(value.failureCode, EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES)
      );
    case "FAILED_RESTART_REQUIRED":
      return (
        value.leaseOwner === null &&
        value.leaseExpiresAtSeconds === null &&
        value.projectId === null &&
        value.verifiedManifestDigest === null &&
        isOneOf(value.failureCode, EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES)
      );
    case "ABANDONED":
      return (
        value.leaseOwner === null &&
        value.leaseExpiresAtSeconds === null &&
        value.projectId === null &&
        value.verifiedManifestDigest === null &&
        value.failureCode === "ATTEMPT_EXPIRED"
      );
  }
}

function isValidReservationState(value: unknown): value is EduPublishSlugReservationState {
  switch (value) {
    case "LEGACY_PROJECT":
    case "ATTEMPT_RESERVED":
    case "PROJECT_PUBLISHED":
    case "TOMBSTONED":
      return true;
    default:
      return false;
  }
}

function isValidStoredReservationObservation(
  value: unknown,
): value is EduPublishCompleteCommitReservationObservation {
  if (
    !isPlainObject(value) ||
    !hasExactOwnKeys(value, RESERVATION_OBSERVATION_KEYS) ||
    !isValidReservationState(value.reservationState)
  ) {
    return false;
  }
  if (
    !validateEduPublishBeginCommitBinding({
      attemptId: value.attemptId ?? OBSERVATION_VALIDATION_ATTEMPT_ID,
      slug: value.slug,
      manifestSchemaVersion: 1,
      declaredManifestDigest: ZERO_DIGEST,
      leaseOwner: OBSERVATION_VALIDATION_LEASE_OWNER,
    }).ok
  ) {
    return false;
  }
  if (
    value.attemptId !== null &&
    !validateEduPublishBeginCommitBinding({
      attemptId: value.attemptId,
      slug: value.slug,
      manifestSchemaVersion: 1,
      declaredManifestDigest: ZERO_DIGEST,
      leaseOwner: OBSERVATION_VALIDATION_LEASE_OWNER,
    }).ok
  ) {
    return false;
  }
  if (value.projectId !== null && !isValidProjectId(value.projectId)) return false;

  switch (value.reservationState) {
    case "LEGACY_PROJECT":
      return value.attemptId === null && value.projectId !== null;
    case "ATTEMPT_RESERVED":
      return value.attemptId !== null && value.projectId === null;
    case "PROJECT_PUBLISHED":
      return value.attemptId !== null && value.projectId !== null;
    case "TOMBSTONED":
      return value.attemptId === null && value.projectId === null;
  }
}

function sameAttemptBinding(
  requested: EduPublishCompleteCommitBinding,
  attempt: EduPublishCompleteCommitAttemptObservation,
): boolean {
  return (
    requested.attemptId === attempt.attemptId &&
    requested.slug === attempt.slug &&
    requested.manifestSchemaVersion === attempt.manifestSchemaVersion &&
    requested.declaredManifestDigest === attempt.declaredManifestDigest
  );
}

function mapWorkerRejection(reason: WorkerRejectionReason): EduPublishCompleteCommitDecision {
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

export function decideEduPublishCompleteCommit(
  input: EduPublishCompleteCommitDecisionInput,
): EduPublishCompleteCommitDecision {
  if (
    !isPlainObject(input) ||
    !hasRequiredOwnKeys(input, ["requested", "nowSeconds", "attempt", "reservation"])
  ) {
    return { action: "return", outcome: "INVALID_INPUT" };
  }

  const requestedValidation = validateEduPublishCompleteCommitBinding(input.requested);
  if (!requestedValidation.ok) return { action: "return", outcome: "INVALID_INPUT" };
  if (!isNonNegativeSafeInteger(input.nowSeconds)) {
    return { action: "return", outcome: "INVALID_INPUT" };
  }

  if (input.attempt !== null && !isValidStoredAttemptObservation(input.attempt)) {
    return { action: "raise", reason: "stored_attempt_invalid" };
  }
  if (input.reservation !== null && !isValidStoredReservationObservation(input.reservation)) {
    return { action: "raise", reason: "stored_reservation_invalid" };
  }

  if (input.attempt === null) return { action: "return", outcome: "BINDING_MISMATCH" };

  const requested = requestedValidation.binding;
  const attempt = input.attempt;
  const nowSeconds = input.nowSeconds;

  if (!sameAttemptBinding(requested, attempt)) {
    return { action: "return", outcome: "BINDING_MISMATCH" };
  }
  if (input.reservation === null) return { action: "return", outcome: "RESERVATION_MISMATCH" };

  const reservation = input.reservation;
  if (reservation.slug !== requested.slug || reservation.attemptId !== requested.attemptId) {
    return { action: "return", outcome: "RESERVATION_MISMATCH" };
  }

  if (attempt.state === "PUBLISHED") {
    if (
      attempt.projectId !== requested.projectId ||
      attempt.verifiedManifestDigest !== requested.verifiedManifestDigest
    ) {
      return { action: "return", outcome: "BINDING_MISMATCH" };
    }
    if (
      reservation.reservationState !== "PROJECT_PUBLISHED" ||
      reservation.attemptId !== requested.attemptId ||
      reservation.projectId !== requested.projectId
    ) {
      return { action: "return", outcome: "RESERVATION_MISMATCH" };
    }
    return { action: "return", outcome: "ALREADY_PUBLISHED" };
  }

  if (
    reservation.reservationState !== "ATTEMPT_RESERVED" ||
    reservation.attemptId !== requested.attemptId ||
    reservation.projectId !== null
  ) {
    return { action: "return", outcome: "RESERVATION_MISMATCH" };
  }
  if (attempt.state !== "VALIDATING") {
    return { action: "return", outcome: "STATE_CONFLICT" };
  }
  if (attempt.attemptVersion === Number.MAX_SAFE_INTEGER) {
    return { action: "raise", reason: "counter_overflow" };
  }

  const worker = decideEduPublishAttemptWorkerTransition({
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
      type: "publish_succeeded",
      projectId: requested.projectId,
    },
  });

  if (worker.action === "reject") return mapWorkerRejection(worker.reason);
  if (
    worker.next.state !== "PUBLISHED" ||
    worker.next.attemptVersion !== attempt.attemptVersion + 1 ||
    worker.next.retryCount !== attempt.retryCount ||
    worker.next.leaseOwner !== null ||
    worker.next.leaseExpiresAtSeconds !== null ||
    worker.next.projectId !== requested.projectId
  ) {
    return { action: "raise", reason: "worker_contract_failure" };
  }

  return {
    action: "mutate",
    outcome: "PUBLISHED",
    attemptNext: {
      state: "PUBLISHED",
      attemptVersion: worker.next.attemptVersion,
      retryCount: attempt.retryCount,
      commitCount: attempt.commitCount,
      leaseOwner: null,
      leaseExpiresAtSeconds: null,
      projectId: requested.projectId,
      verifiedManifestDigest: requested.verifiedManifestDigest,
      failureCode: null,
      publishedAtSeconds: nowSeconds,
    },
    reservationNext: {
      reservationState: "PROJECT_PUBLISHED",
      attemptId: requested.attemptId,
      projectId: requested.projectId,
      convertedAtSeconds: nowSeconds,
    },
  };
}
