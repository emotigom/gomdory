import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  EDU_PUBLISH_BEGIN_COMMIT_OUTCOMES,
  decideEduPublishBeginCommit,
  decideEduPublishBeginCommitHandlerAction,
  validateEduPublishBeginCommitBinding,
  type EduPublishBeginCommitAttemptObservation,
  type EduPublishBeginCommitBinding,
} from "@/lib/edu/publish/beginCommitContract";
import {
  EDU_PUBLISH_ATTEMPT_DEFAULT_LEASE_SECONDS,
  EDU_PUBLISH_ATTEMPT_MAX_SAME_ATTEMPT_RETRIES,
  type EduPublishAttemptState,
} from "@/lib/edu/publish/attemptState";

const ATTEMPT_ID = "00000000-0000-4000-8000-000000000001";
const LEASE_OWNER = "00000000-0000-4000-8000-000000000002";
const OTHER_LEASE_OWNER = "00000000-0000-4000-8000-000000000003";
const SLUG = "abc123-123456-p1";
const DIGEST = "a".repeat(64);

const requested: EduPublishBeginCommitBinding = {
  attemptId: ATTEMPT_ID,
  slug: SLUG,
  manifestSchemaVersion: 1,
  declaredManifestDigest: DIGEST,
  leaseOwner: LEASE_OWNER,
};

const prepared = (
  overrides: Partial<EduPublishBeginCommitAttemptObservation> = {},
): EduPublishBeginCommitAttemptObservation => ({
  attemptId: ATTEMPT_ID,
  slug: SLUG,
  manifestSchemaVersion: 1,
  declaredManifestDigest: DIGEST,
  state: "PREPARED",
  attemptVersion: 4,
  retryCount: 0,
  commitCount: 0,
  expiresAtSeconds: 2_000,
  leaseOwner: null,
  leaseExpiresAtSeconds: null,
  projectId: null,
  failureCode: null,
  ...overrides,
});

const validating = (
  overrides: Partial<EduPublishBeginCommitAttemptObservation> = {},
): EduPublishBeginCommitAttemptObservation =>
  prepared({
    state: "VALIDATING",
    leaseOwner: OTHER_LEASE_OWNER,
    leaseExpiresAtSeconds: 1_100,
    ...overrides,
  });

const published = (
  overrides: Partial<EduPublishBeginCommitAttemptObservation> = {},
): EduPublishBeginCommitAttemptObservation =>
  prepared({
    state: "PUBLISHED",
    projectId: "project-1",
    ...overrides,
  });

const retryable = (
  overrides: Partial<EduPublishBeginCommitAttemptObservation> = {},
): EduPublishBeginCommitAttemptObservation =>
  prepared({
    state: "FAILED_RETRYABLE",
    failureCode: "R2_TEMPORARY_FAILURE",
    ...overrides,
  });

const restartRequired = (
  overrides: Partial<EduPublishBeginCommitAttemptObservation> = {},
): EduPublishBeginCommitAttemptObservation =>
  prepared({
    state: "FAILED_RESTART_REQUIRED",
    failureCode: "R2_DIGEST_MISMATCH",
    ...overrides,
  });

const abandoned = (
  overrides: Partial<EduPublishBeginCommitAttemptObservation> = {},
): EduPublishBeginCommitAttemptObservation =>
  prepared({
    state: "ABANDONED",
    failureCode: "ATTEMPT_EXPIRED",
    ...overrides,
  });

const input = (
  attempt: EduPublishBeginCommitAttemptObservation | null,
  overrides: Record<string, unknown> = {},
) => ({ requested, nowSeconds: 1_000, attempt, ...overrides });

const assertUnchanged = <T,>(value: T, decide: () => unknown) => {
  const before = structuredClone(value);
  const result = decide();
  assert.deepEqual(value, before);
  return result;
};

test("outcome tuple is exact and ordered", () => {
  assert.deepEqual(EDU_PUBLISH_BEGIN_COMMIT_OUTCOMES, [
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
  ]);
  assert.equal(EDU_PUBLISH_BEGIN_COMMIT_OUTCOMES.length, 10);
});

