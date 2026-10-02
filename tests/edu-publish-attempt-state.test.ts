import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  EDU_PUBLISH_ATTEMPT_DEFAULT_LEASE_SECONDS,
  EDU_PUBLISH_ATTEMPT_MAX_SAME_ATTEMPT_RETRIES,
  EDU_PUBLISH_ATTEMPT_REQUEST_ONLY_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES,
  EDU_PUBLISH_ATTEMPT_STATES,
  classifyEduPublishAttemptFailureMutation,
  decideEduPublishAttemptClaim,
  decideEduPublishAttemptCleanup,
  decideEduPublishAttemptWorkerTransition,
  type EduPublishAttemptSnapshot,
} from "@/lib/edu/publish/attemptState";

const basePrepared = (overrides: Partial<EduPublishAttemptSnapshot> = {}): EduPublishAttemptSnapshot => ({
  state: "PREPARED",
  attemptVersion: 4,
  retryCount: 0,
  expiresAtSeconds: 2_000,
  leaseOwner: null,
  leaseExpiresAtSeconds: null,
  projectId: null,
  ...overrides,
});

const validating = (overrides: Partial<EduPublishAttemptSnapshot> = {}): EduPublishAttemptSnapshot => ({
  ...basePrepared(),
  state: "VALIDATING",
  leaseOwner: "worker-a",
  leaseExpiresAtSeconds: 1_100,
  ...overrides,
});

const published = (overrides: Partial<EduPublishAttemptSnapshot> = {}): EduPublishAttemptSnapshot => ({
  ...basePrepared(),
  state: "PUBLISHED",
  projectId: "project-1",
  ...overrides,
});

const claim = (snapshot: EduPublishAttemptSnapshot, overrides: Record<string, unknown> = {}) => ({
  snapshot,
  nowSeconds: 1_000,
  leaseOwner: "worker-b",
  ...overrides,
});

const worker = (snapshot: EduPublishAttemptSnapshot, overrides: Record<string, unknown> = {}) => ({
  snapshot,
  expectedAttemptVersion: snapshot.attemptVersion,
  leaseOwner: snapshot.leaseOwner,
  nowSeconds: 1_050,
  event: { type: "publish_succeeded", projectId: "project-2" },
  ...overrides,
});

const cleanup = (snapshot: EduPublishAttemptSnapshot, nowSeconds: number) => ({ snapshot, nowSeconds });

const assertUnchanged = <T,>(input: T, decide: () => unknown) => {
  const before = structuredClone(input);
  const result = decide();
  assert.deepEqual(input, before);
  return result;
};

test("state completeness is exactly the six attempt states", () => {
  assert.deepEqual(EDU_PUBLISH_ATTEMPT_STATES, [
    "PREPARED",
    "VALIDATING",
    "PUBLISHED",
    "FAILED_RETRYABLE",
    "FAILED_RESTART_REQUIRED",
    "ABANDONED",
  ]);
  const source = readFileSync(resolve(process.cwd(), "lib/edu/publish/attemptState.ts"), "utf8");
  for (const state of ["UPLOADING", "PUBLISHING", "DRAFT", "SYNC_PENDING"]) {
    assert.equal(source.includes(`\"${state}\"`), false, `unexpected persistent state: ${state}`);
  }
});

test("attempt constants fix the default lease and retry boundary", () => {
  assert.equal(EDU_PUBLISH_ATTEMPT_DEFAULT_LEASE_SECONDS, 300);
  assert.equal(EDU_PUBLISH_ATTEMPT_MAX_SAME_ATTEMPT_RETRIES, 3);
});

test("PREPARED claims initially with a new lease", () => {
  const input = claim(basePrepared(), { leaseSeconds: 45 });
  const result = assertUnchanged(input, () => decideEduPublishAttemptClaim(input));
  assert.deepEqual(result, {
    action: "claim",
    reason: "initial",
    next: {
      state: "VALIDATING",
      attemptVersion: 5,
      retryCount: 0,
      expiresAtSeconds: 2_000,
      leaseOwner: "worker-b",
      leaseExpiresAtSeconds: 1_045,
      projectId: null,
    },
  });
});

