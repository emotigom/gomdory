import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  EDU_PUBLISH_COMPLETE_COMMIT_OUTCOMES,
  decideEduPublishCompleteCommit,
  decideEduPublishCompleteCommitHandlerAction,
  validateEduPublishCompleteCommitBinding,
  type EduPublishCompleteCommitDecisionInput,
} from "@/lib/edu/publish/completeCommitContract";

const ATTEMPT_ID =
  "00000000-0000-4000-8000-000000000001";
const LEASE_OWNER =
  "00000000-0000-4000-8000-000000000002";
const PROJECT_ID =
  "00000000-0000-4000-8000-000000000003";
const OTHER_ATTEMPT_ID =
  "00000000-0000-4000-8000-000000000004";
const OTHER_LEASE_OWNER =
  "00000000-0000-4000-8000-000000000005";
const OTHER_PROJECT_ID =
  "00000000-0000-4000-8000-000000000006";
const DIGEST = "a".repeat(64);
const OTHER_DIGEST = "b".repeat(64);

const requested = {
  attemptId: ATTEMPT_ID,
  slug: "abc123-123456-p1",
  manifestSchemaVersion: 1,
  declaredManifestDigest: DIGEST,
  verifiedManifestDigest: DIGEST,
  leaseOwner: LEASE_OWNER,
  expectedAttemptVersion: 5,
  projectId: PROJECT_ID,
} as const;

const validating = {
  attemptId: ATTEMPT_ID,
  slug: "abc123-123456-p1",
  manifestSchemaVersion: 1,
  declaredManifestDigest: DIGEST,
  verifiedManifestDigest: null,
  state: "VALIDATING",
  attemptVersion: 5,
  retryCount: 1,
  commitCount: 2,
  expiresAtSeconds: 2_000,
  leaseOwner: LEASE_OWNER,
  leaseExpiresAtSeconds: 1_500,
  projectId: null,
  failureCode: null,
} as const;

const reserved = {
  slug: "abc123-123456-p1",
  attemptId: ATTEMPT_ID,
  projectId: null,
  reservationState: "ATTEMPT_RESERVED",
} as const;

const publishedAttempt = {
  ...validating,
  state: "PUBLISHED",
  verifiedManifestDigest: DIGEST,
  leaseOwner: null,
  leaseExpiresAtSeconds: null,
  projectId: PROJECT_ID,
} as const;

const publishedReservation = {
  ...reserved,
  projectId: PROJECT_ID,
  reservationState: "PROJECT_PUBLISHED",
} as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function makeInput(
  overrides: Partial<{
    requested: unknown;
    nowSeconds: unknown;
    attempt: unknown;
    reservation: unknown;
  }> = {},
): EduPublishCompleteCommitDecisionInput {
  return {
    requested: clone(requested),
    nowSeconds: 1_200,
    attempt: clone(validating),
    reservation: clone(reserved),
    ...overrides,
  } as EduPublishCompleteCommitDecisionInput;
}

function attemptForState(state: string): Record<string, unknown> {
  switch (state) {
    case "PREPARED":
      return {
        ...validating,
        state,
        leaseOwner: null,
        leaseExpiresAtSeconds: null,
      };
    case "PUBLISHED":
      return publishedAttempt;
    case "FAILED_RETRYABLE":
      return {
        ...validating,
        state,
        leaseOwner: null,
        leaseExpiresAtSeconds: null,
        failureCode: "R2_TEMPORARY_FAILURE",
      };
    case "FAILED_RESTART_REQUIRED":
      return {
        ...validating,
        state,
        leaseOwner: null,
        leaseExpiresAtSeconds: null,
        failureCode: "ATTEMPT_EXPIRED",
      };
    case "ABANDONED":
      return {
        ...validating,
        state,
        leaseOwner: null,
        leaseExpiresAtSeconds: null,
        failureCode: "ATTEMPT_EXPIRED",
      };
    default:
      return validating;
  }
}

function publishedInput(
  overrides: Partial<{
    requested: unknown;
    nowSeconds: unknown;
    attempt: unknown;
    reservation: unknown;
  }> = {},
): EduPublishCompleteCommitDecisionInput {
  return makeInput({
    attempt: clone(publishedAttempt),
    reservation: clone(publishedReservation),
    ...overrides,
  });
}

