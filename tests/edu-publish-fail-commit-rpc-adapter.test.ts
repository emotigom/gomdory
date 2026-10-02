import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  EDU_PUBLISH_FAIL_COMMIT_RPC,
  failEduPublishCommitViaRpc,
  type FailRpcCaller,
} from "@/lib/server/edu/publish/failCommitRpc";

const VALID_INPUT = {
  attemptId: "00000000-0000-4000-8000-000000000001",
  slug: "abc123-123456-p1",
  manifestSchemaVersion: 1,
  declaredManifestDigest: "a".repeat(64),
  leaseOwner: "00000000-0000-4000-8000-000000000002",
  expectedAttemptVersion: 4,
  failureCode: "R2_TEMPORARY_FAILURE" as const,
};

const EXPIRES_AT = "2026-12-24T01:45:00.000Z";
const FAILED_AT = "2026-12-24T01:05:00.000Z";

const successRow = (overrides: Record<string, unknown> = {}) => ({
  outcome: "FAILED_RETRYABLE",
  attempt_id: VALID_INPUT.attemptId,
  slug: VALID_INPUT.slug,
  state: "FAILED_RETRYABLE",
  attempt_version: 5,
  retry_count: 2,
  commit_count: 1,
  failure_code: VALID_INPUT.failureCode,
  failed_at: FAILED_AT,
  expires_at: EXPIRES_AT,
  ...overrides,
});

const negativeRow = (outcome: string, overrides: Record<string, unknown> = {}) => ({
  outcome,
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  retry_count: null,
  commit_count: null,
  failure_code: null,
  failed_at: null,
  expires_at: null,
  ...overrides,
});

function callerReturning(
  data: unknown,
  error: unknown = null,
  calls: unknown[] = [],
): FailRpcCaller {
  return async (rpcName, args) => {
    calls.push({ rpcName, args });
    return { data, error };
  };
}

async function invokeWithData(
  data: unknown,
  input: unknown = VALID_INPUT,
  error: unknown = null,
) {
  const calls: unknown[] = [];
  const result = await failEduPublishCommitViaRpc(input, {
    callRpcFn: callerReturning(data, error, calls),
  });
  return { result, calls };
}

test("valid binding uses the exact RPC name, seven arguments, and one call", async () => {
  const input = structuredClone(VALID_INPUT);
  const before = structuredClone(input);
  const calls: Array<{ rpcName: string; args: Record<string, unknown> }> = [];
  const result = await failEduPublishCommitViaRpc(input, {
    callRpcFn: async (rpcName, args) => {
      calls.push({ rpcName, args });
      return { data: [successRow()], error: null };
    },
  });

  assert.deepEqual(result, {
    mode: "failed_retryable",
    outcome: "FAILED_RETRYABLE",
    attemptId: VALID_INPUT.attemptId,
    slug: VALID_INPUT.slug,
    state: "FAILED_RETRYABLE",
    attemptVersion: 5,
    retryCount: 2,
    commitCount: 1,
    failureCode: "R2_TEMPORARY_FAILURE",
    failedAt: FAILED_AT,
    expiresAt: EXPIRES_AT,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].rpcName, EDU_PUBLISH_FAIL_COMMIT_RPC);
  assert.deepEqual(Object.keys(calls[0].args).sort(), [
    "p_attempt_id",
    "p_slug",
    "p_manifest_schema_version",
    "p_declared_manifest_digest",
    "p_lease_owner",
    "p_expected_attempt_version",
    "p_failure_code",
  ].sort());
  assert.deepEqual(calls[0].args, {
    p_attempt_id: VALID_INPUT.attemptId,
    p_slug: VALID_INPUT.slug,
    p_manifest_schema_version: 1,
    p_declared_manifest_digest: VALID_INPUT.declaredManifestDigest,
    p_lease_owner: VALID_INPUT.leaseOwner,
    p_expected_attempt_version: 4,
    p_failure_code: "R2_TEMPORARY_FAILURE",
  });
  assert.deepEqual(input, before);
});

