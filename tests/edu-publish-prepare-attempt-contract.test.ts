import assert from "node:assert/strict";
import test from "node:test";

import {
  EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS,
  EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS,
} from "@/lib/edu/publish/commitCapability";
import {
  EDU_PUBLISH_PREPARE_ATTEMPT_OUTCOMES,
  decideEduPublishPrepareAttemptConflict,
  decideEduPublishPrepareAttemptHandlerAction,
  validateEduPublishPrepareAttemptBinding,
  validateNewEduPublishPrepareAttemptFreshness,
  type EduPublishPrepareAttemptBinding,
  type EduPublishPrepareAttemptConflictInput,
  type EduPublishPrepareAttemptObservation,
  type EduPublishSlugReservationObservation,
} from "@/lib/edu/publish/prepareAttemptContract";

const ATTEMPT_ID = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_ATTEMPT_ID = "123e4567-e89b-12d3-a456-426614174001";
const SLUG = "abc123-123456-p1";
const OTHER_SLUG = "abc123-123456-p2";
const DIGEST = "a".repeat(64);
const MANIFEST = JSON.stringify({ schemaVersion: 1, entryPoint: "index.html", files: [] });
const NOW = 1_760_000_000;

const binding = (overrides: Partial<EduPublishPrepareAttemptBinding> = {}): EduPublishPrepareAttemptBinding => ({
  attemptId: ATTEMPT_ID,
  slug: SLUG,
  lessonId: 1,
  manifestSchemaVersion: 1,
  declaredManifestDigest: DIGEST,
  declaredManifestCanonicalJson: MANIFEST,
  capabilityIssuedAtSeconds: NOW,
  capabilityExpiresAtSeconds: NOW + EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS,
  capabilityKid: "cap-2026-01",
  ...overrides,
});

const reservation = (
  overrides: Partial<EduPublishSlugReservationObservation> = {},
): EduPublishSlugReservationObservation => ({
  slug: SLUG,
  attemptId: ATTEMPT_ID,
  projectId: null,
  reservationState: "ATTEMPT_RESERVED",
  ...overrides,
});

const attempt = (
  overrides: Partial<EduPublishPrepareAttemptObservation> = {},
): EduPublishPrepareAttemptObservation => ({
  ...binding(),
  state: "PREPARED",
  attemptVersion: 0,
  expiresAtSeconds: NOW + EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS,
  ...overrides,
});

const conflictInput = (
  overrides: Partial<EduPublishPrepareAttemptConflictInput> = {},
): EduPublishPrepareAttemptConflictInput => ({
  requested: binding(),
  nowSeconds: NOW + 1,
  reservationBySlug: reservation(),
  reservationByAttemptId: reservation(),
  attemptById: attempt(),
  ...overrides,
});

const unchanged = <T,>(input: T, decide: () => unknown) => {
  const before = structuredClone(input);
  const result = decide();
  assert.deepEqual(input, before);
  return result;
};

test("outcome vocabulary contains exactly the six RPC outcomes", () => {
  assert.deepEqual(EDU_PUBLISH_PREPARE_ATTEMPT_OUTCOMES, [
    "CREATED",
    "ALREADY_PREPARED",
    "SLUG_CONFLICT",
    "ATTEMPT_ID_CONFLICT",
    "STATE_CONFLICT",
    "INVALID_INPUT",
  ]);
});

test("handler action mapping is exact and unknown outcomes fail internally", () => {
  const expected = new Map<unknown, string>([
    ["CREATED", "proceed"],
    ["ALREADY_PREPARED", "proceed"],
    ["SLUG_CONFLICT", "retry_slug"],
    ["ATTEMPT_ID_CONFLICT", "retry_attempt_identity"],
    ["STATE_CONFLICT", "reject_state_conflict"],
    ["INVALID_INPUT", "fail_internal_contract"],
    ["unknown", "fail_internal_contract"],
  ]);
  for (const [outcome, action] of expected) assert.equal(decideEduPublishPrepareAttemptHandlerAction(outcome), action);
});

test("valid binding preserves the canonical attempt, manifest, capability, and lesson contract", () => {
  assert.deepEqual(validateEduPublishPrepareAttemptBinding(binding()), { ok: true, binding: binding() });
});

