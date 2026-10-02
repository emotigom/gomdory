import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  EDU_PUBLISH_BEGIN_COMMIT_RPC,
  beginEduPublishCommitViaRpc,
  type BeginRpcCaller,
} from "@/lib/server/edu/publish/beginCommitRpc";

const VALID_INPUT = {
  attemptId: "00000000-0000-4000-8000-000000000001",
  slug: "abc123-123456-p1",
  manifestSchemaVersion: 1,
  declaredManifestDigest: "a".repeat(64),
  leaseOwner: "00000000-0000-4000-8000-000000000002",
};

const PROJECT_ID = "00000000-0000-4000-8000-000000000003";
const LEASE_EXPIRES_AT = "2026-12-24T01:05:00.000Z";
const EXPIRES_AT = "2026-12-24T01:45:00.000Z";
const EXPIRED_AT = "2020-01-01T00:00:00.000Z";

const claimRow = (overrides: Record<string, unknown> = {}) => ({
  outcome: "CLAIMED",
  attempt_id: VALID_INPUT.attemptId,
  slug: VALID_INPUT.slug,
  state: "VALIDATING",
  attempt_version: 4,
  retry_count: 2,
  commit_count: 1,
  lease_expires_at: LEASE_EXPIRES_AT,
  expires_at: EXPIRES_AT,
  project_id: null,
  ...overrides,
});

const publishedRow = (overrides: Record<string, unknown> = {}) => ({
  outcome: "ALREADY_PUBLISHED",
  attempt_id: VALID_INPUT.attemptId,
  slug: VALID_INPUT.slug,
  state: "PUBLISHED",
  attempt_version: 8,
  retry_count: 3,
  commit_count: 2,
  lease_expires_at: null,
  expires_at: EXPIRED_AT,
  project_id: PROJECT_ID,
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
  lease_expires_at: null,
  expires_at: null,
  project_id: null,
  ...overrides,
});

function callerReturning(
  data: unknown,
  error: unknown = null,
  calls: unknown[] = [],
): BeginRpcCaller {
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
  const result = await beginEduPublishCommitViaRpc(input, {
    callRpcFn: callerReturning(data, error, calls),
  });
  return { result, calls };
}

test("valid binding uses the exact RPC name, five arguments, and one call", async () => {
  const input = structuredClone(VALID_INPUT);
  const before = structuredClone(input);
  const calls: Array<{ rpcName: string; args: Record<string, unknown> }> = [];
  const result = await beginEduPublishCommitViaRpc(input, {
    callRpcFn: async (rpcName, args) => {
      calls.push({ rpcName, args });
      return { data: [claimRow()], error: null };
    },
  });

  assert.deepEqual(result, {
    mode: "claimed",
    outcome: "CLAIMED",
    attemptId: VALID_INPUT.attemptId,
    slug: VALID_INPUT.slug,
    state: "VALIDATING",
    attemptVersion: 4,
    retryCount: 2,
    commitCount: 1,
    leaseExpiresAt: LEASE_EXPIRES_AT,
    expiresAt: EXPIRES_AT,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].rpcName, EDU_PUBLISH_BEGIN_COMMIT_RPC);
  assert.deepEqual(Object.keys(calls[0].args).sort(), [
    "p_attempt_id",
    "p_slug",
    "p_manifest_schema_version",
    "p_declared_manifest_digest",
    "p_lease_owner",
  ].sort());
  assert.deepEqual(calls[0].args, {
    p_attempt_id: VALID_INPUT.attemptId,
    p_slug: VALID_INPUT.slug,
    p_manifest_schema_version: 1,
    p_declared_manifest_digest: VALID_INPUT.declaredManifestDigest,
    p_lease_owner: VALID_INPUT.leaseOwner,
  });
  assert.deepEqual(input, before);
});