test("outcomes and handler actions are exact", () => {
  assert.deepEqual(EDU_PUBLISH_COMPLETE_COMMIT_OUTCOMES, [
    "PUBLISHED",
    "ALREADY_PUBLISHED",
    "LEASE_EXPIRED",
    "LEASE_MISMATCH",
    "VERSION_MISMATCH",
    "BINDING_MISMATCH",
    "RESERVATION_MISMATCH",
    "STATE_CONFLICT",
    "INVALID_INPUT",
  ]);

  const expectedActions: Record<string, string> = {
    PUBLISHED: "return_published",
    ALREADY_PUBLISHED: "return_already_published",
    LEASE_EXPIRED: "reject_lease_expired",
    LEASE_MISMATCH: "reject_lease_mismatch",
    VERSION_MISMATCH: "reject_version_mismatch",
    BINDING_MISMATCH: "reject_binding",
    RESERVATION_MISMATCH: "reject_reservation",
    STATE_CONFLICT: "reject_state_conflict",
    INVALID_INPUT: "fail_internal_contract",
  };
  for (const outcome of EDU_PUBLISH_COMPLETE_COMMIT_OUTCOMES) {
    assert.equal(decideEduPublishCompleteCommitHandlerAction(outcome), expectedActions[outcome]);
  }
  for (const unknown of ["UNKNOWN", null, {}, 1, undefined]) {
    assert.equal(decideEduPublishCompleteCommitHandlerAction(unknown), "fail_internal_contract");
  }
});

test("valid binding accepts the exact eight keys and returns a normalized copy", () => {
  const result = validateEduPublishCompleteCommitBinding(requested);
  assert.deepEqual(result, { ok: true, binding: requested });
  assert.equal(Object.keys(result.ok ? result.binding : {}).length, 8);
});

test("binding validation rejects the complete invalid matrix and the decision returns INVALID_INPUT", () => {
  class BindingInstance {
    constructor() {
      Object.assign(this, requested);
    }
  }

  const missing = { ...requested };
  delete (missing as Partial<typeof requested>).projectId;
  const extra = { ...requested, extra: true };
  const symbolKey = { ...requested, [Symbol("extra")]: true };
  const invalidCases: unknown[] = [
    null,
    [],
    new BindingInstance(),
    missing,
    extra,
    symbolKey,
    { ...requested, attemptId: "00000000-0000-4000-8000-00000000000A" },
    { ...requested, slug: "ABC123" },
    { ...requested, manifestSchemaVersion: 2 },
    { ...requested, declaredManifestDigest: DIGEST.toUpperCase() },
    { ...requested, verifiedManifestDigest: DIGEST.toUpperCase() },
    { ...requested, verifiedManifestDigest: OTHER_DIGEST },
    { ...requested, leaseOwner: "not-a-uuid" },
    { ...requested, leaseOwner: "00000000-0000-4000-8000-00000000000B" },
    { ...requested, expectedAttemptVersion: -1 },
    { ...requested, expectedAttemptVersion: 1.5 },
    { ...requested, projectId: "not-a-uuid" },
    { ...requested, projectId: "0000000A-0000-4000-8000-000000000003" },
    { ...requested, projectId: ATTEMPT_ID },
    { ...requested, projectId: LEASE_OWNER },
  ];

  for (const [index, value] of invalidCases.entries()) {
    const validation = validateEduPublishCompleteCommitBinding(value);
    assert.equal(validation.ok, false, `invalid case ${index}: ${JSON.stringify(value)}`);
    assert.equal(decideEduPublishCompleteCommit(makeInput({ requested: value })).outcome, "INVALID_INPUT");
  }
});

test("all six valid attempt states have valid observation shapes", () => {
  const states = [
    ["PREPARED", "STATE_CONFLICT"],
    ["VALIDATING", "PUBLISHED"],
    ["PUBLISHED", "ALREADY_PUBLISHED"],
    ["FAILED_RETRYABLE", "STATE_CONFLICT"],
    ["FAILED_RESTART_REQUIRED", "STATE_CONFLICT"],
    ["ABANDONED", "STATE_CONFLICT"],
  ] as const;

  for (const [state, outcome] of states) {
    const input = state === "PUBLISHED"
      ? publishedInput()
      : makeInput({ attempt: attemptForState(state) });
    const result = decideEduPublishCompleteCommit(input);
    assert.equal(result.action, outcome === "PUBLISHED" ? "mutate" : "return");
    assert.equal(result.outcome, outcome);
  }
});