test("binding validation rejects the exact malformed input matrix", () => {
  const invalidCases: Array<[string, unknown, string]> = [
    ["null", null, "invalid_payload"],
    ["array", [], "invalid_payload"],
    ["uppercase UUID", { ...binding(), attemptId: ATTEMPT_ID.toUpperCase() }, "invalid_attempt"],
    ["malformed UUID", { ...binding(), attemptId: "not-a-uuid" }, "invalid_attempt"],
    ["uppercase digest", { ...binding(), declaredManifestDigest: DIGEST.toUpperCase() }, "invalid_manifest"],
    ["short digest", { ...binding(), declaredManifestDigest: "a".repeat(63) }, "invalid_manifest"],
    ["lesson 0", { ...binding(), lessonId: 0 }, "invalid_lesson"],
    ["lesson 5", { ...binding(), lessonId: 5 }, "invalid_lesson"],
    ["schema 2", { ...binding(), manifestSchemaVersion: 2 }, "invalid_manifest"],
    ["empty canonical JSON", { ...binding(), declaredManifestCanonicalJson: "" }, "invalid_manifest"],
    ["invalid JSON", { ...binding(), declaredManifestCanonicalJson: "{" }, "invalid_manifest"],
    ["array JSON", { ...binding(), declaredManifestCanonicalJson: "[]" }, "invalid_manifest"],
    ["wrong schemaVersion", { ...binding(), declaredManifestCanonicalJson: JSON.stringify({ schemaVersion: 2, entryPoint: "index.html", files: [] }) }, "invalid_manifest"],
    ["wrong entryPoint", { ...binding(), declaredManifestCanonicalJson: JSON.stringify({ schemaVersion: 1, entryPoint: "main.html", files: [] }) }, "invalid_manifest"],
    ["files non-array", { ...binding(), declaredManifestCanonicalJson: JSON.stringify({ schemaVersion: 1, entryPoint: "index.html", files: {} }) }, "invalid_manifest"],
    ["fractional issued time", { ...binding(), capabilityIssuedAtSeconds: NOW + 0.5 }, "invalid_capability_time"],
    ["negative issued time", { ...binding(), capabilityIssuedAtSeconds: -1 }, "invalid_capability_time"],
    ["expiry before issued", { ...binding(), capabilityExpiresAtSeconds: NOW - 1 }, "invalid_capability_time"],
    ["TTL 2699", { ...binding(), capabilityExpiresAtSeconds: NOW + 2699 }, "invalid_capability_time"],
    ["TTL 2701", { ...binding(), capabilityExpiresAtSeconds: NOW + 2701 }, "invalid_capability_time"],
    ["invalid kid", { ...binding(), capabilityKid: "bad kid" }, "invalid_capability_kid"],
    ["kid length 33", { ...binding(), capabilityKid: "k".repeat(33) }, "invalid_capability_kid"],
  ];
  for (const [label, input, reason] of invalidCases) {
    assert.deepEqual(validateEduPublishPrepareAttemptBinding(input), { ok: false, reason }, label);
  }
});

test("new creation freshness honors inclusive clock-skew and expiry boundaries", () => {
  const issuedAt = NOW - EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS;
  assert.deepEqual(
    validateNewEduPublishPrepareAttemptFreshness({ binding: binding({ capabilityIssuedAtSeconds: issuedAt, capabilityExpiresAtSeconds: NOW + 1 }), nowSeconds: NOW }),
    { ok: true },
  );
  assert.deepEqual(
    validateNewEduPublishPrepareAttemptFreshness({ binding: binding({ capabilityIssuedAtSeconds: NOW - EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS - 1 }), nowSeconds: NOW }),
    { ok: false, reason: "issued_too_old" },
  );
  assert.deepEqual(
    validateNewEduPublishPrepareAttemptFreshness({ binding: binding({ capabilityIssuedAtSeconds: NOW + EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS, capabilityExpiresAtSeconds: NOW + EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS + 1 }), nowSeconds: NOW }),
    { ok: true },
  );
  assert.deepEqual(
    validateNewEduPublishPrepareAttemptFreshness({ binding: binding({ capabilityIssuedAtSeconds: NOW + EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS + 1, capabilityExpiresAtSeconds: NOW + EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS + 2 }), nowSeconds: NOW }),
    { ok: false, reason: "issued_in_future" },
  );
  assert.deepEqual(
    validateNewEduPublishPrepareAttemptFreshness({ binding: binding({ capabilityExpiresAtSeconds: NOW }), nowSeconds: NOW }),
    { ok: false, reason: "already_expired" },
  );
  assert.deepEqual(
    validateNewEduPublishPrepareAttemptFreshness({ binding: binding({ capabilityExpiresAtSeconds: NOW + 1 }), nowSeconds: NOW }),
    { ok: true },
  );
  assert.deepEqual(
    validateNewEduPublishPrepareAttemptFreshness({ binding: binding(), nowSeconds: -1 }),
    { ok: false, reason: "invalid_input" },
  );
});