test("invalid input returns INVALID_INPUT without an RPC call", async () => {
  const invalidInputs: Array<[string, unknown]> = [
    ["null", null],
    ["array", []],
    ["invalid attempt UUID", { ...VALID_INPUT, attemptId: "not-a-uuid" }],
    [
      "uppercase attempt UUID",
      { ...VALID_INPUT, attemptId: "00000000-0000-4000-8000-00000000000A" },
    ],
    ["invalid slug", { ...VALID_INPUT, slug: "not valid" }],
    ["schema 2", { ...VALID_INPUT, manifestSchemaVersion: 2 }],
    ["uppercase digest", { ...VALID_INPUT, declaredManifestDigest: "A".repeat(64) }],
    ["invalid lease UUID", { ...VALID_INPUT, leaseOwner: "not-a-uuid" }],
    [
      "uppercase lease UUID",
      { ...VALID_INPUT, leaseOwner: "00000000-0000-4000-8000-00000000000A" },
    ],
  ];

  for (const [label, input] of invalidInputs) {
    const calls: unknown[] = [];
    const result = await beginEduPublishCommitViaRpc(input, {
      callRpcFn: async () => {
        calls.push(label);
        return { data: [claimRow()], error: null };
      },
    });
    assert.deepEqual(result, { mode: "outcome", outcome: "INVALID_INPUT" }, label);
    assert.equal(calls.length, 0, label);
  }
});

test("all claim outcomes normalize the claimed tuple and do not expose project identity", async () => {
  for (const outcome of [
    "CLAIMED",
    "RECLAIMED_RETRYABLE",
    "TAKEN_OVER_STALE_LEASE",
  ] as const) {
    const { result } = await invokeWithData([
      claimRow({ outcome, attempt_version: 7, retry_count: 3, commit_count: 5 }),
    ]);
    assert.deepEqual(result, {
      mode: "claimed",
      outcome,
      attemptId: VALID_INPUT.attemptId,
      slug: VALID_INPUT.slug,
      state: "VALIDATING",
      attemptVersion: 7,
      retryCount: 3,
      commitCount: 5,
      leaseExpiresAt: LEASE_EXPIRES_AT,
      expiresAt: EXPIRES_AT,
    });
    assert.equal("projectId" in result, false);
  }
});

test("PUBLISHED replay preserves own identity and accepts an expired attempt", async () => {
  const { result } = await invokeWithData([publishedRow()]);

  assert.deepEqual(result, {
    mode: "published",
    outcome: "ALREADY_PUBLISHED",
    attemptId: VALID_INPUT.attemptId,
    slug: VALID_INPUT.slug,
    state: "PUBLISHED",
    attemptVersion: 8,
    retryCount: 3,
    commitCount: 2,
    expiresAt: EXPIRED_AT,
    projectId: PROJECT_ID,
  });
  assert.equal("leaseExpiresAt" in result, false);

  const source = readFileSync("lib/server/edu/publish/beginCommitRpc.ts", "utf8");
  assert.doesNotMatch(source, /Date\.now/);
});

test("negative outcomes normalize only with a fully private null shape", async () => {
  for (const outcome of [
    "LEASE_ACTIVE",
    "ATTEMPT_EXPIRED",
    "BINDING_MISMATCH",
    "STATE_CONFLICT",
    "RETRY_EXHAUSTED",
    "INVALID_INPUT",
  ] as const) {
    const { result } = await invokeWithData([negativeRow(outcome)]);
    assert.deepEqual(result, { mode: "outcome", outcome });
    assert.deepEqual(Object.keys(result), ["mode", "outcome"]);
  }
});

test("RPC throws, Supabase errors, and invalid call results are secret-free rpc_error", async () => {
  const thrown = await beginEduPublishCommitViaRpc(VALID_INPUT, {
    callRpcFn: async () => {
      throw new Error("private-db-error-sentinel");
    },
  });
  const returned = await beginEduPublishCommitViaRpc(VALID_INPUT, {
    callRpcFn: async () => ({
      data: [claimRow()],
      error: {
        message: "private-db-error-sentinel",
        code: "P0001",
        details: "private-db-details-sentinel",
        hint: "private-stored-project-sentinel",
      },
    }),
  });

  for (const invalid of [null, undefined, 1, "rpc-result"]) {
    const result = await beginEduPublishCommitViaRpc(VALID_INPUT, {
      callRpcFn: async () => invalid as never,
    });
    assert.deepEqual(result, { mode: "rpc_error" });
  }

  assert.deepEqual(thrown, { mode: "rpc_error" });
  assert.deepEqual(returned, { mode: "rpc_error" });
  assert.doesNotMatch(JSON.stringify(thrown), /private-/);
  assert.doesNotMatch(JSON.stringify(returned), /private-/);
});

