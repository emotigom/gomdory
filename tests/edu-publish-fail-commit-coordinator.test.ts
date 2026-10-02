import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  coordinateEduPublishCommitFail,
  type EduPublishCommitFailCoordinatorDependencies,
} from "@/lib/server/edu/publish/failCommitCoordinator";

type Dependencies = EduPublishCommitFailCoordinatorDependencies;
type AdapterResult = Awaited<
  ReturnType<NonNullable<Dependencies["failCommitViaRpcFn"]>>
>;

const VALID_INPUT = {
  attemptId: "00000000-0000-4000-8000-000000000001",
  slug: "abc123-123456-p1",
  manifestSchemaVersion: 1 as const,
  declaredManifestDigest: "a".repeat(64),
  leaseOwner: "00000000-0000-4000-8000-000000000002",
  expectedAttemptVersion: 5,
  failureCode: "R2_TEMPORARY_FAILURE" as const,
};

const FAILED_AT = "2026-12-24T01:03:00.123456+00:00";
const EXPIRES_AT = "2026-12-24T01:45:00.000000+00:00";

function retryableResult(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    mode: "failed_retryable",
    outcome: "FAILED_RETRYABLE",
    attemptId: VALID_INPUT.attemptId,
    slug: VALID_INPUT.slug,
    state: "FAILED_RETRYABLE",
    attemptVersion: 6,
    retryCount: 2,
    commitCount: 1,
    failureCode: VALID_INPUT.failureCode,
    failedAt: FAILED_AT,
    expiresAt: EXPIRES_AT,
    ...overrides,
  };
}

function restartRequiredResult(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    mode: "failed_restart_required",
    outcome: "FAILED_RESTART_REQUIRED",
    attemptId: VALID_INPUT.attemptId,
    slug: VALID_INPUT.slug,
    state: "FAILED_RESTART_REQUIRED",
    attemptVersion: 6,
    retryCount: 2,
    commitCount: 1,
    failureCode: "R2_OBJECT_MISSING",
    failedAt: FAILED_AT,
    expiresAt: EXPIRES_AT,
    ...overrides,
  };
}

function outcomeResult(
  outcome: unknown,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { mode: "outcome", outcome, ...overrides };
}

async function invoke(
  adapterResult: unknown,
  options: { input?: unknown } = {},
) {
  const calls: unknown[] = [];
  const result = await coordinateEduPublishCommitFail(
    options.input === undefined ? VALID_INPUT : options.input,
    {
      failCommitViaRpcFn: async (binding) => {
        calls.push(binding);
        return adapterResult as AdapterResult;
      },
    },
  );
  return { result, calls };
}

test("exact retryable success reconstructs the seven-field binding and normalizes output", async () => {
  const input = { ...VALID_INPUT };
  const inputBefore = structuredClone(input);
  const adapterResponse = retryableResult();
  const adapterResponseBefore = structuredClone(adapterResponse);
  const dependencies: Dependencies = {
    failCommitViaRpcFn: async (binding) => {
      calls.push({ step: "fail:rpc", binding });
      return adapterResponse as AdapterResult;
    },
  };
  const dependencyFunctionBefore = dependencies.failCommitViaRpcFn;
  const calls: unknown[] = [];

  const result = await coordinateEduPublishCommitFail(input, dependencies);

  assert.deepEqual(calls.map((call) => (call as { step: string }).step), [
    "fail:rpc",
  ]);
  const binding = (calls[0] as { binding: Record<string, unknown> }).binding;
  assert.deepEqual(Object.keys(binding).sort(), [
    "attemptId",
    "declaredManifestDigest",
    "expectedAttemptVersion",
    "failureCode",
    "leaseOwner",
    "manifestSchemaVersion",
    "slug",
  ]);
  assert.deepEqual(binding, VALID_INPUT);
  assert.deepEqual(result, {
    mode: "failed",
    outcome: "FAILED_RETRYABLE",
    attemptId: VALID_INPUT.attemptId,
    slug: VALID_INPUT.slug,
    state: "FAILED_RETRYABLE",
    attemptVersion: 6,
    retryCount: 2,
    commitCount: 1,
    failureCode: "R2_TEMPORARY_FAILURE",
    failedAt: FAILED_AT,
    expiresAt: EXPIRES_AT,
  });
  assert.equal("leaseOwner" in result, false);
  assert.equal("declaredManifestDigest" in result, false);
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(adapterResponse, adapterResponseBefore);
  assert.equal(dependencies.failCommitViaRpcFn, dependencyFunctionBefore);
});

