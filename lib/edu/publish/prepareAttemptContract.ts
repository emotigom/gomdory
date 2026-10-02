import {
  classifyPublishAttemptCompatibility,
  EDU_PUBLISH_MANIFEST_SCHEMA_VERSION,
} from "@/lib/edu/publish/attemptCompatibility";
import {
  EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS,
  EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS,
} from "@/lib/edu/publish/commitCapability";
import {
  EDU_PUBLISH_ATTEMPT_STATES,
  type EduPublishAttemptState,
} from "@/lib/edu/publish/attemptState";

/**
 * This contract classifies initial prepare RPC outcomes.
 * ALREADY_PREPARED is server-internal exact RPC replay, not end-to-end HTTP
 * prepare idempotency. Freshness against current time applies only to new
 * creation. Existing exact replay uses stored equality and attempt expiry.
 */

export const EDU_PUBLISH_PREPARE_ATTEMPT_OUTCOMES = [
  "CREATED",
  "ALREADY_PREPARED",
  "SLUG_CONFLICT",
  "ATTEMPT_ID_CONFLICT",
  "STATE_CONFLICT",
  "INVALID_INPUT",
] as const;

export type EduPublishPrepareAttemptOutcome =
  (typeof EDU_PUBLISH_PREPARE_ATTEMPT_OUTCOMES)[number];

export type EduPublishPrepareAttemptHandlerAction =
  | "proceed"
  | "retry_slug"
  | "retry_attempt_identity"
  | "reject_state_conflict"
  | "fail_internal_contract";

export function decideEduPublishPrepareAttemptHandlerAction(
  outcome: unknown,
): EduPublishPrepareAttemptHandlerAction {
  switch (outcome) {
    case "CREATED":
    case "ALREADY_PREPARED":
      return "proceed";
    case "SLUG_CONFLICT":
      return "retry_slug";
    case "ATTEMPT_ID_CONFLICT":
      return "retry_attempt_identity";
    case "STATE_CONFLICT":
      return "reject_state_conflict";
    case "INVALID_INPUT":
    default:
      return "fail_internal_contract";
  }
}

export type EduPublishPrepareAttemptBinding = {
  attemptId: string;
  slug: string;
  lessonId: number;
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;
  declaredManifestCanonicalJson: string;
  capabilityIssuedAtSeconds: number;
  capabilityExpiresAtSeconds: number;
  capabilityKid: string;
};

export type EduPublishPrepareAttemptBindingValidation =
  | {
      ok: true;
      binding: EduPublishPrepareAttemptBinding;
    }
  | {
      ok: false;
      reason:
        | "invalid_payload"
        | "invalid_attempt"
        | "invalid_slug"
        | "invalid_lesson"
        | "invalid_manifest"
        | "invalid_capability_time"
        | "invalid_capability_kid";
    };

export type EduPublishPrepareAttemptFreshnessDecision =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason:
        | "invalid_input"
        | "issued_too_old"
        | "issued_in_future"
        | "already_expired";
    };

export type EduPublishSlugReservationState =
  | "LEGACY_PROJECT"
  | "ATTEMPT_RESERVED"
  | "PROJECT_PUBLISHED"
  | "TOMBSTONED";

export type EduPublishSlugReservationObservation = {
  slug: string;
  attemptId: string | null;
  projectId: string | null;
  reservationState: EduPublishSlugReservationState;
};

export type EduPublishPrepareAttemptObservation = EduPublishPrepareAttemptBinding & {
  state: EduPublishAttemptState;
  attemptVersion: number;
  expiresAtSeconds: number;
};

export type EduPublishPrepareAttemptConflictInput = {
  requested: unknown;
  nowSeconds: unknown;

  reservationBySlug: EduPublishSlugReservationObservation | null;
  reservationByAttemptId: EduPublishSlugReservationObservation | null;
  attemptById: EduPublishPrepareAttemptObservation | null;
};

export type EduPublishPrepareAttemptConflictDecision =
  | {
      action: "return";
      outcome:
        | "ALREADY_PREPARED"
        | "SLUG_CONFLICT"
        | "ATTEMPT_ID_CONFLICT"
        | "STATE_CONFLICT"
        | "INVALID_INPUT";
    }
  | {
      action: "raise";
      reason:
        | "missing_conflict_owner"
        | "reservation_marker_without_attempt"
        | "attempt_without_matching_reservation"
        | "reservation_observation_mismatch"
        | "stored_attempt_invalid";
    };

type PlainObject = Record<string, unknown>;

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
  return typeof value === "string" && value.length > 0;
}

function isValidSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 64 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

function isValidKid(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,32}$/.test(value);
}

function isValidAttemptId(value: unknown): value is string {
  return (
    classifyPublishAttemptCompatibility({
      publishAttemptId: value,
      declaredManifestDigest: "0".repeat(64),
      manifestSchemaVersion: EDU_PUBLISH_MANIFEST_SCHEMA_VERSION,
    }).mode === "attempt_v1"
  );
}