test("RPC data must be exactly one row", async () => {
  for (const [label, data] of [
    ["null", null],
    ["undefined", undefined],
    ["object", claimRow()],
    ["empty array", []],
    ["two rows", [claimRow(), claimRow()]],
  ] as const) {
    const { result } = await invokeWithData(data);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
  }
});

test("rows must be plain objects with exactly the ten RPC keys", async () => {
  const missingOutcome = claimRow();
  delete missingOutcome.outcome;
  const missingProject = claimRow();
  delete missingProject.project_id;
  const extraField = {
    ...claimRow(),
    private_stored_attempt_sentinel: "private-stored-attempt-sentinel",
  };
  const symbolKey = claimRow();
  Object.defineProperty(symbolKey, Symbol("private"), { value: true });
  class RpcRowClass {
    outcome = "CLAIMED";
    attempt_id = VALID_INPUT.attemptId;
    slug = VALID_INPUT.slug;
    state = "VALIDATING";
    attempt_version = 4;
    retry_count = 2;
    commit_count = 1;
    lease_expires_at = LEASE_EXPIRES_AT;
    expires_at = EXPIRES_AT;
    project_id = null;
  }

  for (const [label, row] of [
    ["missing outcome", missingOutcome],
    ["missing project_id", missingProject],
    ["extra private field", extraField],
    ["symbol key", symbolKey],
    ["class instance", new RpcRowClass()],
    ["Date row", new Date()],
  ] as const) {
    const { result } = await invokeWithData([row]);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
  }
});

test("malformed claim rows fail closed", async () => {
  const malformedRows = [
    ["attempt ID mismatch", claimRow({ attempt_id: "00000000-0000-4000-8000-000000000004" })],
    [
      "uppercase attempt UUID",
      claimRow({ attempt_id: "00000000-0000-4000-8000-00000000000A" }),
    ],
    ["slug mismatch", claimRow({ slug: "abc123-123456-p2" })],
    ["state PREPARED", claimRow({ state: "PREPARED" })],
    ["negative attempt version", claimRow({ attempt_version: -1 })],
    ["fractional retry count", claimRow({ retry_count: 1.5 })],
    ["null commit count", claimRow({ commit_count: null })],
    ["invalid lease timestamp", claimRow({ lease_expires_at: "not-a-timestamptz" })],
    ["fractional-second lease timestamp", claimRow({ lease_expires_at: "2026-12-24T01:05:00.500Z" })],
    ["invalid expires timestamp", claimRow({ expires_at: "not-a-timestamptz" })],
    ["lease expiry after attempt expiry", claimRow({ lease_expires_at: "2026-12-24T02:00:00.000Z" })],
    ["project_id string", claimRow({ project_id: "private-stored-project-sentinel" })],
  ] as const;

  for (const [label, row] of malformedRows) {
    const { result } = await invokeWithData([row]);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
  }
});

test("malformed PUBLISHED rows fail closed", async () => {
  const malformedRows = [
    ["attempt ID mismatch", publishedRow({ attempt_id: "00000000-0000-4000-8000-000000000004" })],
    ["slug mismatch", publishedRow({ slug: "abc123-123456-p2" })],
    ["state VALIDATING", publishedRow({ state: "VALIDATING" })],
    ["lease expiry string", publishedRow({ lease_expires_at: LEASE_EXPIRES_AT })],
    ["project null", publishedRow({ project_id: null })],
    ["project malformed UUID", publishedRow({ project_id: "not-a-uuid" })],
    [
      "project uppercase UUID",
      publishedRow({ project_id: "00000000-0000-4000-8000-00000000000A" }),
    ],
    ["invalid expires timestamp", publishedRow({ expires_at: "not-a-timestamptz" })],
    ["negative counter", publishedRow({ commit_count: -1 })],
  ] as const;

  for (const [label, row] of malformedRows) {
    const { result } = await invokeWithData([row]);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
  }
});