test("invalid input returns INVALID_INPUT without an RPC call", async () => {
  const invalidInputs: Array<[string, unknown]> = [
    ["null", null],
    ["array", []],
    ["invalid attempt UUID", { ...VALID_INPUT, attemptId: "not-a-uuid" }],
    ["invalid slug", { ...VALID_INPUT, slug: "not valid" }],
    ["schema 2", { ...VALID_INPUT, manifestSchemaVersion: 2 }],
    ["uppercase digest", { ...VALID_INPUT, declaredManifestDigest: "A".repeat(64) }],
    ["invalid lease UUID", { ...VALID_INPUT, leaseOwner: "not-a-uuid" }],
    ["fractional version", { ...VALID_INPUT, expectedAttemptVersion: 4.5 }],
    ["request-only failure", { ...VALID_INPUT, failureCode: "CAPABILITY_INVALID" }],
    ["expired failure", { ...VALID_INPUT, failureCode: "ATTEMPT_EXPIRED" }],
    ["extra field", { ...VALID_INPUT, privateSentinel: "private-input-sentinel" }],
  ];

  for (const [label, input] of invalidInputs) {
    const calls: unknown[] = [];
    const result = await failEduPublishCommitViaRpc(input, {
      callRpcFn: async () => {
        calls.push(label);
        return { data: [successRow()], error: null };
      },
    });
    assert.deepEqual(result, { mode: "outcome", outcome: "INVALID_INPUT" }, label);
    assert.equal(calls.length, 0, label);
  }
});

test("retryable and restart-required failures normalize their exact success shapes", async () => {
  for (const [failureCode, outcome, state, mode] of [
    ["R2_TEMPORARY_FAILURE", "FAILED_RETRYABLE", "FAILED_RETRYABLE", "failed_retryable"],
    ["DB_TEMPORARY_FAILURE", "FAILED_RETRYABLE", "FAILED_RETRYABLE", "failed_retryable"],
    ["RPC_TEMPORARY_FAILURE", "FAILED_RETRYABLE", "FAILED_RETRYABLE", "failed_retryable"],
    ["INTERNAL_EVALUATION_FAILED", "FAILED_RETRYABLE", "FAILED_RETRYABLE", "failed_retryable"],
    ["R2_OBJECT_MISSING", "FAILED_RESTART_REQUIRED", "FAILED_RESTART_REQUIRED", "failed_restart_required"],
    ["R2_SIZE_MISMATCH", "FAILED_RESTART_REQUIRED", "FAILED_RESTART_REQUIRED", "failed_restart_required"],
    ["R2_DIGEST_MISMATCH", "FAILED_RESTART_REQUIRED", "FAILED_RESTART_REQUIRED", "failed_restart_required"],
    ["SLUG_CONFLICT", "FAILED_RESTART_REQUIRED", "FAILED_RESTART_REQUIRED", "failed_restart_required"],
  ] as const) {
    const input = { ...VALID_INPUT, failureCode };
    const row = successRow({ outcome, state, failure_code: failureCode });
    const { result } = await invokeWithData([row], input);
    assert.deepEqual(result, {
      mode,
      outcome,
      attemptId: VALID_INPUT.attemptId,
      slug: VALID_INPUT.slug,
      state,
      attemptVersion: 5,
      retryCount: 2,
      commitCount: 1,
      failureCode,
      failedAt: FAILED_AT,
      expiresAt: EXPIRES_AT,
    });
  }
});

test("negative outcomes preserve only their public outcome", async () => {
  for (const outcome of [
    "LEASE_EXPIRED",
    "LEASE_MISMATCH",
    "VERSION_MISMATCH",
    "BINDING_MISMATCH",
    "STATE_CONFLICT",
    "INVALID_INPUT",
  ] as const) {
    const { result } = await invokeWithData([negativeRow(outcome)]);
    assert.deepEqual(result, { mode: "outcome", outcome });
    assert.deepEqual(Object.keys(result), ["mode", "outcome"]);
  }
});

