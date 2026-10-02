import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES,
  EDU_PUBLISH_FAIL_COMMIT_OUTCOMES,
  decideEduPublishFailCommit,
  decideEduPublishFailCommitHandlerAction,
  validateEduPublishFailCommitBinding,
  type EduPublishFailCommitAttemptObservation,
  type EduPublishFailCommitBinding,
} from "@/lib/edu/publish/failCommitContract";
import {
  EDU_PUBLISH_ATTEMPT_REQUEST_ONLY_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES,
  classifyEduPublishAttemptFailureMutation,
} from "@/lib/edu/publish/attemptState";

const ATTEMPT_ID = "00000000-0000-4000-8000-000000000001";
const LEASE_OWNER = "00000000-0000-4000-8000-000000000002";
const OTHER_LEASE_OWNER = "00000000-0000-4000-8000-000000000003";
const DIGEST = "a".repeat(64);
const SLUG = "abc123-123456-p1";
const ATTEMPTS_MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20261224100000_create_edu_publish_attempts.sql",
);
const attemptsMigrationSql = readFileSync(ATTEMPTS_MIGRATION_PATH, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/--[^\n]*/g, " ")
  .replace(/\s+/g, " ")
  .toLowerCase();

const requested: EduPublishFailCommitBinding = {
  attemptId: ATTEMPT_ID,
  slug: SLUG,
  manifestSchemaVersion: 1,
  declaredManifestDigest: DIGEST,
  leaseOwner: LEASE_OWNER,
  expectedAttemptVersion: 5,
  failureCode: "R2_TEMPORARY_FAILURE",
};

const prepared = (
  overrides: Partial<EduPublishFailCommitAttemptObservation> = {},
): EduPublishFailCommitAttemptObservation => ({
  attemptId: ATTEMPT_ID,
  slug: SLUG,
  manifestSchemaVersion: 1,
  declaredManifestDigest: DIGEST,
  state: "PREPARED",
  attemptVersion: 5,
  retryCount: 1,
  commitCount: 2,
  expiresAtSeconds: 2_000,
  leaseOwner: null,
  leaseExpiresAtSeconds: null,
  projectId: null,
  failureCode: null,
  ...overrides,
});

const validating = (
  overrides: Partial<EduPublishFailCommitAttemptObservation> = {},
): EduPublishFailCommitAttemptObservation =>
  prepared({
    state: "VALIDATING",
    leaseOwner: LEASE_OWNER,
    leaseExpiresAtSeconds: 1_500,
    ...overrides,
  });

const published = (
  overrides: Partial<EduPublishFailCommitAttemptObservation> = {},
): EduPublishFailCommitAttemptObservation =>
  prepared({
    state: "PUBLISHED",
    projectId: "private-project-sentinel",
    ...overrides,
  });

const retryable = (
  overrides: Partial<EduPublishFailCommitAttemptObservation> = {},
): EduPublishFailCommitAttemptObservation =>
  prepared({
    state: "FAILED_RETRYABLE",
    failureCode: "R2_TEMPORARY_FAILURE",
    ...overrides,
  });

const restartRequired = (
  overrides: Partial<EduPublishFailCommitAttemptObservation> = {},
): EduPublishFailCommitAttemptObservation =>
  prepared({
    state: "FAILED_RESTART_REQUIRED",
    failureCode: "R2_DIGEST_MISMATCH",
    ...overrides,
  });

const abandoned = (
  overrides: Partial<EduPublishFailCommitAttemptObservation> = {},
): EduPublishFailCommitAttemptObservation =>
  prepared({
    state: "ABANDONED",
    failureCode: "ATTEMPT_EXPIRED",
    ...overrides,
  });

const input = (
  attempt: EduPublishFailCommitAttemptObservation | null,
  overrides: Record<string, unknown> = {},
) => ({ requested, nowSeconds: 1_200, attempt, ...overrides });

const withRequested = (
  attempt: EduPublishFailCommitAttemptObservation | null,
  overrides: Partial<EduPublishFailCommitBinding> = {},
) => input(attempt, { requested: { ...requested, ...overrides } });

const assertUnchanged = <T,>(value: T, decide: () => unknown) => {
  const before = structuredClone(value);
  const result = decide();
  assert.deepEqual(value, before);
  return result;
};