test("exact PREPARED replay returns ALREADY_PREPARED without rechecking issued-time freshness", () => {
  const input = conflictInput({
    nowSeconds: NOW + EDU_PUBLISH_COMMIT_CAPABILITY_CLOCK_SKEW_SECONDS + 1,
    requested: binding(),
  });
  const result = unchanged(input, () => decideEduPublishPrepareAttemptConflict(input));
  assert.deepEqual(result, { action: "return", outcome: "ALREADY_PREPARED" });
});

test("expired exact replay returns STATE_CONFLICT at the inclusive expiry boundary", () => {
  assert.deepEqual(
    decideEduPublishPrepareAttemptConflict(conflictInput({
      nowSeconds: NOW + EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS,
    })),
    { action: "return", outcome: "STATE_CONFLICT" },
  );
});

test("all non-PREPARED states return STATE_CONFLICT", () => {
  for (const state of ["VALIDATING", "PUBLISHED", "FAILED_RETRYABLE", "FAILED_RESTART_REQUIRED", "ABANDONED"] as const) {
    assert.deepEqual(
      decideEduPublishPrepareAttemptConflict(conflictInput({ attemptById: attempt({ state }) })),
      { action: "return", outcome: "STATE_CONFLICT" },
      state,
    );
  }
});

test("every attempt binding field mismatch returns ATTEMPT_ID_CONFLICT", () => {
  const mismatches: Array<Partial<EduPublishPrepareAttemptBinding>> = [
    { slug: OTHER_SLUG },
    { lessonId: 2 },
    { declaredManifestDigest: "b".repeat(64) },
    { declaredManifestCanonicalJson: JSON.stringify({ schemaVersion: 1, entryPoint: "index.html", files: [{ path: "index.html" }] }) },
    { capabilityIssuedAtSeconds: NOW + 1, capabilityExpiresAtSeconds: NOW + EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS + 1 },
    { capabilityExpiresAtSeconds: NOW + EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS + 1 },
    { capabilityKid: "cap-2026-02" },
  ];
  for (const mismatch of mismatches) {
    const requested = binding();
    const result = decideEduPublishPrepareAttemptConflict(conflictInput({
      requested,
      attemptById: attempt({
        ...((mismatch.capabilityExpiresAtSeconds !== undefined && mismatch.capabilityIssuedAtSeconds === undefined)
          ? { capabilityIssuedAtSeconds: NOW + 1 }
          : {}),
        ...mismatch,
        ...(mismatch.capabilityIssuedAtSeconds !== undefined
          ? { expiresAtSeconds: mismatch.capabilityExpiresAtSeconds }
          : mismatch.capabilityExpiresAtSeconds !== undefined
            ? { expiresAtSeconds: mismatch.capabilityExpiresAtSeconds }
          : {}),
      }),
      ...(mismatch.slug ? {
        reservationBySlug: reservation({ slug: requested.slug, attemptId: OTHER_ATTEMPT_ID }),
      } : {}),
    }));
    assert.deepEqual(result, { action: "return", outcome: "ATTEMPT_ID_CONFLICT" }, JSON.stringify(mismatch));
  }
});