test("handler mapping is exact and fails closed for unknown values", () => {
  const expected: Record<string, string> = {
    CLAIMED: "proceed",
    RECLAIMED_RETRYABLE: "proceed",
    TAKEN_OVER_STALE_LEASE: "proceed",
    ALREADY_PUBLISHED: "reuse_published",
    LEASE_ACTIVE: "reject_lease_active",
    ATTEMPT_EXPIRED: "reject_attempt_expired",
    BINDING_MISMATCH: "reject_binding",
    STATE_CONFLICT: "reject_state_conflict",
    RETRY_EXHAUSTED: "reject_retry_exhausted",
    INVALID_INPUT: "fail_internal_contract",
  };
  for (const [outcome, action] of Object.entries(expected)) {
    assert.equal(decideEduPublishBeginCommitHandlerAction(outcome), action);
  }
  for (const unknown of ["UNKNOWN", "ERROR", null, {}, 1, undefined]) {
    assert.equal(decideEduPublishBeginCommitHandlerAction(unknown), "fail_internal_contract");
  }
});

test("binding validator accepts the canonical binding", () => {
  assert.deepEqual(validateEduPublishBeginCommitBinding(requested), { ok: true, binding: requested });
  assert.deepEqual(validateEduPublishBeginCommitBinding(Object.assign(Object.create(null), requested)), {
    ok: true,
    binding: requested,
  });
});

test("binding validator rejects invalid payload, attempt, slug, manifest, and lease owner", () => {
  class BindingClass {
    attemptId = ATTEMPT_ID;
    slug = SLUG;
    manifestSchemaVersion = 1;
    declaredManifestDigest = DIGEST;
    leaseOwner = LEASE_OWNER;
  }
  const invalidCases: Array<[string, unknown, string]> = [
    ["null payload", null, "invalid_payload"],
    ["array", [], "invalid_payload"],
    ["class instance", new BindingClass(), "invalid_payload"],
    ["uppercase attempt", { ...requested, attemptId: "a0000000-0000-4000-8000-000000000001".toUpperCase() }, "invalid_attempt"],
    ["malformed attempt", { ...requested, attemptId: "not-an-attempt" }, "invalid_attempt"],
    ["empty slug", { ...requested, slug: "" }, "invalid_slug"],
    ["uppercase slug", { ...requested, slug: "ABC" }, "invalid_slug"],
    ["slug too long", { ...requested, slug: "a".repeat(65) }, "invalid_slug"],
    ["schema 2", { ...requested, manifestSchemaVersion: 2 }, "invalid_manifest"],
    ["uppercase digest", { ...requested, declaredManifestDigest: DIGEST.toUpperCase() }, "invalid_manifest"],
    ["short digest", { ...requested, declaredManifestDigest: "a".repeat(63) }, "invalid_manifest"],
    ["uppercase lease owner", { ...requested, leaseOwner: "a0000000-0000-4000-8000-000000000002".toUpperCase() }, "invalid_lease_owner"],
    ["malformed lease owner", { ...requested, leaseOwner: "00000000-0000-4000-7000-000000000002" }, "invalid_lease_owner"],
    ["opaque lease owner", { ...requested, leaseOwner: "worker-a" }, "invalid_lease_owner"],
  ];
  for (const [name, value, reason] of invalidCases) {
    assert.deepEqual(validateEduPublishBeginCommitBinding(value), { ok: false, reason }, name);
  }
});