test("RPC throws and non-null Supabase errors become secret-free rpc_error", async () => {
  const thrown = await failEduPublishCommitViaRpc(VALID_INPUT, {
    callRpcFn: async () => {
      throw new Error("private-db-error-sentinel");
    },
  });
  const returned = await failEduPublishCommitViaRpc(VALID_INPUT, {
    callRpcFn: async () => ({
      data: [successRow()],
      error: {
        message: "private-db-error-sentinel",
        code: "P0001",
        details: "private-db-details-sentinel",
        hint: "private-stored-project-sentinel",
      },
    }),
  });

  for (const invalid of [null, undefined, 1, "rpc-result"]) {
    const result = await failEduPublishCommitViaRpc(VALID_INPUT, {
      callRpcFn: async () => invalid as never,
    });
    assert.deepEqual(result, { mode: "rpc_error" });
  }

  assert.deepEqual(thrown, { mode: "rpc_error" });
  assert.deepEqual(returned, { mode: "rpc_error" });
  assert.doesNotMatch(JSON.stringify(thrown), /private-/);
  assert.doesNotMatch(JSON.stringify(returned), /private-/);
});

test("RPC data must be exactly one row and each row must have exactly ten keys", async () => {
  for (const [label, data] of [
    ["null", null],
    ["undefined", undefined],
    ["object", successRow()],
    ["empty array", []],
    ["two rows", [successRow(), successRow()]],
  ] as const) {
    const { result } = await invokeWithData(data);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
  }

  const missingKey = successRow();
  delete missingKey.expires_at;
  const extraKey = {
    ...successRow(),
    privateStoredAttempt: "private-stored-attempt-sentinel",
  };
  const symbolKey = successRow();
  Object.defineProperty(symbolKey, Symbol("private"), { value: true });
  class RpcRowClass {
    outcome = "FAILED_RETRYABLE";
    attempt_id = VALID_INPUT.attemptId;
    slug = VALID_INPUT.slug;
    state = "FAILED_RETRYABLE";
    attempt_version = 5;
    retry_count = 2;
    commit_count = 1;
    failure_code = VALID_INPUT.failureCode;
    failed_at = FAILED_AT;
    expires_at = EXPIRES_AT;
  }

  for (const [label, row] of [
    ["missing key", missingKey],
    ["extra key", extraKey],
    ["symbol key", symbolKey],
    ["class instance", new RpcRowClass()],
    ["Date row", new Date()],
  ] as const) {
    const { result } = await invokeWithData([row]);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
  }
});

test("binding, failure code, state, counters, and timestamptz are checked", async () => {
  const malformedRows = [
    ["attempt ID mismatch", successRow({ attempt_id: "00000000-0000-4000-8000-000000000003" })],
    ["uppercase attempt UUID", successRow({ attempt_id: "00000000-0000-4000-8000-00000000000A" })],
    ["slug mismatch", successRow({ slug: "abc123-123456-p2" })],
    ["state mismatch", successRow({ state: "VALIDATING" })],
    ["negative attempt version", successRow({ attempt_version: -1 })],
    ["fractional retry count", successRow({ retry_count: 1.5 })],
    ["null commit count", successRow({ commit_count: null })],
    ["failure code mismatch", successRow({ failure_code: "DB_TEMPORARY_FAILURE" })],
    ["invalid failed timestamp", successRow({ failed_at: "not-a-timestamptz" })],
    ["timezone-less failed timestamp", successRow({ failed_at: "2026-12-24T01:05:00.000" })],
    ["infinity failed timestamp", successRow({ failed_at: "infinity" })],
    ["invalid expires timestamp", successRow({ expires_at: "not-a-timestamptz" })],
    ["failed after expiry", successRow({ failed_at: "2026-12-24T02:00:00.000Z" })],
  ] as const;

  for (const [label, row] of malformedRows) {
    const { result } = await invokeWithData([row]);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
  }
});

test("PostgreSQL timezone offsets and fractional seconds are accepted", async () => {
  const { result } = await invokeWithData([
    successRow({
      failed_at: "2026-12-24T03:05:00.123456+02:00",
      expires_at: "2026-12-24T03:45:00.654321+02:00",
    }),
  ]);

  assert.deepEqual(result, {
    mode: "failed_retryable",
    outcome: "FAILED_RETRYABLE",
    attemptId: VALID_INPUT.attemptId,
    slug: VALID_INPUT.slug,
    state: "FAILED_RETRYABLE",
    attemptVersion: 5,
    retryCount: 2,
    commitCount: 1,
    failureCode: "R2_TEMPORARY_FAILURE",
    failedAt: "2026-12-24T03:05:00.123456+02:00",
    expiresAt: "2026-12-24T03:45:00.654321+02:00",
  });
});