test("FAILED_RESTART_REQUIRED with ATTEMPT_EXPIRED is a valid stored state", () => {
  const result = decideEduPublishCompleteCommit(makeInput({
    attempt: attemptForState("FAILED_RESTART_REQUIRED"),
  }));
  assert.deepEqual(result, { action: "return", outcome: "STATE_CONFLICT" });
});

test("malformed attempt observations raise before any mutation", () => {
  const malformedCases = [
    { state: "PREPARED", leaseOwner: LEASE_OWNER, leaseExpiresAtSeconds: 1_500 },
    { state: "VALIDATING", leaseOwner: null, leaseExpiresAtSeconds: null },
    { state: "VALIDATING", verifiedManifestDigest: DIGEST },
    { state: "PUBLISHED", projectId: null, verifiedManifestDigest: DIGEST },
    { state: "PUBLISHED", verifiedManifestDigest: null, projectId: PROJECT_ID },
    { state: "PUBLISHED", verifiedManifestDigest: OTHER_DIGEST, projectId: PROJECT_ID },
    { state: "PUBLISHED", leaseOwner: LEASE_OWNER, leaseExpiresAtSeconds: 1_500, projectId: PROJECT_ID, verifiedManifestDigest: DIGEST },
    { state: "FAILED_RETRYABLE", leaseOwner: null, leaseExpiresAtSeconds: null, failureCode: "R2_DIGEST_MISMATCH" },
    { state: "FAILED_RESTART_REQUIRED", leaseOwner: null, leaseExpiresAtSeconds: null, failureCode: "R2_TEMPORARY_FAILURE" },
    { state: "ABANDONED", leaseOwner: null, leaseExpiresAtSeconds: null, failureCode: null },
  ];

  for (const overrides of malformedCases) {
    const result = decideEduPublishCompleteCommit(makeInput({
      attempt: { ...validating, ...overrides },
    }));
    assert.deepEqual(result, { action: "raise", reason: "stored_attempt_invalid" });
  }
});

test("all reservation states validate their stored shapes", () => {
  const observations = [
    {
      slug: reserved.slug,
      attemptId: null,
      projectId: PROJECT_ID,
      reservationState: "LEGACY_PROJECT",
    },
    reserved,
    publishedReservation,
    {
      slug: reserved.slug,
      attemptId: null,
      projectId: null,
      reservationState: "TOMBSTONED",
    },
  ];

  assert.equal(decideEduPublishCompleteCommit(makeInput({ reservation: observations[0] })).outcome, "RESERVATION_MISMATCH");
  assert.equal(decideEduPublishCompleteCommit(makeInput({ reservation: observations[1] })).outcome, "PUBLISHED");
  assert.equal(decideEduPublishCompleteCommit(publishedInput({ reservation: observations[2] })).outcome, "ALREADY_PUBLISHED");
  assert.equal(decideEduPublishCompleteCommit(makeInput({ reservation: observations[3] })).outcome, "RESERVATION_MISMATCH");
});

test("malformed reservation observations raise before worker transition", () => {
  const malformedCases = [
    { ...reserved, reservationState: "LEGACY_PROJECT", projectId: PROJECT_ID },
    { ...reserved, reservationState: "LEGACY_PROJECT", attemptId: null },
    { ...reserved, attemptId: null },
    { ...reserved, projectId: PROJECT_ID },
    { ...publishedReservation, attemptId: null },
    { ...publishedReservation, projectId: null },
    { ...reserved, reservationState: "TOMBSTONED", attemptId: ATTEMPT_ID },
    { ...reserved, reservationState: "TOMBSTONED", projectId: PROJECT_ID },
    { ...reserved, reservationState: "UNKNOWN" },
  ];

  for (const reservation of malformedCases) {
    const result = decideEduPublishCompleteCommit(makeInput({ reservation }));
    assert.deepEqual(result, { action: "raise", reason: "stored_reservation_invalid" });
  }
});