test("failure-code and outcome tuples are exact and ordered", () => {
  assert.deepEqual(EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES, [
    "R2_TEMPORARY_FAILURE",
    "DB_TEMPORARY_FAILURE",
    "RPC_TEMPORARY_FAILURE",
    "INTERNAL_EVALUATION_FAILED",
    "R2_OBJECT_MISSING",
    "R2_SIZE_MISMATCH",
    "R2_DIGEST_MISMATCH",
    "SLUG_CONFLICT",
  ]);
  assert.equal(EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES.length, 8);
  assert.equal(EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES.includes("ATTEMPT_EXPIRED" as never), false);
  for (const code of EDU_PUBLISH_ATTEMPT_REQUEST_ONLY_FAILURE_CODES) {
    assert.equal(EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES.includes(code as never), false);
  }

  assert.deepEqual(EDU_PUBLISH_FAIL_COMMIT_OUTCOMES, [
    "FAILED_RETRYABLE",
    "FAILED_RESTART_REQUIRED",
    "LEASE_EXPIRED",
    "LEASE_MISMATCH",
    "VERSION_MISMATCH",
    "BINDING_MISMATCH",
    "STATE_CONFLICT",
    "INVALID_INPUT",
  ]);
  assert.equal(EDU_PUBLISH_FAIL_COMMIT_OUTCOMES.length, 8);
  for (const forbidden of [
    "UNKNOWN",
    "ERROR",
    "FAILED",
    "ALREADY_FAILED",
    "ALREADY_PUBLISHED",
    "RETRY",
    "NOT_FOUND",
    "INTERNAL_ERROR",
  ]) {
    assert.equal(EDU_PUBLISH_FAIL_COMMIT_OUTCOMES.includes(forbidden as never), false);
  }
});

test("failure-code tuple stays aligned with existing classifications", () => {
  assert.deepEqual(
    EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES.slice(0, 4),
    EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES,
  );
  assert.deepEqual(EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES.slice(4), [
    "R2_OBJECT_MISSING",
    "R2_SIZE_MISMATCH",
    "R2_DIGEST_MISMATCH",
    "SLUG_CONFLICT",
  ]);
  assert.deepEqual(
    EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES.filter(
      (code) => code !== "ATTEMPT_EXPIRED",
    ),
    EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES.slice(4),
  );
  for (const code of EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES) {
    assert.notEqual(classifyEduPublishAttemptFailureMutation(code), "request_only");
    assert.notEqual(classifyEduPublishAttemptFailureMutation(code), "unknown");
  }
});

test("handler action mapping is exact and fails closed", () => {
  const expected: Record<string, string> = {
    FAILED_RETRYABLE: "return_retryable_failure",
    FAILED_RESTART_REQUIRED: "return_restart_required",
    LEASE_EXPIRED: "reject_lease_expired",
    LEASE_MISMATCH: "reject_lease_mismatch",
    VERSION_MISMATCH: "reject_version_mismatch",
    BINDING_MISMATCH: "reject_binding",
    STATE_CONFLICT: "reject_state_conflict",
    INVALID_INPUT: "fail_internal_contract",
  };
  for (const [outcome, action] of Object.entries(expected)) {
    assert.equal(decideEduPublishFailCommitHandlerAction(outcome), action);
  }
  for (const unknown of ["UNKNOWN", "ERROR", null, {}, 1, undefined]) {
    assert.equal(decideEduPublishFailCommitHandlerAction(unknown), "fail_internal_contract");
  }
});

test("binding validator accepts exact seven keys on plain objects", () => {
  assert.deepEqual(validateEduPublishFailCommitBinding(requested), {
    ok: true,
    binding: requested,
  });
  assert.deepEqual(
    validateEduPublishFailCommitBinding(Object.assign(Object.create(null), requested)),
    { ok: true, binding: requested },
  );
  assert.deepEqual(Object.keys(requested), [
    "attemptId",
    "slug",
    "manifestSchemaVersion",
    "declaredManifestDigest",
    "leaseOwner",
    "expectedAttemptVersion",
    "failureCode",
  ]);
});