test("slug conflicts have the same public outcome for all reservation states", () => {
  for (const reservationState of ["LEGACY_PROJECT", "ATTEMPT_RESERVED", "PROJECT_PUBLISHED", "TOMBSTONED"] as const) {
    const owner = reservation({
      slug: SLUG,
      attemptId: reservationState === "LEGACY_PROJECT" || reservationState === "TOMBSTONED" ? null : OTHER_ATTEMPT_ID,
      projectId: reservationState === "LEGACY_PROJECT" || reservationState === "PROJECT_PUBLISHED" ? "private-project-sentinel" : null,
      reservationState,
    });
    assert.deepEqual(
      decideEduPublishPrepareAttemptConflict(conflictInput({ reservationBySlug: owner, reservationByAttemptId: null, attemptById: null })),
      { action: "return", outcome: "SLUG_CONFLICT" },
      reservationState,
    );
  }
});

test("attempt identity conflict takes precedence over a simultaneous slug owner", () => {
  assert.deepEqual(
    decideEduPublishPrepareAttemptConflict(conflictInput({
      attemptById: attempt({ slug: OTHER_SLUG }),
      reservationBySlug: reservation({ slug: SLUG, attemptId: OTHER_ATTEMPT_ID }),
      reservationByAttemptId: reservation({ slug: OTHER_SLUG }),
    })),
    { action: "return", outcome: "ATTEMPT_ID_CONFLICT" },
  );
});

test("invariant failures are raised rather than hidden as typed outcomes", () => {
  const cases: Array<[string, Partial<EduPublishPrepareAttemptConflictInput>, string]> = [
    ["missing conflict owner", { reservationBySlug: null, reservationByAttemptId: null, attemptById: null }, "missing_conflict_owner"],
    ["marker without attempt", { reservationBySlug: null, reservationByAttemptId: reservation(), attemptById: null }, "reservation_marker_without_attempt"],
    ["attempt without reservation", { reservationBySlug: null, reservationByAttemptId: null, attemptById: attempt() }, "attempt_without_matching_reservation"],
    ["reservation pair mismatch", { reservationBySlug: reservation(), reservationByAttemptId: reservation({ slug: OTHER_SLUG }) }, "reservation_observation_mismatch"],
    ["malformed stored attempt", { attemptById: { ...attempt(), attemptVersion: -1 } }, "stored_attempt_invalid"],
    ["malformed reservation state shape", { reservationBySlug: { ...reservation(), reservationState: "TOMBSTONED", attemptId: ATTEMPT_ID } }, "reservation_observation_mismatch"],
  ];
  for (const [label, overrides, reason] of cases) {
    assert.deepEqual(decideEduPublishPrepareAttemptConflict(conflictInput(overrides)), { action: "raise", reason }, label);
  }
});

test("invalid requested input is INVALID_INPUT and never client-mapped automatically", () => {
  for (const overrides of [
    { requested: null },
    { requested: binding({ lessonId: 0 }) },
    { nowSeconds: -1 },
    { nowSeconds: 1.5 },
  ]) {
    assert.deepEqual(decideEduPublishPrepareAttemptConflict(conflictInput(overrides)), {
      action: "return",
      outcome: "INVALID_INPUT",
    });
  }
});

test("decisions are deterministic, secret-free, and do not mutate inputs", () => {
  const input = conflictInput({
    requested: binding({
      attemptId: ATTEMPT_ID,
      slug: "private-slug-sentinel",
      declaredManifestDigest: "private-digest-sentinel",
      declaredManifestCanonicalJson: "private-manifest-sentinel",
      capabilityKid: "private-kid-sentinel",
    }),
    reservationBySlug: null,
    reservationByAttemptId: null,
    attemptById: null,
  });
  const before = structuredClone(input);
  const first = decideEduPublishPrepareAttemptConflict(input);
  const second = decideEduPublishPrepareAttemptConflict(input);
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  const serialized = JSON.stringify(first);
  for (const sentinel of [
    "private-attempt-sentinel",
    "private-slug-sentinel",
    "private-manifest-sentinel",
    "private-digest-sentinel",
    "private-kid-sentinel",
    "private-project-sentinel",
  ]) assert.equal(serialized.includes(sentinel), false, sentinel);
  assert.deepEqual(first, { action: "return", outcome: "INVALID_INPUT" });
});
