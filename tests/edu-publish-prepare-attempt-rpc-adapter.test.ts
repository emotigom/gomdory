import assert from "node:assert/strict";
import test from "node:test";

import {
  EDU_PUBLISH_PREPARE_ATTEMPT_RPC,
  prepareEduPublishAttemptViaRpc,
  type PrepareRpcCaller,
} from "@/lib/server/edu/publish/prepareAttemptRpc";

const ATTEMPT_ID = "00000000-0000-4000-8000-000000000001";
const SLUG = "abc123-123456-p1";
const ISSUED_AT_SECONDS = 1_798_074_000;
const EXPIRES_AT_SECONDS = 1_798_076_700;
const ISSUED_AT_ISO = "2026-12-24T01:00:00.000Z";
const EXPIRES_AT_ISO = "2026-12-24T01:45:00.000Z";
const MANIFEST = {
  schemaVersion: 1,
  entryPoint: "index.html",
  files: [],
};

const validBinding = {
  attemptId: ATTEMPT_ID,
  slug: SLUG,
  lessonId: 1,
  manifestSchemaVersion: 1,
  declaredManifestDigest: "0".repeat(64),
  declaredManifestCanonicalJson: JSON.stringify(MANIFEST),
  capabilityIssuedAtSeconds: ISSUED_AT_SECONDS,
  capabilityExpiresAtSeconds: EXPIRES_AT_SECONDS,
  capabilityKid: "current-v1",
};

const successRow = (overrides: Record<string, unknown> = {}) => ({
  outcome: "CREATED",
  attempt_id: ATTEMPT_ID,
  slug: SLUG,
  state: "PREPARED",
  attempt_version: 0,
  expires_at: EXPIRES_AT_ISO,
  ...overrides,
});

const conflictRow = (outcome: string, overrides: Record<string, unknown> = {}) => ({
  outcome,
  attempt_id: null,
  slug: null,
  state: null,
  attempt_version: null,
  expires_at: null,
  ...overrides,
});

function callerReturning(data: unknown, error: unknown = null, calls: unknown[] = []): PrepareRpcCaller {
  return async (rpcName, args) => {
    calls.push({ rpcName, args });
    return { data, error };
  };
}

async function invokeWithData(
  data: unknown,
  input: unknown = validBinding,
  error: unknown = null,
) {
  const calls: unknown[] = [];
  const result = await prepareEduPublishAttemptViaRpc(input, {
    callRpcFn: callerReturning(data, error, calls),
  });
  return { result, calls };
}

test("valid binding uses the exact RPC name, nine arguments, and one call", async () => {
  const input = structuredClone(validBinding);
  const before = structuredClone(input);
  const calls: Array<{ rpcName: string; args: Record<string, unknown> }> = [];
  const result = await prepareEduPublishAttemptViaRpc(input, {
    callRpcFn: async (rpcName, args) => {
      calls.push({ rpcName, args });
      return { data: [successRow()], error: null };
    },
  });

  assert.deepEqual(result, {
    mode: "success",
    outcome: "CREATED",
    attemptId: ATTEMPT_ID,
    slug: SLUG,
    state: "PREPARED",
    attemptVersion: 0,
    expiresAt: EXPIRES_AT_ISO,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].rpcName, EDU_PUBLISH_PREPARE_ATTEMPT_RPC);
  assert.deepEqual(Object.keys(calls[0].args).sort(), [
    "p_attempt_id",
    "p_slug",
    "p_lesson_id",
    "p_manifest_schema_version",
    "p_declared_manifest_digest",
    "p_declared_manifest",
    "p_capability_issued_at",
    "p_capability_expires_at",
    "p_capability_kid",
  ].sort());
  assert.deepEqual(calls[0].args, {
    p_attempt_id: ATTEMPT_ID,
    p_slug: SLUG,
    p_lesson_id: 1,
    p_manifest_schema_version: 1,
    p_declared_manifest_digest: "0".repeat(64),
    p_declared_manifest: MANIFEST,
    p_capability_issued_at: ISSUED_AT_ISO,
    p_capability_expires_at: EXPIRES_AT_ISO,
    p_capability_kid: "current-v1",
  });
  assert.deepEqual(input, before);
});