test("invalid binding matrix is INVALID_INPUT without reaching stored state", () => {
  class BindingClass {
    attemptId = ATTEMPT_ID;
    slug = SLUG;
    manifestSchemaVersion = 1;
    declaredManifestDigest = DIGEST;
    leaseOwner = LEASE_OWNER;
    expectedAttemptVersion = 5;
    failureCode = "R2_TEMPORARY_FAILURE";
  }

  const symbolPayload = { ...requested } as Record<string | symbol, unknown>;
  symbolPayload[Symbol("private") ] = "sentinel";
  const invalidCases: Array<[string, unknown, string]> = [
    ["null", null, "invalid_payload"],
    ["array", [], "invalid_payload"],
    ["class instance", new BindingClass(), "invalid_payload"],
    ["missing key", (() => { const value = { ...requested }; delete (value as Partial<typeof requested>).failureCode; return value; })(), "invalid_payload"],
    ["extra key", { ...requested, extra: true }, "invalid_payload"],
    ["symbol key", symbolPayload, "invalid_payload"],
    ["uppercase attempt", { ...requested, attemptId: "a0000000-0000-4000-8000-000000000001".toUpperCase() }, "invalid_attempt"],
    ["invalid slug", { ...requested, slug: "ABC" }, "invalid_slug"],
    ["schema 2", { ...requested, manifestSchemaVersion: 2 }, "invalid_manifest"],
    ["uppercase digest", { ...requested, declaredManifestDigest: DIGEST.toUpperCase() }, "invalid_manifest"],
    ["uppercase lease", { ...requested, leaseOwner: "a0000000-0000-4000-8000-000000000002".toUpperCase() }, "invalid_lease_owner"],
    ["negative version", { ...requested, expectedAttemptVersion: -1 }, "invalid_version"],
    ["fractional version", { ...requested, expectedAttemptVersion: 1.5 }, "invalid_version"],
    ["NaN version", { ...requested, expectedAttemptVersion: Number.NaN }, "invalid_version"],
    ["infinite version", { ...requested, expectedAttemptVersion: Number.POSITIVE_INFINITY }, "invalid_version"],
    ["request-only failure", { ...requested, failureCode: "CAPABILITY_INVALID" }, "invalid_failure_code"],
    ["attempt expired", { ...requested, failureCode: "ATTEMPT_EXPIRED" }, "invalid_failure_code"],
    ["unknown failure", { ...requested, failureCode: "UNKNOWN" }, "invalid_failure_code"],
  ];

  for (const [name, value, reason] of invalidCases) {
    assert.deepEqual(validateEduPublishFailCommitBinding(value), { ok: false, reason }, name);
    assert.deepEqual(
      decideEduPublishFailCommit({ requested: value, nowSeconds: 1_200, attempt: validating() }),
      { action: "return", outcome: "INVALID_INPUT" },
      name,
    );
  }
  for (const value of [undefined, "value", 1, true, () => null, new Date()]) {
    assert.deepEqual(validateEduPublishFailCommitBinding(value), {
      ok: false,
      reason: "invalid_payload",
    });
  }
});

test("stored observation state shapes are exact", () => {
  const validStates = [
    prepared(),
    validating(),
    published(),
    retryable(),
    restartRequired(),
    restartRequired({ failureCode: "ATTEMPT_EXPIRED" }),
    abandoned(),
  ];
  for (const attempt of validStates) {
    const result = decideEduPublishFailCommit(input(attempt));
    assert.notEqual(result.action, "raise");
  }

  const malformed: Array<[string, EduPublishFailCommitAttemptObservation]> = [
    ["PREPARED with lease", prepared({ leaseOwner: LEASE_OWNER, leaseExpiresAtSeconds: 1_400 })],
    ["VALIDATING without lease", validating({ leaseOwner: null, leaseExpiresAtSeconds: null })],
    ["PUBLISHED without project", published({ projectId: null })],
    ["FAILED_RETRYABLE with restart code", retryable({ failureCode: "R2_DIGEST_MISMATCH" })],
    ["FAILED_RESTART_REQUIRED with retry code", restartRequired({ failureCode: "R2_TEMPORARY_FAILURE" })],
    ["ABANDONED without failure", abandoned({ failureCode: null })],
    ["ABANDONED with retry code", abandoned({ failureCode: "R2_TEMPORARY_FAILURE" })],
  ];
  for (const [name, attempt] of malformed) {
    assert.deepEqual(decideEduPublishFailCommit(input(attempt)), {
      action: "raise",
      reason: "stored_attempt_invalid",
    }, name);
  }
});