test("stored observation state shapes are exact", () => {
  const validStates: EduPublishBeginCommitAttemptObservation[] = [
    prepared(),
    validating(),
    published(),
    retryable(),
    restartRequired(),
    abandoned(),
  ];
  for (const attempt of validStates) {
    const result = decideEduPublishBeginCommit(input(attempt));
    assert.notEqual(result.action, "raise");
  }

  const malformed: Array<[string, EduPublishBeginCommitAttemptObservation]> = [
    ["PREPARED with lease", prepared({ leaseOwner: LEASE_OWNER, leaseExpiresAtSeconds: 1_050 })],
    ["VALIDATING without lease", validating({ leaseOwner: null, leaseExpiresAtSeconds: null })],
    ["PUBLISHED without project", published({ projectId: null })],
    ["FAILED_RETRYABLE with restart code", retryable({ failureCode: "R2_DIGEST_MISMATCH" })],
    ["FAILED_RESTART_REQUIRED with retry code", restartRequired({ failureCode: "R2_TEMPORARY_FAILURE" })],
    ["ABANDONED without failure", abandoned({ failureCode: null })],
    ["ABANDONED with other failure", abandoned({ failureCode: "R2_OBJECT_MISSING" })],
  ];
  for (const [name, attempt] of malformed) {
    assert.deepEqual(decideEduPublishBeginCommit(input(attempt)), {
      action: "raise",
      reason: "stored_attempt_invalid",
    }, name);
  }
});

test("missing attempt and every binding mismatch are privacy-safe", () => {
  assert.deepEqual(decideEduPublishBeginCommit(input(null)), {
    action: "return",
    outcome: "BINDING_MISMATCH",
  });

  const fields: Array<[keyof EduPublishBeginCommitBinding, unknown]> = [
    ["attemptId", "00000000-0000-4000-8000-000000000099"],
    ["slug", "other-slug"],
    ["declaredManifestDigest", "b".repeat(64)],
  ];
  for (const [field, value] of fields) {
    const alteredAttempt = prepared({ [field]: value } as Partial<EduPublishBeginCommitAttemptObservation>);
    const result = decideEduPublishBeginCommit(input(alteredAttempt));
    assert.deepEqual(result, { action: "return", outcome: "BINDING_MISMATCH" });
    assert.equal(JSON.stringify(result).includes("project-"), false);
    assert.equal(JSON.stringify(result).includes(ATTEMPT_ID), false);
    assert.equal(JSON.stringify(result).includes(SLUG), false);
  }
  assert.deepEqual(
    decideEduPublishBeginCommit(input(prepared({ manifestSchemaVersion: 2 } as never))),
    { action: "raise", reason: "stored_attempt_invalid" },
  );
});

test("PUBLISHED replay returns its project before expiry checks", () => {
  for (const nowSeconds of [999, 2_000, 2_001]) {
    const attempt = published({ expiresAtSeconds: 2_000 });
    const result = assertUnchanged(input(attempt), () => decideEduPublishBeginCommit(input(attempt, { nowSeconds })));
    assert.deepEqual(result, { action: "return", outcome: "ALREADY_PUBLISHED", projectId: "project-1" });
  }
});

test("terminal states are not reclaimed", () => {
  assert.deepEqual(decideEduPublishBeginCommit(input(restartRequired())), {
    action: "return",
    outcome: "STATE_CONFLICT",
  });
  assert.deepEqual(decideEduPublishBeginCommit(input(abandoned())), {
    action: "return",
    outcome: "ATTEMPT_EXPIRED",
  });
});

test("attempt expiry transitions PREPARED, retryable, and VALIDATING states", () => {
  const cases: Array<[string, EduPublishBeginCommitAttemptObservation, number]> = [
    ["prepared at expiry", prepared({ attemptVersion: 4, retryCount: 1, commitCount: 2 }), 2_000],
    ["retryable after expiry", retryable({ attemptVersion: 7, retryCount: 2, commitCount: 4 }), 2_001],
    ["validating with active-looking lease", validating({ attemptVersion: 8, retryCount: 2, commitCount: 5, leaseExpiresAtSeconds: 2_200 }), 2_000],
    ["validating with stale lease", validating({ attemptVersion: 9, retryCount: 1, commitCount: 6, leaseExpiresAtSeconds: 1_900 }), 2_001],
  ];
  for (const [name, attempt, nowSeconds] of cases) {
    const result = decideEduPublishBeginCommit(input(attempt, { nowSeconds }));
    assert.deepEqual(result, {
      action: "mutate",
      outcome: "ATTEMPT_EXPIRED",
      next: {
        state: "ABANDONED",
        attemptVersion: attempt.attemptVersion + 1,
        retryCount: attempt.retryCount,
        commitCount: attempt.commitCount,
        leaseOwner: null,
        leaseExpiresAtSeconds: null,
        validationStartedAtSeconds: null,
        failedAtSeconds: nowSeconds,
        failureCode: "ATTEMPT_EXPIRED",
      },
    }, name);
  }
});