test("epoch fixture values convert to the expected whole-second ISO timestamps", async () => {
  const calls: Array<{ args: Record<string, unknown> }> = [];
  await prepareEduPublishAttemptViaRpc(validBinding, {
    callRpcFn: async (_rpcName, args) => {
      calls.push({ args });
      return { data: [successRow()], error: null };
    },
  });

  assert.equal(calls[0].args.p_capability_issued_at, ISSUED_AT_ISO);
  assert.equal(calls[0].args.p_capability_expires_at, EXPIRES_AT_ISO);
  assert.match(calls[0].args.p_capability_issued_at as string, /\.000Z$/);
  assert.match(calls[0].args.p_capability_expires_at as string, /\.000Z$/);
});

test("invalid input returns INVALID_INPUT without an RPC call", async () => {
  const invalidInputs: Array<[string, unknown]> = [
    ["null", null],
    ["lesson 0", { ...validBinding, lessonId: 0 }],
    ["invalid UUID", { ...validBinding, attemptId: "not-a-uuid" }],
    ["invalid manifest JSON", { ...validBinding, declaredManifestCanonicalJson: "{" }],
    ["TTL mismatch", { ...validBinding, capabilityExpiresAtSeconds: EXPIRES_AT_SECONDS + 1 }],
    [
      "Date range overflow",
      {
        ...validBinding,
        capabilityIssuedAtSeconds: Number.MAX_SAFE_INTEGER - 2_700,
        capabilityExpiresAtSeconds: Number.MAX_SAFE_INTEGER,
      },
    ],
  ];

  for (const [label, input] of invalidInputs) {
    const calls: unknown[] = [];
    const result = await prepareEduPublishAttemptViaRpc(input, {
      callRpcFn: async () => {
        calls.push(label);
        return { data: [successRow()], error: null };
      },
    });
    assert.deepEqual(result, { mode: "outcome", outcome: "INVALID_INPUT" }, label);
    assert.equal(calls.length, 0, label);
  }
});

test("CREATED and ALREADY_PREPARED normalize to the public success tuple", async () => {
  for (const outcome of ["CREATED", "ALREADY_PREPARED"] as const) {
    const { result } = await invokeWithData([successRow({ outcome, attempt_version: 3 })]);
    assert.deepEqual(result, {
      mode: "success",
      outcome,
      attemptId: ATTEMPT_ID,
      slug: SLUG,
      state: "PREPARED",
      attemptVersion: 3,
      expiresAt: EXPIRES_AT_ISO,
    });
  }
});

test("timezone-equivalent whole-second expiry is accepted", async () => {
  const { result } = await invokeWithData([
    successRow({ expires_at: "2026-12-24T03:45:00+02:00" }),
  ]);

  assert.deepEqual(result, {
    mode: "success",
    outcome: "CREATED",
    attemptId: ATTEMPT_ID,
    slug: SLUG,
    state: "PREPARED",
    attemptVersion: 0,
    expiresAt: "2026-12-24T03:45:00+02:00",
  });
});

test("typed conflict outcomes normalize only when every identity field is null", async () => {
  for (const outcome of [
    "SLUG_CONFLICT",
    "ATTEMPT_ID_CONFLICT",
    "STATE_CONFLICT",
    "INVALID_INPUT",
  ] as const) {
    const { result } = await invokeWithData([conflictRow(outcome)]);
    assert.deepEqual(result, { mode: "outcome", outcome });
  }
});

test("RPC throws and non-null Supabase errors become secret-free rpc_error", async () => {
  const thrown = await prepareEduPublishAttemptViaRpc(validBinding, {
    callRpcFn: async () => {
      throw new Error("private-db-error-sentinel");
    },
  });
  const returned = await prepareEduPublishAttemptViaRpc(validBinding, {
    callRpcFn: async () => ({
      data: [successRow()],
      error: {
        message: "private-db-error-sentinel",
        code: "private-sqlstate-sentinel",
        details: "private-owner-project-sentinel",
        hint: "private-owner-attempt-sentinel",
      },
    }),
  });

  assert.deepEqual(thrown, { mode: "rpc_error" });
  assert.deepEqual(returned, { mode: "rpc_error" });
  assert.doesNotMatch(JSON.stringify(thrown), /private-/);
  assert.doesNotMatch(JSON.stringify(returned), /private-/);
});

test("RPC data must be exactly one row", async () => {
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
});