test("ATTEMPT_EXPIRED is stored terminal state only", () => {
  const restartExpiredInput = input(restartRequired({ failureCode: "ATTEMPT_EXPIRED" }));
  assert.deepEqual(
    assertUnchanged(restartExpiredInput, () => decideEduPublishFailCommit(restartExpiredInput)),
    { action: "return", outcome: "STATE_CONFLICT" },
  );

  const abandonedInput = input(abandoned());
  assert.deepEqual(
    assertUnchanged(abandonedInput, () => decideEduPublishFailCommit(abandonedInput)),
    { action: "return", outcome: "STATE_CONFLICT" },
  );

  assert.deepEqual(
    validateEduPublishFailCommitBinding({
      ...requested,
      failureCode: "ATTEMPT_EXPIRED",
    }),
    { ok: false, reason: "invalid_failure_code" },
  );
  assert.deepEqual(
    decideEduPublishFailCommit({
      requested: { ...requested, failureCode: "ATTEMPT_EXPIRED" },
      nowSeconds: 1_200,
      attempt: restartExpiredInput.attempt,
    }),
    { action: "return", outcome: "INVALID_INPUT" },
  );
});

test("migration state shapes and fail request tuple stay aligned", () => {
  assert.match(
    attemptsMigrationSql,
    /state = 'failed_restart_required' and [^)]*failure_code in \( [^)]*'attempt_expired'/,
  );
  assert.match(
    attemptsMigrationSql,
    /state = 'abandoned' and [^)]*failure_code = 'attempt_expired'/,
  );
  assert.equal(
    EDU_PUBLISH_FAIL_COMMIT_FAILURE_CODES.includes("ATTEMPT_EXPIRED" as never),
    false,
  );
});

test("stored observation validates counters, lease, project, and failure code", () => {
  const malformed: Array<[string, EduPublishFailCommitAttemptObservation]> = [
    ["invalid attempt version", validating({ attemptVersion: -1 })],
    ["fractional attempt version", validating({ attemptVersion: 1.5 })],
    ["retry count below zero", validating({ retryCount: -1 })],
    ["retry count above three", validating({ retryCount: 4 })],
    ["fractional retry count", validating({ retryCount: 1.5 })],
    ["negative commit count", validating({ commitCount: -1 })],
    ["invalid expiry", validating({ expiresAtSeconds: 0 })],
    ["negative lease expiry", validating({ leaseExpiresAtSeconds: -1 })],
    ["mismatched lease nullability", validating({ leaseOwner: null })],
    ["malformed lease owner", validating({ leaseOwner: "worker-a" })],
    ["empty project", published({ projectId: "" })],
    ["non-string project", published({ projectId: 1 as never })],
    ["unknown failure", retryable({ failureCode: "UNKNOWN" as never })],
  ];
  for (const [name, attempt] of malformed) {
    assert.deepEqual(decideEduPublishFailCommit(input(attempt)), {
      action: "raise",
      reason: "stored_attempt_invalid",
    }, name);
  }
});

test("missing attempt and binding mismatches are privacy-safe and precede worker decisions", () => {
  assert.deepEqual(decideEduPublishFailCommit(input(null)), {
    action: "return",
    outcome: "BINDING_MISMATCH",
  });

  const fields: Array<[keyof Pick<EduPublishFailCommitBinding, "attemptId" | "slug" | "declaredManifestDigest">, unknown]> = [
    ["attemptId", "00000000-0000-4000-8000-000000000099"],
    ["slug", "other-slug"],
    ["declaredManifestDigest", "b".repeat(64)],
  ];
  for (const [field, value] of fields) {
    const alteredAttempt = prepared({ [field]: value } as Partial<EduPublishFailCommitAttemptObservation>);
    const result = decideEduPublishFailCommit(input(alteredAttempt));
    assert.deepEqual(result, { action: "return", outcome: "BINDING_MISMATCH" }, field);
  }

  const schemaMismatchResult = decideEduPublishFailCommit({
    requested: { ...requested, manifestSchemaVersion: 1 },
    nowSeconds: 1_200,
    attempt: { ...prepared(), manifestSchemaVersion: 2 } as never,
  });
  assert.deepEqual(schemaMismatchResult, { action: "raise", reason: "stored_attempt_invalid" });

  const malformedObservation = validating({ leaseOwner: null, leaseExpiresAtSeconds: null });
  const malformedResult = decideEduPublishFailCommit({
    requested: { ...requested, slug: "other-slug" },
    nowSeconds: 1_200,
    attempt: malformedObservation,
  });
  assert.deepEqual(malformedResult, { action: "raise", reason: "stored_attempt_invalid" });
});