test("FAILED_RETRYABLE claims for retryCount 0, 1, and 2, then stops at 3", () => {
  for (const retryCount of [0, 1, 2]) {
    const result = decideEduPublishAttemptClaim(claim(basePrepared({ state: "FAILED_RETRYABLE", retryCount }), { leaseSeconds: 20 }));
    assert.equal(result.action, "claim");
    if (result.action === "claim") {
      assert.equal(result.reason, "retry");
      assert.equal(result.next.retryCount, retryCount + 1);
      assert.equal(result.next.attemptVersion, 5);
    }
  }
  assert.deepEqual(
    decideEduPublishAttemptClaim(claim(basePrepared({ state: "FAILED_RETRYABLE", retryCount: 3 }))),
    { action: "reject", reason: "retry_limit_exceeded" },
  );
});

test("PUBLISHED replays even after attempt expiry", () => {
  assert.deepEqual(
    decideEduPublishAttemptClaim(claim(published({ expiresAtSeconds: 999 }), { nowSeconds: 999 })),
    { action: "reuse", reason: "already_published", projectId: "project-1" },
  );
});

test("restart-required and abandoned attempts reject", () => {
  assert.deepEqual(
    decideEduPublishAttemptClaim(claim(basePrepared({ state: "FAILED_RESTART_REQUIRED" }))),
    { action: "reject", reason: "restart_required" },
  );
  assert.deepEqual(
    decideEduPublishAttemptClaim(claim(basePrepared({ state: "ABANDONED" }))),
    { action: "reject", reason: "abandoned" },
  );
});

test("attempt expiry is inclusive", () => {
  assert.equal(decideEduPublishAttemptClaim(claim(basePrepared(), { nowSeconds: 1_999 })).action, "claim");
  assert.deepEqual(
    decideEduPublishAttemptClaim(claim(basePrepared(), { nowSeconds: 2_000 })),
    { action: "reject", reason: "attempt_expired" },
  );
});

test("active lease conflicts at the last second and returns exact Retry-After", () => {
  const snapshot = validating({ leaseExpiresAtSeconds: 1_010 });
  const result = decideEduPublishAttemptClaim(claim(snapshot, { nowSeconds: 1_009, leaseOwner: "worker-a" }));
  assert.deepEqual(result, { action: "conflict", reason: "lease_active", retryAfterSeconds: 1 });
  assert.deepEqual(
    decideEduPublishAttemptClaim(claim(snapshot, { nowSeconds: 1_005 })).retryAfterSeconds,
    5,
  );
});

test("lease expiry boundary allows stale takeover without increasing retryCount", () => {
  const input = claim(validating({ retryCount: 2, attemptVersion: 8, leaseExpiresAtSeconds: 1_000 }), { leaseSeconds: 31 });
  const result = assertUnchanged(input, () => decideEduPublishAttemptClaim(input));
  assert.deepEqual(result, {
    action: "claim",
    reason: "stale_lease_takeover",
    next: {
      state: "VALIDATING",
      attemptVersion: 9,
      retryCount: 2,
      expiresAtSeconds: 2_000,
      leaseOwner: "worker-b",
      leaseExpiresAtSeconds: 1_031,
      projectId: null,
    },
  });
});

test("worker publish success atomically produces PUBLISHED and clears the lease", () => {
  const input = worker(validating({ attemptVersion: 7, retryCount: 1 }));
  const result = assertUnchanged(input, () => decideEduPublishAttemptWorkerTransition(input));
  assert.deepEqual(result, {
    action: "transition",
    next: {
      state: "PUBLISHED",
      attemptVersion: 8,
      retryCount: 1,
      expiresAtSeconds: 2_000,
      leaseOwner: null,
      leaseExpiresAtSeconds: null,
      projectId: "project-2",
    },
  });
});

test("worker retryable failure clears the lease without increasing retryCount", () => {
  const result = decideEduPublishAttemptWorkerTransition(worker(validating({ retryCount: 2 }), {
    event: { type: "retryable_failure", failureCode: "R2_TEMPORARY_FAILURE" },
  }));
  assert.deepEqual(result, {
    action: "transition",
    next: {
      state: "FAILED_RETRYABLE",
      attemptVersion: 5,
      retryCount: 2,
      expiresAtSeconds: 2_000,
      leaseOwner: null,
      leaseExpiresAtSeconds: null,
      projectId: null,
    },
  });
});