test("malformed success rows are rejected", async () => {
  const malformedRows = [
    ["attempt ID mismatch", successRow({ attempt_id: "00000000-0000-4000-8000-000000000002" })],
    ["slug mismatch", successRow({ slug: "abc123-123456-p2" })],
    ["state mismatch", successRow({ state: "VALIDATING" })],
    ["negative version", successRow({ attempt_version: -1 })],
    ["fractional version", successRow({ attempt_version: 0.5 })],
    ["expiry mismatch", successRow({ expires_at: "2026-12-24T01:45:01.000Z" })],
    ["invalid expiry", successRow({ expires_at: "not-a-timestamptz" })],
    ["null identity", successRow({ attempt_id: null })],
  ] as const;

  for (const [label, row] of malformedRows) {
    const { result } = await invokeWithData([row]);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
  }
});

test("malformed conflict rows are rejected when any identity field is non-null", async () => {
  const malformedRows = [
    ["attempt_id string", conflictRow("SLUG_CONFLICT", { attempt_id: ATTEMPT_ID })],
    ["slug string", conflictRow("SLUG_CONFLICT", { slug: SLUG })],
    ["state PREPARED", conflictRow("SLUG_CONFLICT", { state: "PREPARED" })],
    ["attempt_version number", conflictRow("SLUG_CONFLICT", { attempt_version: 0 })],
    ["expires_at string", conflictRow("SLUG_CONFLICT", { expires_at: EXPIRES_AT_ISO })],
  ] as const;

  for (const [label, row] of malformedRows) {
    const { result } = await invokeWithData([row]);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
  }
});

test("row contract drift and unknown outcomes fail closed", async () => {
  const missingKey = successRow();
  delete missingKey.expires_at;
  const extraField = { ...successRow(), private_manifest_sentinel: "private-manifest-sentinel" };
  class RpcRowClass {
    outcome = "CREATED";
    attempt_id = ATTEMPT_ID;
    slug = SLUG;
    state = "PREPARED";
    attempt_version = 0;
    expires_at = EXPIRES_AT_ISO;
  }

  for (const [label, row] of [
    ["missing key", missingKey],
    ["extra private field", extraField],
    ["class instance", new RpcRowClass()],
    ["unknown outcome", successRow({ outcome: "REUSED" })],
  ] as const) {
    const { result } = await invokeWithData([row]);
    assert.deepEqual(result, { mode: "invalid_response" }, label);
  }
});

test("plain null-prototype rows are accepted and input/response objects are not mutated", async () => {
  const input = structuredClone(validBinding);
  const beforeInput = structuredClone(input);
  const row = Object.assign(Object.create(null), successRow());
  const beforeRow = Object.assign(Object.create(null), row);
  const { result } = await invokeWithData([row], input);

  assert.equal(result.mode, "success");
  assert.deepEqual(input, beforeInput);
  assert.deepEqual(row, beforeRow);
});

test("sentinel values from errors, owner fields, manifest, and capability metadata never reach results", async () => {
  const input = {
    ...validBinding,
    privateOwnerAttempt: "private-owner-attempt-sentinel",
    privateOwnerProject: "private-owner-project-sentinel",
    privateManifest: "private-manifest-sentinel",
    privateCapabilityKid: "private-capability-kid-sentinel",
  };
  const invalidRow = {
    ...successRow({ privateOwnerAttempt: "private-owner-attempt-sentinel" }),
    privateDbError: "private-db-error-sentinel",
  };

  const results = await Promise.all([
    prepareEduPublishAttemptViaRpc(input, {
      callRpcFn: async () => ({
        data: [successRow()],
        error: { message: "private-db-error-sentinel", details: "private-owner-project-sentinel" },
      }),
    }),
    prepareEduPublishAttemptViaRpc(input, {
      callRpcFn: async () => ({ data: [invalidRow], error: null }),
    }),
    prepareEduPublishAttemptViaRpc(input, {
      callRpcFn: async () => ({ data: [successRow()], error: null }),
    }),
  ]);

  for (const result of results) {
    assert.doesNotMatch(JSON.stringify(result), /private-(?:db-error|owner|manifest|capability)/);
  }
});

test("same input and same response are deterministic", async () => {
  const first = await invokeWithData([successRow({ outcome: "ALREADY_PREPARED", attempt_version: 7 })]);
  const second = await invokeWithData([successRow({ outcome: "ALREADY_PREPARED", attempt_version: 7 })]);

  assert.deepEqual(first.result, second.result);
});