test("malformed negative rows never expose stored identity or state", async () => {
  const malformedRows = [
    ["LEASE_ACTIVE lease", negativeRow("LEASE_ACTIVE", { lease_expires_at: LEASE_EXPIRES_AT })],
    ["ATTEMPT_EXPIRED state", negativeRow("ATTEMPT_EXPIRED", { state: "ABANDONED" })],
    ["BINDING_MISMATCH attempt", negativeRow("BINDING_MISMATCH", { attempt_id: VALID_INPUT.attemptId })],
    ["STATE_CONFLICT slug", negativeRow("STATE_CONFLICT", { slug: "private-stored-slug-sentinel" })],
    ["RETRY_EXHAUSTED retry", negativeRow("RETRY_EXHAUSTED", { retry_count: 3 })],
    ["INVALID_INPUT project", negativeRow("INVALID_INPUT", { project_id: PROJECT_ID })],
  ] as const;

  for (const [label, row] of malformedRows) {
    const { result } = await invokeWithData([row]);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
    assert.doesNotMatch(JSON.stringify(result), /private-/);
  }
});

test("unknown and non-string outcomes fail closed", async () => {
  for (const outcome of [
    "UNKNOWN",
    "ERROR",
    "FAILED",
    "RETRY",
    "already_published",
    null,
    1,
  ] as const) {
    const { result } = await invokeWithData([claimRow({ outcome })]);
    assert.deepEqual(result, { mode: "invalid_response" }, String(outcome));
  }
});

test("response getter, ownKeys, and data proxy failures are invalid_response", async () => {
  const getterRow = new Proxy(claimRow(), {
    get(_target, property) {
      if (property === "outcome") throw new Error("private-stored-attempt-sentinel");
      return Reflect.get(_target, property);
    },
  });
  const ownKeysRow = new Proxy(claimRow(), {
    ownKeys() {
      throw new Error("private-stored-project-sentinel");
    },
  });
  const dataProxy = new Proxy([claimRow()], {
    get(target, property, receiver) {
      if (property === "length") throw new Error("private-digest-sentinel");
      return Reflect.get(target, property, receiver);
    },
  });

  for (const data of [[getterRow], [ownKeysRow], dataProxy]) {
    const { result } = await invokeWithData(data);
    assert.deepEqual(result, { mode: "invalid_response" });
    assert.doesNotMatch(JSON.stringify(result), /private-/);
  }
});

test("same input and same response are deterministic", async () => {
  const first = await invokeWithData([publishedRow({ attempt_version: 9 })]);
  const second = await invokeWithData([publishedRow({ attempt_version: 9 })]);
  assert.deepEqual(first.result, second.result);
});

test("source stays server-only and outside the forbidden integration boundaries", () => {
  const source = readFileSync("lib/server/edu/publish/beginCommitRpc.ts", "utf8");
  assert.equal(source.split("\n", 1)[0], 'import "server-only";');
  assert.doesNotMatch(
    source,
    /NextRequest|NextResponse|Response|handleEduPublishCommit|verifyEduPublishCommitCapability|commitCapabilityPolicy|headObject|listObjectKeysV2|recordOpsEvent|Date\.now|Math\.random|randomUUID|node:crypto|process\.env|edu_publish_attempts|edu_publish_slug_reservations|edu_projects/,
  );
  assert.equal((source.match(/begin_edu_publish_commit_v1/g) ?? []).length, 1);
});

test("successful results never include lease owner, digest, or private database values", async () => {
  const result = await beginEduPublishCommitViaRpc(
    {
      ...VALID_INPUT,
      privateLeaseOwner: "private-lease-owner-sentinel",
      privateDigest: "private-digest-sentinel",
    },
    {
      callRpcFn: async () => ({
        data: [
          claimRow({
            lease_expires_at: LEASE_EXPIRES_AT,
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