function isValidManifestJson(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }
  if (!isPlainObject(parsed)) return false;
  return (
    parsed.schemaVersion === EDU_PUBLISH_MANIFEST_SCHEMA_VERSION &&
    parsed.entryPoint === "index.html" &&
    Array.isArray(parsed.files)
  );
}

function isValidManifestDigest(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function invalidBinding(
  reason: Exclude<EduPublishPrepareAttemptBindingValidation, { ok: true }>["reason"],
): EduPublishPrepareAttemptBindingValidation {
  return { ok: false, reason };
}

export function validateEduPublishPrepareAttemptBinding(
  value: unknown,
): EduPublishPrepareAttemptBindingValidation {
  if (!isPlainObject(value)) return invalidBinding("invalid_payload");
  if (!isValidAttemptId(value.attemptId)) return invalidBinding("invalid_attempt");
  if (!isValidSlug(value.slug)) return invalidBinding("invalid_slug");
  if (!isNonNegativeSafeInteger(value.lessonId) || value.lessonId < 1 || value.lessonId > 4) {
    return invalidBinding("invalid_lesson");
  }
  if (
    value.manifestSchemaVersion !== EDU_PUBLISH_MANIFEST_SCHEMA_VERSION ||
    !isValidManifestDigest(value.declaredManifestDigest) ||
    !isValidManifestJson(value.declaredManifestCanonicalJson)
  ) {
    return invalidBinding("invalid_manifest");
  }
  if (
    !isNonNegativeSafeInteger(value.capabilityIssuedAtSeconds) ||
    !isPositiveSafeInteger(value.capabilityExpiresAtSeconds) ||
    value.capabilityExpiresAtSeconds - value.capabilityIssuedAtSeconds !==
      EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS
  ) {
    return invalidBinding("invalid_capability_time");
  }
  if (!isValidKid(value.capabilityKid)) return invalidBinding("invalid_capability_kid");

  return {
    ok: true,
    binding: {
      attemptId: value.attemptId,
      slug: value.slug,
      lessonId: value.lessonId,
      manifestSchemaVersion: EDU_PUBLISH_MANIFEST_SCHEMA_VERSION,
      declaredManifestDigest: value.declaredManifestDigest,
      declaredManifestCanonicalJson: value.declaredManifestCanonicalJson,
      capabilityIssuedAtSeconds: value.capabilityIssuedAtSeconds,
      capabilityExpiresAtSeconds: value.capabilityExpiresAtSeconds,
      capabilityKid: value.capabilityKid,
    },
  };
}

export function validateNewEduPublishPrepareAttemptFreshness(input: {
  binding: EduPublishPrepareAttemptBinding;
  nowSeconds: number;
}): EduPublishPrepareAttemptFreshnessDecision {
  if (!isPlainObject(input) || !isNonNegativeSafeInteger(input.nowSeconds)) {
    return { ok: false, reason: "invalid_input" };
  }
  if (
    !isPlainObject(input.binding) ||
    !isValidAttemptId(input.binding.attemptId) ||
    !isValidSlug(input.binding.slug) ||
    !isNonNegativeSafeInteger(input.binding.lessonId) ||
    input.binding.lessonId < 1 ||
    input.binding.lessonId > 4 ||
    input.binding.manifestSchemaVersion !== EDU_PUBLISH_MANIFEST_SCHEMA_VERSION ||
    !isValidManifestDigest(input.binding.declaredManifestDigest) ||
    !isValidManifestJson(input.binding.declaredManifestCanonicalJson) ||
    !isNonNegativeSafeInteger(input.binding.capabilityIssuedAtSeconds) ||
    !isPositiveSafeInteger(input.binding.capabilityExpiresAtSeconds) ||
    !isValidKid(input.binding.capabilityKid)
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const { binding, nowSeconds } = input;
  if (binding.capabilityExpiresAtSeconds <= nowSeconds) {
    return { ok: false, reason: "already_expired" };
  }
  if (nowSeconds - binding.capabilityIssuedAtSeconds > EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "issued_too_old" };
  }
  if (binding.capabilityIssuedAtSeconds - nowSeconds > EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "issued_in_future" };
  }
  return { ok: true };
}

function validateReservationObservation(
  value: EduPublishSlugReservationObservation | null,
): EduPublishSlugReservationObservation | null | "invalid" {
  if (value === null) return null;
  if (!isPlainObject(value) || !isValidSlug(value.slug)) return "invalid";

  const attemptId = value.attemptId;
  const projectId = value.projectId;
  if (attemptId !== null && !isNonEmptyString(attemptId)) return "invalid";
  if (projectId !== null && !isNonEmptyString(projectId)) return "invalid";

  switch (value.reservationState) {
    case "LEGACY_PROJECT":
      return attemptId === null && projectId !== null ? value as EduPublishSlugReservationObservation : "invalid";
    case "ATTEMPT_RESERVED":
      return attemptId !== null && projectId === null ? value as EduPublishSlugReservationObservation : "invalid";
    case "PROJECT_PUBLISHED":
      return attemptId !== null && projectId !== null ? value as EduPublishSlugReservationObservation : "invalid";
    case "TOMBSTONED":
      return attemptId === null && projectId === null ? value as EduPublishSlugReservationObservation : "invalid";
    default:
      return "invalid";
  }
}