test("all non-VALIDATING states are state conflicts after exact binding", () => {
  for (const attempt of [prepared(), published(), retryable(), restartRequired(), abandoned()]) {
    assert.deepEqual(decideEduPublishFailCommit(input(attempt)), {
      action: "return",
      outcome: "STATE_CONFLICT",
    }, attempt.state);
  }
});

test("version mismatch is delegated and does not mutate", () => {
  for (const expectedAttemptVersion of [4, 6]) {
    const attempt = validating();
    const result = assertUnchanged(
      input(attempt, { requested: { ...requested, expectedAttemptVersion } }),
      () => decideEduPublishFailCommit(input(attempt, { requested: { ...requested, expectedAttemptVersion } })),
    );
    assert.deepEqual(result, { action: "return", outcome: "VERSION_MISMATCH" });
  }
});

test("lease owner mismatch is delegated and does not mutate", () => {
  const attempt = validating();
  const result = decideEduPublishFailCommit(withRequested(attempt, { leaseOwner: OTHER_LEASE_OWNER }));
  assert.deepEqual(result, { action: "return", outcome: "LEASE_MISMATCH" });
});

test("lease expiry is strict at the boundary", () => {
  const beforeExpiry = decideEduPublishFailCommit(input(validating(), { nowSeconds: 1_499 }));
  assert.equal(beforeExpiry.action, "mutate");
  if (beforeExpiry.action === "mutate") {
    assert.equal(beforeExpiry.outcome, "FAILED_RETRYABLE");
    assert.equal(beforeExpiry.next.failedAtSeconds, 1_499);
  }
  assert.deepEqual(decideEduPublishFailCommit(input(validating(), { nowSeconds: 1_500 })), {
    action: "return",
    outcome: "LEASE_EXPIRED",
  });
  assert.deepEqual(decideEduPublishFailCommit(input(validating(), { nowSeconds: 1_501 })), {
    action: "return",
    outcome: "LEASE_EXPIRED",
  });
});

test("retryable failures preserve counters and clear the lease", () => {
  for (const failureCode of EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES) {
    const attempt = validating({ attemptVersion: 5, retryCount: 1, commitCount: 2 });
    const result = decideEduPublishFailCommit(input(attempt, {
      requested: { ...requested, failureCode },
    }));
    assert.deepEqual(result, {
      action: "mutate",
      outcome: "FAILED_RETRYABLE",
      next: {
        state: "FAILED_RETRYABLE",
        attemptVersion: 6,
        retryCount: 1,
        commitCount: 2,
        leaseOwner: null,
        leaseExpiresAtSeconds: null,
        projectId: null,
        failureCode,
        failedAtSeconds: 1_200,
      },
    }, failureCode);
  }
});

test("restart-required failures preserve counters and clear the lease", () => {
  for (const failureCode of [
    "R2_OBJECT_MISSING",
    "R2_SIZE_MISMATCH",
    "R2_DIGEST_MISMATCH",
    "SLUG_CONFLICT",
  ] as const) {
    const attempt = validating({ attemptVersion: 5, retryCount: 1, commitCount: 2 });
    const result = decideEduPublishFailCommit(input(attempt, {
      requested: { ...requested, failureCode },
    }));
    assert.deepEqual(result, {
      action: "mutate",
      outcome: "FAILED_RESTART_REQUIRED",
      next: {
        state: "FAILED_RESTART_REQUIRED",
        attemptVersion: 6,
        retryCount: 1,
        commitCount: 2,
        leaseOwner: null,
        leaseExpiresAtSeconds: null,
        projectId: null,
        failureCode,
        failedAtSeconds: 1_200,
      },
    }, failureCode);
  }
});

test("attempt version overflow raises before worker transition", () => {
  const attempt = validating({ attemptVersion: Number.MAX_SAFE_INTEGER });
  assert.deepEqual(
    decideEduPublishFailCommit(input(attempt, {
      requested: { ...requested, expectedAttemptVersion: Number.MAX_SAFE_INTEGER },
    })),
    { action: "raise", reason: "counter_overflow" },
  );
});

test("invalid now values are INVALID_INPUT", () => {
  for (const nowSeconds of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1200", null, undefined]) {
    assert.deepEqual(decideEduPublishFailCommit(input(validating(), { nowSeconds })), {
      action: "return",
      outcome: "INVALID_INPUT",
    });
  }
});