test("PREPARED initially claims with commit and lease metadata", () => {
  const attempt = prepared();
  const result = assertUnchanged(input(attempt), () => decideEduPublishBeginCommit(input(attempt)));
  assert.deepEqual(result, {
    action: "mutate",
    outcome: "CLAIMED",
    next: {
      state: "VALIDATING",
      attemptVersion: 5,
      retryCount: 0,
      commitCount: 1,
      leaseOwner: LEASE_OWNER,
      leaseExpiresAtSeconds: 1_300,
      validationStartedAtSeconds: 1_000,
      failedAtSeconds: null,
      failureCode: null,
    },
  });
});

test("lease expiry is clamped to attempt expiry and otherwise uses the default", () => {
  const clamped = decideEduPublishBeginCommit(input(prepared({ expiresAtSeconds: 2_000 }), { nowSeconds: 1_900 }));
  assert.equal(clamped.action, "mutate");
  if (clamped.action === "mutate") assert.equal(clamped.next.leaseExpiresAtSeconds, 2_000);

  const distant = decideEduPublishBeginCommit(input(prepared({ expiresAtSeconds: 10_000 }), { nowSeconds: 1_900 }));
  assert.equal(distant.action, "mutate");
  if (distant.action === "mutate") {
    assert.equal(distant.next.leaseExpiresAtSeconds, 1_900 + EDU_PUBLISH_ATTEMPT_DEFAULT_LEASE_SECONDS);
  }
});

test("FAILED_RETRYABLE reclaims only retry counts 0, 1, and 2", () => {
  for (const retryCount of [0, 1, 2]) {
    const result = decideEduPublishBeginCommit(input(retryable({ retryCount, commitCount: retryCount })));
    assert.equal(result.action, "mutate");
    if (result.action === "mutate") {
      assert.equal(result.outcome, "RECLAIMED_RETRYABLE");
      assert.equal(result.next.retryCount, retryCount + 1);
      assert.equal(result.next.commitCount, retryCount + 1);
      assert.equal(result.next.attemptVersion, 5);
      assert.equal(result.next.failureCode, null);
    }
  }
  assert.deepEqual(decideEduPublishBeginCommit(input(retryable({ retryCount: 3 }))), {
    action: "return",
    outcome: "RETRY_EXHAUSTED",
  });
  assert.equal(EDU_PUBLISH_ATTEMPT_MAX_SAME_ATTEMPT_RETRIES, 3);
});

test("active lease is inclusive at the boundary and stale lease takeover preserves retryCount", () => {
  const active = decideEduPublishBeginCommit(input(validating({ leaseExpiresAtSeconds: 1_001 })));
  assert.deepEqual(active, { action: "return", outcome: "LEASE_ACTIVE" });

  const staleAttempt = validating({ retryCount: 2, commitCount: 8, attemptVersion: 11, leaseExpiresAtSeconds: 1_000 });
  const stale = assertUnchanged(input(staleAttempt), () => decideEduPublishBeginCommit(input(staleAttempt)));
  assert.deepEqual(stale, {
    action: "mutate",
    outcome: "TAKEN_OVER_STALE_LEASE",
    next: {
      state: "VALIDATING",
      attemptVersion: 12,
      retryCount: 2,
      commitCount: 9,
      leaseOwner: LEASE_OWNER,
      leaseExpiresAtSeconds: 1_300,
      validationStartedAtSeconds: 1_000,
      failedAtSeconds: null,
      failureCode: null,
    },
  });
});