test("retryable failure codes preserve exact outcome, state, mapping, and counters", async () => {
  for (const failureCode of [
    "R2_TEMPORARY_FAILURE",
    "DB_TEMPORARY_FAILURE",
    "RPC_TEMPORARY_FAILURE",
    "INTERNAL_EVALUATION_FAILED",
  ] as const) {
    const { result, calls } = await invoke(
      retryableResult({ failureCode }),
      { input: { ...VALID_INPUT, failureCode } },
    );

    assert.deepEqual(result, {
      mode: "failed",
      outcome: "FAILED_RETRYABLE",
      attemptId: VALID_INPUT.attemptId,
      slug: VALID_INPUT.slug,
      state: "FAILED_RETRYABLE",
      attemptVersion: 6,
      retryCount: 2,
      commitCount: 1,
      failureCode,
      failedAt: FAILED_AT,
      expiresAt: EXPIRES_AT,
    });
    assert.equal(calls.length, 1);
  }
});

test("restart-required failure codes preserve exact outcome, state, mapping, and counters", async () => {
  for (const failureCode of [
    "R2_OBJECT_MISSING",
    "R2_SIZE_MISMATCH",
    "R2_DIGEST_MISMATCH",
    "SLUG_CONFLICT",
  ] as const) {
    const { result, calls } = await invoke(
      restartRequiredResult({ failureCode }),
      { input: { ...VALID_INPUT, failureCode } },
    );

    assert.deepEqual(result, {
      mode: "failed",
      outcome: "FAILED_RESTART_REQUIRED",
      attemptId: VALID_INPUT.attemptId,
      slug: VALID_INPUT.slug,
      state: "FAILED_RESTART_REQUIRED",
      attemptVersion: 6,
      retryCount: 2,
      commitCount: 1,
      failureCode,
      failedAt: FAILED_AT,
      expiresAt: EXPIRES_AT,
    });
    assert.equal(calls.length, 1);
  }
});

test("negative outcomes reuse the pure mapping and expose only mode and outcome", async () => {
  for (const outcome of [
    "LEASE_EXPIRED",
    "LEASE_MISMATCH",
    "VERSION_MISMATCH",
    "BINDING_MISMATCH",
    "STATE_CONFLICT",
  ] as const) {
    const { result, calls } = await invoke(outcomeResult(outcome));
    assert.deepEqual(result, { mode: "outcome", outcome });
    assert.deepEqual(Object.keys(result), ["mode", "outcome"]);
    assert.equal(calls.length, 1);
    assert.doesNotMatch(
      JSON.stringify(result),
      /00000000-0000-4000-8000-000000000001|abc123|a{64}|private-/,
    );
  }
});

test("adapter INVALID_INPUT is an internal contract failure without identity exposure", async () => {
  const { result, calls } = await invoke(outcomeResult("INVALID_INPUT"));

  assert.deepEqual(result, { mode: "contract_failure" });
  assert.deepEqual(Object.keys(result), ["mode"]);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(
    JSON.stringify(result),
    /00000000-0000-4000-8000-000000000001|abc123|a{64}|private-/,
  );
});