test("decision is deterministic and mutation-free", () => {
  const attempt = validating();
  const decisionInput = input(attempt);
  const before = structuredClone(decisionInput);
  const first = decideEduPublishFailCommit(decisionInput);
  const second = decideEduPublishFailCommit(decisionInput);
  assert.deepEqual(first, second);
  assert.deepEqual(decisionInput, before);

  const nullAttemptInput = input(null);
  assertUnchanged(nullAttemptInput, () => decideEduPublishFailCommit(nullAttemptInput));
});

test("negative and raise results expose no stored identity or secret fields", () => {
  const privateAttempt = validating({
    attemptId: "00000000-0000-4000-8000-000000000099",
    slug: "private-slug-sentinel",
    declaredManifestDigest: "b".repeat(64),
    leaseOwner: LEASE_OWNER,
    projectId: null,
  });
  const privateRequested = {
    ...requested,
    attemptId: privateAttempt.attemptId,
    slug: privateAttempt.slug,
    declaredManifestDigest: privateAttempt.declaredManifestDigest,
  };
  const negativeResults = [
    decideEduPublishFailCommit({ requested: privateRequested, nowSeconds: 1_200, attempt: null }),
    decideEduPublishFailCommit({
      requested: { ...privateRequested, slug: SLUG },
      nowSeconds: 1_200,
      attempt: privateAttempt,
    }),
    decideEduPublishFailCommit({
      requested: { ...privateRequested, leaseOwner: OTHER_LEASE_OWNER },
      nowSeconds: 1_200,
      attempt: privateAttempt,
    }),
    decideEduPublishFailCommit({
      requested: { ...privateRequested, expectedAttemptVersion: 4 },
      nowSeconds: 1_200,
      attempt: privateAttempt,
    }),
    decideEduPublishFailCommit({
      requested: privateRequested,
      nowSeconds: 1_500,
      attempt: privateAttempt,
    }),
    decideEduPublishFailCommit({
      requested: privateRequested,
      nowSeconds: 1_200,
      attempt: prepared({
        attemptId: privateAttempt.attemptId,
        slug: privateAttempt.slug,
        declaredManifestDigest: privateAttempt.declaredManifestDigest,
        projectId: "private-project-sentinel",
      }),
    }),
    decideEduPublishFailCommit({ requested: privateRequested, nowSeconds: "bad", attempt: privateAttempt }),
  ];
  const malformedPrivateAttempt = {
    ...privateAttempt,
    state: "VALIDATING",
    leaseOwner: null,
    leaseExpiresAtSeconds: null,
    failureCode: "private-failure-sentinel",
  };
  const raise = decideEduPublishFailCommit({
    requested: privateRequested,
    nowSeconds: 1_200,
    attempt: malformedPrivateAttempt as never,
  });
  negativeResults.push(raise);

  for (const result of negativeResults) {
    assert.deepEqual(Object.keys(result), ["action", result.action === "return" ? "outcome" : "reason"]);
    const serialized = JSON.stringify(result);
    for (const sentinel of [
      "private-attempt-sentinel",
      "private-slug-sentinel",
      "private-digest-sentinel",
      "private-lease-sentinel",
      "private-project-sentinel",
      "private-failure-sentinel",
      privateAttempt.attemptId,
      privateAttempt.slug,
      privateAttempt.declaredManifestDigest,
      LEASE_OWNER,
    ]) {
      assert.equal(serialized.includes(sentinel), false, sentinel);
    }
  }
});

test("product source is a pure contract boundary and reuses existing helpers", () => {
  const source = readFileSync(resolve(process.cwd(), "lib/edu/publish/failCommitContract.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  for (const pattern of [
    /\bNextRequest\b/,
    /\bNextResponse\b/,
    /\bResponse\b/,
    /\bSupabase\b/i,
    /\bcreateSupabaseAdminClient\b/,
    /\bfail_edu_publish_commit_v1\s*\(/,
    /\bR2\b/,
    /\bheadObject\b/,
    /\blistObjectKeysV2\b/,
    /\brecordOpsEvent\b/,
    /\bDate\.now\b/,
    /\bMath\.random\b/,
    /\bprocess\.env\b/,
    /\bnode:crypto\b/,
    /\bfilesystem\b/i,
  ]) {
    assert.doesNotMatch(source, pattern, `forbidden product boundary: ${pattern}`);
  }
  assert.match(source, /validateEduPublishBeginCommitBinding/);
  assert.match(source, /classifyEduPublishAttemptFailureMutation/);
  assert.match(source, /decideEduPublishAttemptWorkerTransition/);
});