test("worker restart-required failure clears the lease and blocks the attempt", () => {
  const result = decideEduPublishAttemptWorkerTransition(worker(validating(), {
    event: { type: "restart_required_failure", failureCode: "R2_DIGEST_MISMATCH" },
  }));
  assert.deepEqual(result, {
    action: "transition",
    next: {
      state: "FAILED_RESTART_REQUIRED",
      attemptVersion: 5,
      retryCount: 0,
      expiresAtSeconds: 2_000,
      leaseOwner: null,
      leaseExpiresAtSeconds: null,
      projectId: null,
    },
  });
});

test("worker rejects wrong state, version, owner, expired lease, and invalid event", () => {
  assert.deepEqual(
    decideEduPublishAttemptWorkerTransition(worker(basePrepared(), { leaseOwner: "worker-a" })),
    { action: "reject", reason: "invalid_state" },
  );
  assert.deepEqual(
    decideEduPublishAttemptWorkerTransition(worker(validating(), { expectedAttemptVersion: 99 })),
    { action: "reject", reason: "version_mismatch" },
  );
  assert.deepEqual(
    decideEduPublishAttemptWorkerTransition(worker(validating(), { leaseOwner: "worker-other" })),
    { action: "reject", reason: "lease_owner_mismatch" },
  );
  assert.deepEqual(
    decideEduPublishAttemptWorkerTransition(worker(validating(), { nowSeconds: 1_100 })),
    { action: "reject", reason: "lease_expired" },
  );
  assert.deepEqual(
    decideEduPublishAttemptWorkerTransition(worker(validating(), { event: { type: "retryable_failure", failureCode: "UNKNOWN" } })),
    { action: "reject", reason: "invalid_input" },
  );
});

test("failure mutation classification has exact request-only, retryable, and restart matrices", () => {
  for (const code of EDU_PUBLISH_ATTEMPT_REQUEST_ONLY_FAILURE_CODES) assert.equal(classifyEduPublishAttemptFailureMutation(code), "request_only");
  for (const code of EDU_PUBLISH_ATTEMPT_RETRYABLE_FAILURE_CODES) assert.equal(classifyEduPublishAttemptFailureMutation(code), "retryable");
  for (const code of EDU_PUBLISH_ATTEMPT_RESTART_REQUIRED_FAILURE_CODES) assert.equal(classifyEduPublishAttemptFailureMutation(code), "restart_required");
});

test("unknown failure codes remain unknown, including invalid runtime values", () => {
  for (const code of ["", null, 1, "RPC_CONFLICT", "RPC_UNKNOWN_FAILURE", "PROVIDER_ERROR", "UNKNOWN"]) {
    assert.equal(classifyEduPublishAttemptFailureMutation(code), "unknown");
  }
});

test("capability expiry is request-only while attempt expiry is restart-required", () => {
  assert.equal(classifyEduPublishAttemptFailureMutation("CAPABILITY_EXPIRED"), "request_only");
  assert.equal(classifyEduPublishAttemptFailureMutation("ATTEMPT_EXPIRED"), "restart_required");
});

test("cleanup transitions expired nonterminal attempts and preserves terminal attempts", () => {
  assert.deepEqual(decideEduPublishAttemptCleanup(cleanup(basePrepared(), 2_000)), {
    action: "transition",
    reason: "expired_nonterminal",
    next: { ...basePrepared(), state: "ABANDONED", attemptVersion: 5 },
  });
  assert.deepEqual(decideEduPublishAttemptCleanup(cleanup(basePrepared({ state: "FAILED_RETRYABLE" }), 2_000)), {
    action: "transition",
    reason: "expired_nonterminal",
    next: { ...basePrepared({ state: "FAILED_RETRYABLE" }), state: "ABANDONED", attemptVersion: 5 },
  });
  assert.deepEqual(decideEduPublishAttemptCleanup(cleanup(validating({ leaseExpiresAtSeconds: 1_100 }), 1_099)), { action: "keep", reason: "active_lease" });
  assert.deepEqual(decideEduPublishAttemptCleanup(cleanup(validating({ leaseExpiresAtSeconds: 1_000 }), 1_500)), { action: "keep", reason: "not_expired" });
  assert.deepEqual(decideEduPublishAttemptCleanup(cleanup(validating({ leaseExpiresAtSeconds: 1_000 }), 2_000)), {
    action: "transition",
    reason: "expired_nonterminal",
    next: { ...validating({ leaseExpiresAtSeconds: 1_000 }), state: "ABANDONED", attemptVersion: 5, leaseOwner: null, leaseExpiresAtSeconds: null },
  });
  for (const snapshot of [published(), basePrepared({ state: "FAILED_RESTART_REQUIRED" }), basePrepared({ state: "ABANDONED" })]) {
    assert.deepEqual(decideEduPublishAttemptCleanup(cleanup(snapshot, 9_999)), { action: "keep", reason: "terminal" });
  }
});