test("invalid input returns contract_failure without invoking the adapter", async () => {
  const symbol = Symbol("private-input-symbol-sentinel");
  const classInstance = new (class InvalidInput {
    attemptId = VALID_INPUT.attemptId;
    slug = VALID_INPUT.slug;
    manifestSchemaVersion = 1;
    declaredManifestDigest = VALID_INPUT.declaredManifestDigest;
    leaseOwner = VALID_INPUT.leaseOwner;
    expectedAttemptVersion = VALID_INPUT.expectedAttemptVersion;
    failureCode = VALID_INPUT.failureCode;
  })();
  const symbolInput = { ...VALID_INPUT };
  Object.defineProperty(symbolInput, symbol, { value: true });
  const proxyInput = new Proxy(
    { ...VALID_INPUT },
    { getPrototypeOf: () => { throw new Error("private-proxy-sentinel"); } },
  );

  const invalidInputs: Array<[string, unknown]> = [
    ["null", null],
    ["array", []],
    ["class instance", classInstance],
    ["missing key", (() => {
      const value = { ...VALID_INPUT };
      delete (value as Record<string, unknown>).failureCode;
      return value;
    })()],
    ["extra key", { ...VALID_INPUT, privateExtra: "private-extra-field-sentinel" }],
    ["symbol key", symbolInput],
    ["proxy throwing during inspection", proxyInput],
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
    ["negative expected version", { ...VALID_INPUT, expectedAttemptVersion: -1 }],
    ["fractional expected version", { ...VALID_INPUT, expectedAttemptVersion: 1.5 }],
    ["ATTEMPT_EXPIRED", { ...VALID_INPUT, failureCode: "ATTEMPT_EXPIRED" }],
    ["CAPABILITY_INVALID", { ...VALID_INPUT, failureCode: "CAPABILITY_INVALID" }],
    ["unknown failure", { ...VALID_INPUT, failureCode: "UNKNOWN_FAILURE" }],
  ];

  for (const [label, input] of invalidInputs) {
    const calls: unknown[] = [];
    const result = await coordinateEduPublishCommitFail(input, {
      failCommitViaRpcFn: async () => {
        calls.push(label);
        return retryableResult() as AdapterResult;
      },
    });
    assert.deepEqual(result, { mode: "contract_failure" }, label);
    assert.equal(calls.length, 0, label);
  }
});

test("null-prototype input is accepted and still becomes a new exact binding", async () => {
  const input = Object.assign(Object.create(null), {
    ...VALID_INPUT,
    failureCode: "R2_OBJECT_MISSING",
  });
  const calls: unknown[] = [];
  const result = await coordinateEduPublishCommitFail(input, {
    failCommitViaRpcFn: async (binding) => {
      calls.push(binding);
      return restartRequiredResult({ failureCode: "R2_OBJECT_MISSING" }) as AdapterResult;
    },
  });

  assert.deepEqual(result, {
    mode: "failed",
    outcome: "FAILED_RESTART_REQUIRED",
    attemptId: VALID_INPUT.attemptId,
    slug: VALID_INPUT.slug,
    state: "FAILED_RESTART_REQUIRED",
    attemptVersion: 6,
    retryCount: 2,
    commitCount: 1,
    failureCode: "R2_OBJECT_MISSING",
    failedAt: FAILED_AT,
    expiresAt: EXPIRES_AT,
  });
  assert.equal(calls.length, 1);
  assert.equal(Object.getPrototypeOf(calls[0]), Object.prototype);
  assert.deepEqual(calls[0], {
    ...VALID_INPUT,
    failureCode: "R2_OBJECT_MISSING",
  });
});

test("adapter throw maps to unavailable and remains secret-free", async () => {
  const result = await coordinateEduPublishCommitFail(VALID_INPUT, {
    failCommitViaRpcFn: async () => {
      throw new Error(
        "private-adapter-error-sentinel private-attempt-sentinel private-slug-sentinel",
      );
    },
  });

  assert.deepEqual(result, { mode: "unavailable" });
  assert.deepEqual(Object.keys(result), ["mode"]);
  assert.doesNotMatch(JSON.stringify(result), /private-|00000000|abc123/);
});