test("invalid now values are INVALID_INPUT", () => {
  for (const nowSeconds of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1000"]) {
    assert.deepEqual(decideEduPublishBeginCommit(input(prepared(), { nowSeconds })), {
      action: "return",
      outcome: "INVALID_INPUT",
    });
  }
});

test("counter and lease overflow are typed raises without stored values", () => {
  for (const attempt of [
    prepared({ attemptVersion: Number.MAX_SAFE_INTEGER }),
    prepared({ commitCount: Number.MAX_SAFE_INTEGER }),
  ]) {
    assert.deepEqual(decideEduPublishBeginCommit(input(attempt)), {
      action: "raise",
      reason: "counter_overflow",
    });
  }

  const result = decideEduPublishBeginCommit(input(prepared({ expiresAtSeconds: Number.MAX_SAFE_INTEGER }), {
    nowSeconds: Number.MAX_SAFE_INTEGER - 100,
  }));
  assert.deepEqual(result, { action: "raise", reason: "lease_expiry_overflow" });
  const serialized = JSON.stringify(result);
  for (const sentinel of [ATTEMPT_ID, SLUG, DIGEST, "project-1", LEASE_OWNER]) {
    assert.equal(serialized.includes(sentinel), false);
  }
});

test("decision is deterministic, mutation-free, and negative outcomes are privacy-safe", () => {
  const attempt = retryable({
    attemptId: "00000000-0000-4000-8000-000000000099",
    slug: "private-slug-sentinel",
    declaredManifestDigest: "b".repeat(64),
    failureCode: "R2_TEMPORARY_FAILURE",
  });
  const firstInput = input(attempt, { requested: { ...requested, attemptId: attempt.attemptId, slug: attempt.slug, declaredManifestDigest: attempt.declaredManifestDigest, leaseOwner: "00000000-0000-4000-8000-000000000004" } });
  const before = structuredClone(firstInput);
  const first = decideEduPublishBeginCommit(firstInput);
  const second = decideEduPublishBeginCommit(firstInput);
  assert.deepEqual(first, second);
  assert.deepEqual(firstInput, before);

  for (const negative of [
    decideEduPublishBeginCommit(input(null)),
    decideEduPublishBeginCommit(input(prepared({ slug: "other-slug" }))),
    decideEduPublishBeginCommit(input(restartRequired())),
    decideEduPublishBeginCommit(input(abandoned())),
    decideEduPublishBeginCommit(input(retryable({ retryCount: 3 }))),
    decideEduPublishBeginCommit(input(prepared(), { nowSeconds: "bad" })),
  ]) {
    const serialized = JSON.stringify(negative);
    for (const sentinel of [
      "private-attempt-sentinel",
      "private-slug-sentinel",
      "private-digest-sentinel",
      "private-project-sentinel",
      "private-lease-owner-sentinel",
      ATTEMPT_ID,
      SLUG,
      DIGEST,
      "project-1",
      LEASE_OWNER,
    ]) {
      assert.equal(serialized.includes(sentinel), false);
    }
  }
});

test("product source stays a pure contract boundary", () => {
  const source = readFileSync(resolve(process.cwd(), "lib/edu/publish/beginCommitContract.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  for (const pattern of [
    /\bNextRequest\b/,
    /\bResponse\b/,
    /\bSupabase\b/i,
    /\bcreateSupabaseAdminClient\b/,
    /\bprepare_edu_publish_attempt_v1\b/,
    /\bbegin_edu_publish_commit_v1\s*\(/,
    /\bR2\b/,
    /\bprefixExists\b/,
    /\bheadObject\b/,
    /\brecordOpsEvent\b/,
    /\bDate\.now\b/,
    /\bMath\.random\b/,
    /\bprocess\.env\b/,
    /\bnode:crypto\b/,
  ]) {
    assert.doesNotMatch(source, pattern, `forbidden product boundary: ${pattern}`);
  }
});