test("malformed snapshots and inputs reject without throwing", () => {
  const malformedSnapshots: unknown[] = [
    null,
    undefined,
    [],
    1,
    basePrepared({ state: "NOPE" as never }),
    basePrepared({ attemptVersion: -1 }),
    basePrepared({ attemptVersion: 1.5 }),
    basePrepared({ retryCount: -1 }),
    basePrepared({ retryCount: Number.NaN }),
    basePrepared({ expiresAtSeconds: Number.POSITIVE_INFINITY }),
    basePrepared({ leaseOwner: "worker-a" }),
    basePrepared({ projectId: "project-1" }),
    validating({ leaseExpiresAtSeconds: 0 }),
    published({ projectId: "" }),
  ];
  for (const snapshot of malformedSnapshots) {
    assert.doesNotThrow(() => decideEduPublishAttemptClaim(claim(snapshot as EduPublishAttemptSnapshot)));
    assert.deepEqual(
      decideEduPublishAttemptClaim(claim(snapshot as EduPublishAttemptSnapshot)),
      { action: "reject", reason: "invalid_snapshot" },
    );
  }
  for (const input of [null, undefined, [], 1]) {
    assert.deepEqual(decideEduPublishAttemptClaim(input as never), { action: "reject", reason: "invalid_input" });
    assert.deepEqual(decideEduPublishAttemptWorkerTransition(input as never), { action: "reject", reason: "invalid_input" });
    assert.deepEqual(decideEduPublishAttemptCleanup(input as never), { action: "reject", reason: "invalid_input" });
  }
});

test("invalid arithmetic inputs reject and never overflow", () => {
  assert.deepEqual(
    decideEduPublishAttemptClaim(claim(basePrepared(), { nowSeconds: Number.MAX_SAFE_INTEGER, leaseSeconds: 2 })),
    { action: "reject", reason: "invalid_input" },
  );
  assert.deepEqual(
    decideEduPublishAttemptClaim(claim(basePrepared(), { leaseSeconds: Number.MAX_SAFE_INTEGER + 1 })),
    { action: "reject", reason: "invalid_input" },
  );
  assert.deepEqual(
    decideEduPublishAttemptClaim(claim(basePrepared({ attemptVersion: Number.MAX_SAFE_INTEGER }))),
    { action: "reject", reason: "invalid_snapshot" },
  );
});

test("all public decisions are deterministic, immutable, and secret-free", () => {
  const sentinel = [
    "private-capability-sentinel",
    "private-secret-sentinel",
    "private-manifest-sentinel",
    "private-digest-sentinel",
    "private-slug-sentinel",
  ];
  const input = claim({ ...basePrepared(), privateData: sentinel } as EduPublishAttemptSnapshot, { privateData: sentinel });
  const before = structuredClone(input);
  const first = decideEduPublishAttemptClaim(input as never);
  const second = decideEduPublishAttemptClaim(input as never);
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  for (const value of [first, second]) {
    const serialized = JSON.stringify(value);
    for (const secret of sentinel) assert.equal(serialized.includes(secret), false);
  }
  const transitionInput = worker(validating(), {
    event: { type: "retryable_failure", failureCode: "DB_TEMPORARY_FAILURE", privateData: sentinel },
    privateData: sentinel,
  });
  const transitionBefore = structuredClone(transitionInput);
  const transition = decideEduPublishAttemptWorkerTransition(transitionInput as never);
  assert.deepEqual(transitionInput, transitionBefore);
  for (const secret of sentinel) assert.equal(JSON.stringify(transition).includes(secret), false);
});