test("malformed negative rows never expose stored identity, state, or failure data", async () => {
  const malformedRows = [
    ["attempt ID", negativeRow("STATE_CONFLICT", { attempt_id: VALID_INPUT.attemptId })],
    ["slug", negativeRow("BINDING_MISMATCH", { slug: "private-stored-slug-sentinel" })],
    ["state", negativeRow("LEASE_EXPIRED", { state: "VALIDATING" })],
    ["failure code", negativeRow("VERSION_MISMATCH", { failure_code: "private-failure-sentinel" })],
    ["failed at", negativeRow("INVALID_INPUT", { failed_at: FAILED_AT })],
  ] as const;

  for (const [label, row] of malformedRows) {
    const { result } = await invokeWithData([row]);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
    assert.doesNotMatch(JSON.stringify(result), /private-/);
  }
});

test("response proxies and unknown outcomes fail closed without leaking values", async () => {
  const getterRow = new Proxy(successRow(), {
    get(_target, property) {
      if (property === "failure_code") throw new Error("private-failure-sentinel");
      return Reflect.get(_target, property);
    },
  });
  const ownKeysRow = new Proxy(successRow(), {
    ownKeys() {
      throw new Error("private-stored-attempt-sentinel");
    },
  });
  const dataProxy = new Proxy([successRow()], {
    get(target, property, receiver) {
      if (property === "length") throw new Error("private-digest-sentinel");
      return Reflect.get(target, property, receiver);
    },
  });

  for (const data of [
    [getterRow],
    [ownKeysRow],
    dataProxy,
    [successRow({ outcome: "UNKNOWN" })],
  ]) {
    const { result } = await invokeWithData(data);
    assert.deepEqual(result, { mode: "invalid_response" });
    assert.doesNotMatch(JSON.stringify(result), /private-/);
  }
});

test("null-prototype rows are accepted and input/response objects are not mutated", async () => {
  const input = structuredClone(VALID_INPUT);
  const beforeInput = structuredClone(input);
  const row = Object.assign(Object.create(null), successRow());
  const beforeRow = Object.assign(Object.create(null), row);
  const { result } = await invokeWithData([row], input);

  assert.equal(result.mode, "failed_retryable");
  assert.deepEqual(input, beforeInput);
  assert.deepEqual(row, beforeRow);
});

test("source stays server-only and outside forbidden integration boundaries", () => {
  const source = readFileSync("lib/server/edu/publish/failCommitRpc.ts", "utf8");
  assert.equal(source.split("\n", 1)[0], 'import "server-only";');
  assert.doesNotMatch(
    source,
    /NextRequest|NextResponse|Response|handleEduPublishCommit|coordinateEduPublishCommit|verifyEduPublishCommitCapability|commitCapabilityPolicy|headObject|listObjectKeysV2|recordOpsEvent|Date\.now|Math\.random|randomUUID|node:crypto|process\.env|edu_publish_attempts|edu_publish_slug_reservations|edu_projects|complete_edu_publish_commit_v1/,
  );
  assert.equal((source.match(/fail_edu_publish_commit_v1/g) ?? []).length, 1);
});

test("successful results never include lease owner, digest, or private database values", async () => {
  const result = await failEduPublishCommitViaRpc(
    {
      ...VALID_INPUT,
      privateLeaseOwner: "private-lease-owner-sentinel",
      privateDigest: "private-digest-sentinel",
    },
    {
      callRpcFn: async () => ({
        data: [
          successRow({
            privateStoredAttempt: "private-stored-attempt-sentinel",
          }),
        ],
        error: null,
      }),
    },
  );

  assert.doesNotMatch(JSON.stringify(result), /private-/);
  assert.doesNotMatch(JSON.stringify(result), /leaseOwner|declaredManifestDigest/);
});