test("exact rpc_error maps to unavailable and malformed rpc_error is a contract failure", async () => {
  const unavailable = await invoke({ mode: "rpc_error" });
  assert.deepEqual(unavailable.result, { mode: "unavailable" });
  assert.deepEqual(Object.keys(unavailable.result), ["mode"]);

  const malformed = await invoke({
    mode: "rpc_error",
    error: "private-adapter-error-sentinel",
  });
  assert.deepEqual(malformed.result, { mode: "contract_failure" });
  assert.doesNotMatch(JSON.stringify(malformed.result), /private-/);
});

test("invalid_response maps to contract_failure and raw adapter values never escape", async () => {
  const exact = await invoke({ mode: "invalid_response" });
  assert.deepEqual(exact.result, { mode: "contract_failure" });

  const malformed = await invoke({
    mode: "invalid_response",
    raw: "private-raw-response-sentinel",
  });
  assert.deepEqual(malformed.result, { mode: "contract_failure" });
  assert.deepEqual(Object.keys(malformed.result), ["mode"]);
  assert.doesNotMatch(JSON.stringify(malformed.result), /private-/);
});

test("malformed retryable results are rejected without leaking private fields", async () => {
  const malformed: Array<[string, unknown]> = [
    ["attemptId mismatch", retryableResult({ attemptId: "private-attempt-sentinel" })],
    ["slug mismatch", retryableResult({ slug: "private-slug-sentinel" })],
    ["wrong state", retryableResult({ state: "FAILED_RESTART_REQUIRED" })],
    ["restart-required code", retryableResult({ failureCode: "R2_OBJECT_MISSING" })],
    ["different retryable code", retryableResult({ failureCode: "DB_TEMPORARY_FAILURE" })],
    ["ATTEMPT_EXPIRED", retryableResult({ failureCode: "ATTEMPT_EXPIRED" })],
    ["negative version", retryableResult({ attemptVersion: -1 })],
    ["retry count 4", retryableResult({ retryCount: 4 })],
    ["fractional commit count", retryableResult({ commitCount: 1.5 })],
    ["empty failedAt", retryableResult({ failedAt: "" })],
    ["empty expiresAt", retryableResult({ expiresAt: " " })],
    [
      "extra private field",
      retryableResult({ privateExtra: "private-extra-field-sentinel" }),
    ],
  ];

  for (const [label, resultValue] of malformed) {
    const { result } = await invoke(resultValue);
    assert.deepEqual(result, { mode: "contract_failure" }, label);
    assert.doesNotMatch(JSON.stringify(result), /private-/i, label);
  }
});

test("malformed restart-required results are rejected without leaking private fields", async () => {
  const malformed: Array<[string, unknown]> = [
    ["attemptId mismatch", restartRequiredResult({ attemptId: "private-attempt-sentinel" })],
    ["slug mismatch", restartRequiredResult({ slug: "private-slug-sentinel" })],
    ["wrong state", restartRequiredResult({ state: "FAILED_RETRYABLE" })],
    ["retryable code", restartRequiredResult({ failureCode: "R2_TEMPORARY_FAILURE" })],
    ["different restart code", restartRequiredResult({ failureCode: "SLUG_CONFLICT" })],
    ["ATTEMPT_EXPIRED", restartRequiredResult({ failureCode: "ATTEMPT_EXPIRED" })],
    ["null version", restartRequiredResult({ attemptVersion: null })],
    ["negative retry count", restartRequiredResult({ retryCount: -1 })],
    ["empty timestamp", restartRequiredResult({ failedAt: "" })],
    ["extra leaseOwner", restartRequiredResult({ leaseOwner: "private-lease-sentinel" })],
    ["extra private field", restartRequiredResult({ privateExtra: "private-extra-field-sentinel" })],
  ];

  for (const [label, resultValue] of malformed) {
    const { result } = await invoke(resultValue);
    assert.deepEqual(result, { mode: "contract_failure" }, label);
    assert.doesNotMatch(JSON.stringify(result), /private-/i, label);
  }
});