test("missing attempt and reservation return privacy-preserving mismatch outcomes", () => {
  assert.deepEqual(
    decideEduPublishCompleteCommit(makeInput({ attempt: null })),
    { action: "return", outcome: "BINDING_MISMATCH" },
  );
  assert.deepEqual(
    decideEduPublishCompleteCommit(makeInput({ reservation: null })),
    { action: "return", outcome: "RESERVATION_MISMATCH" },
  );
});

test("attempt binding mismatches precede state and reservation checks", () => {
  const mismatchCases = [
    { attemptId: OTHER_ATTEMPT_ID },
    { slug: "different-slug" },
    { declaredManifestDigest: OTHER_DIGEST, verifiedManifestDigest: OTHER_DIGEST },
  ];

  for (const patch of mismatchCases) {
    const result = decideEduPublishCompleteCommit(makeInput({
      requested: { ...requested, ...patch },
      attempt: attemptForState("PREPARED"),
    }));
    assert.deepEqual(result, { action: "return", outcome: "BINDING_MISMATCH" });
  }
});

test("reservation mismatches do not reach worker mutation", () => {
  const mismatchCases = [
    { ...reserved, slug: "other-slug" },
    { ...reserved, attemptId: OTHER_ATTEMPT_ID },
    { ...reserved, reservationState: "LEGACY_PROJECT", attemptId: null, projectId: PROJECT_ID },
    { ...publishedReservation },
    { ...reserved, reservationState: "TOMBSTONED", attemptId: null, projectId: null },
  ];

  for (const reservation of mismatchCases) {
    const result = decideEduPublishCompleteCommit(makeInput({ reservation }));
    assert.deepEqual(result, { action: "return", outcome: "RESERVATION_MISMATCH" });
  }
});

test("PUBLISHED replay requires exact project, verified digest, and reservation identity", () => {
  assert.deepEqual(
    decideEduPublishCompleteCommit(publishedInput({ nowSeconds: 5_000 })),
    { action: "return", outcome: "ALREADY_PUBLISHED" },
  );
  assert.deepEqual(
    decideEduPublishCompleteCommit(publishedInput({
      requested: { ...requested, projectId: OTHER_PROJECT_ID },
    })),
    { action: "return", outcome: "BINDING_MISMATCH" },
  );
  assert.deepEqual(
    decideEduPublishCompleteCommit(publishedInput({
      requested: {
        ...requested,
        declaredManifestDigest: OTHER_DIGEST,
        verifiedManifestDigest: OTHER_DIGEST,
      },
    })),
    { action: "return", outcome: "BINDING_MISMATCH" },
  );
  assert.deepEqual(
    decideEduPublishCompleteCommit(publishedInput({
      reservation: { ...publishedReservation, projectId: OTHER_PROJECT_ID },
    })),
    { action: "return", outcome: "RESERVATION_MISMATCH" },
  );
  assert.deepEqual(
    decideEduPublishCompleteCommit(publishedInput({
      reservation: { ...reserved },
    })),
    { action: "return", outcome: "RESERVATION_MISMATCH" },
  );
  assert.deepEqual(
    decideEduPublishCompleteCommit(publishedInput({
      reservation: { ...publishedReservation, attemptId: OTHER_ATTEMPT_ID },
    })),
    { action: "return", outcome: "RESERVATION_MISMATCH" },
  );
});

test("non-PUBLISHED states conflict without mutation", () => {
  for (const state of ["PREPARED", "FAILED_RETRYABLE", "FAILED_RESTART_REQUIRED", "ABANDONED"]) {
    const result = decideEduPublishCompleteCommit(makeInput({ attempt: attemptForState(state) }));
    assert.deepEqual(result, { action: "return", outcome: "STATE_CONFLICT" });
  }
});

test("version and lease failures are mapped without exposing stored values", () => {
  assert.deepEqual(
    decideEduPublishCompleteCommit(makeInput({ requested: { ...requested, expectedAttemptVersion: 4 } })),
    { action: "return", outcome: "VERSION_MISMATCH" },
  );
  assert.deepEqual(
    decideEduPublishCompleteCommit(makeInput({ requested: { ...requested, expectedAttemptVersion: 6 } })),
    { action: "return", outcome: "VERSION_MISMATCH" },
  );
  assert.deepEqual(
    decideEduPublishCompleteCommit(makeInput({ requested: { ...requested, leaseOwner: OTHER_LEASE_OWNER } })),
    { action: "return", outcome: "LEASE_MISMATCH" },
  );
});