function validateAttemptObservation(
  value: EduPublishPrepareAttemptObservation | null,
): EduPublishPrepareAttemptObservation | null | "invalid" {
  if (value === null) return null;
  const binding = validateEduPublishPrepareAttemptBinding(value);
  if (!binding.ok || !isOneOf(value.state, EDU_PUBLISH_ATTEMPT_STATES)) return "invalid";
  if (
    !isNonNegativeSafeInteger(value.attemptVersion) ||
    !isPositiveSafeInteger(value.expiresAtSeconds) ||
    value.expiresAtSeconds !== binding.binding.capabilityExpiresAtSeconds
  ) {
    return "invalid";
  }
  return {
    ...binding.binding,
    state: value.state,
    attemptVersion: value.attemptVersion,
    expiresAtSeconds: value.expiresAtSeconds,
  };
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function sameReservation(
  left: EduPublishSlugReservationObservation,
  right: EduPublishSlugReservationObservation,
): boolean {
  return (
    left.slug === right.slug &&
    left.attemptId === right.attemptId &&
    left.projectId === right.projectId &&
    left.reservationState === right.reservationState
  );
}

function sameBinding(
  left: EduPublishPrepareAttemptBinding,
  right: EduPublishPrepareAttemptBinding,
): boolean {
  return (
    left.attemptId === right.attemptId &&
    left.slug === right.slug &&
    left.lessonId === right.lessonId &&
    left.manifestSchemaVersion === right.manifestSchemaVersion &&
    left.declaredManifestDigest === right.declaredManifestDigest &&
    left.declaredManifestCanonicalJson === right.declaredManifestCanonicalJson &&
    left.capabilityIssuedAtSeconds === right.capabilityIssuedAtSeconds &&
    left.capabilityExpiresAtSeconds === right.capabilityExpiresAtSeconds &&
    left.capabilityKid === right.capabilityKid
  );
}

function returnOutcome(
  outcome: Extract<EduPublishPrepareAttemptOutcome, "ALREADY_PREPARED" | "SLUG_CONFLICT" | "ATTEMPT_ID_CONFLICT" | "STATE_CONFLICT" | "INVALID_INPUT">,
): EduPublishPrepareAttemptConflictDecision {
  return { action: "return", outcome };
}

export function decideEduPublishPrepareAttemptConflict(
  input: EduPublishPrepareAttemptConflictInput,
): EduPublishPrepareAttemptConflictDecision {
  if (!isPlainObject(input)) return returnOutcome("INVALID_INPUT");
  const requested = validateEduPublishPrepareAttemptBinding(input.requested);
  if (!requested.ok || !isNonNegativeSafeInteger(input.nowSeconds)) return returnOutcome("INVALID_INPUT");

  const reservationBySlug = validateReservationObservation(input.reservationBySlug);
  const reservationByAttemptId = validateReservationObservation(input.reservationByAttemptId);
  const attemptById = validateAttemptObservation(input.attemptById);
  if (reservationBySlug === "invalid" || reservationByAttemptId === "invalid") {
    return { action: "raise", reason: "reservation_observation_mismatch" };
  }
  if (attemptById === "invalid") return { action: "raise", reason: "stored_attempt_invalid" };

  if (reservationBySlug !== null && reservationBySlug.slug !== requested.binding.slug) {
    return { action: "raise", reason: "reservation_observation_mismatch" };
  }
  if (reservationByAttemptId !== null && reservationByAttemptId.attemptId !== requested.binding.attemptId) {
    return { action: "raise", reason: "reservation_observation_mismatch" };
  }

  if (attemptById !== null) {
    if (!sameBinding(attemptById, requested.binding)) return returnOutcome("ATTEMPT_ID_CONFLICT");
    if (reservationBySlug === null || reservationByAttemptId === null) {
      return { action: "raise", reason: "attempt_without_matching_reservation" };
    }
    if (
      !sameReservation(reservationBySlug, reservationByAttemptId) ||
      reservationBySlug.slug !== requested.binding.slug ||
      reservationBySlug.attemptId !== requested.binding.attemptId ||
      reservationBySlug.reservationState !== "ATTEMPT_RESERVED" ||
      reservationBySlug.projectId !== null
    ) {
      return { action: "raise", reason: "reservation_observation_mismatch" };
    }
    if (attemptById.state === "PREPARED" && input.nowSeconds < attemptById.expiresAtSeconds) {
      return returnOutcome("ALREADY_PREPARED");
    }
    return returnOutcome("STATE_CONFLICT");
  }

  if (reservationByAttemptId !== null) {
    return { action: "raise", reason: "reservation_marker_without_attempt" };
  }
  if (reservationBySlug !== null) return returnOutcome("SLUG_CONFLICT");
  return { action: "raise", reason: "missing_conflict_owner" };
}