test("malformed outcomes and unknown object shapes are rejected", async () => {
  const symbol = Symbol("private-symbol-sentinel");
  const symbolResult = outcomeResult("LEASE_EXPIRED");
  Object.defineProperty(symbolResult, symbol, { value: true });
  const classResult = new (class AdapterResultClass {
    mode = "outcome";
    outcome = "LEASE_EXPIRED";
  })();
  const unknownMode = { mode: "UNKNOWN" };
  const malformed: Array<[string, unknown]> = [
    ["unknown outcome", outcomeResult("UNKNOWN_OUTCOME")],
    ["INVALID_INPUT", outcomeResult("INVALID_INPUT")],
    ["LEASE_EXPIRED + attemptId", outcomeResult("LEASE_EXPIRED", { attemptId: "private-attempt-sentinel" })],
    ["LEASE_MISMATCH + leaseOwner", outcomeResult("LEASE_MISMATCH", { leaseOwner: "private-lease-sentinel" })],
    ["VERSION_MISMATCH + version", outcomeResult("VERSION_MISMATCH", { version: 5 })],
    ["BINDING_MISMATCH + slug", outcomeResult("BINDING_MISMATCH", { slug: "private-slug-sentinel" })],
    ["STATE_CONFLICT + state", outcomeResult("STATE_CONFLICT", { state: "private-state-sentinel" })],
    ["extra private field", outcomeResult("STATE_CONFLICT", { privateExtra: "private-extra-field-sentinel" })],
    ["null", null],
    ["array", []],
    ["Date", new Date("2026-12-24T00:00:00.000Z")],
    ["class instance", classResult],
    ["unknown mode", unknownMode],
    ["rpc_error + raw error", { mode: "rpc_error", error: "private-adapter-error-sentinel" }],
    ["invalid_response + raw row", { mode: "invalid_response", raw: "private-raw-row-sentinel" }],
    ["symbol key", symbolResult],
  ];

  for (const [label, resultValue] of malformed) {
    const { result } = await invoke(resultValue);
    assert.deepEqual(result, { mode: "contract_failure" }, label);
    assert.doesNotMatch(JSON.stringify(result), /private-/i, label);
  }
});

test("same input and adapter response are deterministic and do not mutate dependencies", async () => {
  const input = {
    ...VALID_INPUT,
    privateExtra: "private-extra-field-sentinel",
  };
  const response = retryableResult();
  const dependencies: Dependencies = {
    failCommitViaRpcFn: async () => response as AdapterResult,
  };
  const inputBefore = structuredClone(input);
  const responseBefore = structuredClone(response);
  const dependencyFunctionBefore = dependencies.failCommitViaRpcFn;

  const first = await coordinateEduPublishCommitFail(input, dependencies);
  const second = await coordinateEduPublishCommitFail(input, dependencies);

  assert.deepEqual(first, second);
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(response, responseBefore);
  assert.equal(dependencies.failCommitViaRpcFn, dependencyFunctionBefore);
});

test("source stays server-only, imports only the two allowed modules, and reuses pure mapping", () => {
  const source = readFileSync(
    resolve(process.cwd(), "lib/server/edu/publish/failCommitCoordinator.ts"),
    "utf8",
  );

  assert.match(source, /^import "server-only";/);
  assert.match(source, /validateEduPublishFailCommitBinding/);
  assert.match(source, /failEduPublishCommitViaRpc/);
  assert.match(source, /decideEduPublishFailCommitHandlerAction/);
  assert.doesNotMatch(
    source,
    /NextRequest|NextResponse|Response|handleEduPublishCommit|beginCommitCoordinator|coordinateEduPublishCommitBegin|beginEduPublishCommitViaRpc|createSupabaseAdminClient|headObject|listObjectKeysV2|recordOpsEvent|Date\.now|Math\.random|randomUUID|node:crypto|process\.env/,
  );
});