test("lease expiry is exclusive at the worker boundary", () => {
  const beforeExpiry = decideEduPublishCompleteCommit(makeInput({ nowSeconds: 1_499 }));
  assert.equal(beforeExpiry.action, "mutate");
  assert.equal(beforeExpiry.outcome, "PUBLISHED");
  assert.deepEqual(
    decideEduPublishCompleteCommit(makeInput({ nowSeconds: 1_500 })),
    { action: "return", outcome: "LEASE_EXPIRED" },
  );
  assert.deepEqual(
    decideEduPublishCompleteCommit(makeInput({ nowSeconds: 1_501 })),
    { action: "return", outcome: "LEASE_EXPIRED" },
  );
});

test("successful transition preserves counters and emits both exact patches", () => {
  const result = decideEduPublishCompleteCommit(makeInput({ nowSeconds: 1_499 }));
  assert.deepEqual(result, {
    action: "mutate",
    outcome: "PUBLISHED",
    attemptNext: {
      state: "PUBLISHED",
      attemptVersion: 6,
      retryCount: 1,
      commitCount: 2,
      leaseOwner: null,
      leaseExpiresAtSeconds: null,
      projectId: PROJECT_ID,
      verifiedManifestDigest: DIGEST,
      failureCode: null,
      publishedAtSeconds: 1_499,
    },
    reservationNext: {
      reservationState: "PROJECT_PUBLISHED",
      attemptId: ATTEMPT_ID,
      projectId: PROJECT_ID,
      convertedAtSeconds: 1_499,
    },
  });
});

test("attempt-version overflow precedes version, lease, and expiry rejection", () => {
  const result = decideEduPublishCompleteCommit(makeInput({
    requested: {
      ...requested,
      expectedAttemptVersion: 4,
      leaseOwner: OTHER_LEASE_OWNER,
    },
    attempt: { ...validating, attemptVersion: Number.MAX_SAFE_INTEGER },
    nowSeconds: 1_500,
  }));
  assert.deepEqual(result, { action: "raise", reason: "counter_overflow" });
});

test("invalid now values always return INVALID_INPUT", () => {
  for (const nowSeconds of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1200", null]) {
    assert.deepEqual(
      decideEduPublishCompleteCommit(makeInput({ nowSeconds })),
      { action: "return", outcome: "INVALID_INPUT" },
    );
  }
});

test("the contract reuses the worker publish transition and keeps forbidden integrations out", () => {
  const source = readFileSync(resolve(process.cwd(), "lib/edu/publish/completeCommitContract.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.match(source, /validateEduPublishBeginCommitBinding/);
  assert.match(source, /decideEduPublishAttemptWorkerTransition/);
  assert.match(source, /type: "publish_succeeded"/);
  for (const forbidden of [
    "NextRequest",
    "NextResponse",
    "Response",
    "Supabase",
    "createSupabaseAdminClient",
    "complete_edu_publish_commit_v1\\s*\\(",
    "edu_atomic_publish_v2\\s*\\(",
    "R2",
    "headObject",
    "listObjectKeysV2",
    "recordOpsEvent",
    "Date.now",
    "Math.random",
    "randomUUID",
    "process.env",
    "node:crypto",
    "filesystem",
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden), `forbidden source token: ${forbidden}`);
  }
});

test("the decision is deterministic, mutation-free, and privacy-preserving", () => {
  const input = makeInput();
  const before = clone(input);
  const first = decideEduPublishCompleteCommit(input);
  const second = decideEduPublishCompleteCommit(input);
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);

  const sentinelInput = makeInput({
    reservation: {
      slug: "private-reservation-sentinel",
      attemptId: ATTEMPT_ID,
      projectId: null,
      reservationState: "ATTEMPT_RESERVED",
    },
  });
  const negative = decideEduPublishCompleteCommit(sentinelInput);
  assert.deepEqual(negative, { action: "return", outcome: "RESERVATION_MISMATCH" });
  assert.doesNotMatch(JSON.stringify(negative), /private-/);

  const raise = decideEduPublishCompleteCommit(makeInput({
    attempt: { ...validating, failureCode: "private-attempt-sentinel" },
  }));
  assert.deepEqual(raise, { action: "raise", reason: "stored_attempt_invalid" });
  assert.doesNotMatch(JSON.stringify(raise), /private-/);
});
