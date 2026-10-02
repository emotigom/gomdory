import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  coordinateEduPublishCommitBegin,
  type EduPublishCommitBeginCoordinatorDependencies,
} from "@/lib/server/edu/publish/beginCommitCoordinator";

type Dependencies = EduPublishCommitBeginCoordinatorDependencies;
type AdapterInput = Parameters<NonNullable<Dependencies["beginCommitViaRpcFn"]>>[0];
type AdapterResult = Awaited<ReturnType<NonNullable<Dependencies["beginCommitViaRpcFn"]>>>;

const VALID_INPUT = {
  attemptId: "00000000-0000-4000-8000-000000000001",
  slug: "abc123-123456-p1",
  manifestSchemaVersion: 1 as const,
  declaredManifestDigest: "a".repeat(64),
};

const LEASE_OWNER = "00000000-0000-4000-8000-000000000002";
const SECOND_LEASE_OWNER = "00000000-0000-4000-8000-000000000004";
const PROJECT_ID = "00000000-0000-4000-8000-000000000003";
const LEASE_EXPIRES_AT = "2026-12-24T01:05:00.000Z";
const EXPIRES_AT = "2026-12-24T01:45:00.000Z";
const EXPIRED_AT = "2020-01-01T00:00:00.000Z";

function claimedResult(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
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
    ...overrides,
  };
}

function publishedResult(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
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
    ...overrides,
  };
}

function outcomeResult(outcome: string): Record<string, unknown> {
  return { mode: "outcome", outcome };
}

async function invoke(
  adapterResult: unknown,
  options: {
    input?: unknown;
    leaseOwner?: string;
    onLease?: () => string;
    onAdapter?: (binding: AdapterInput) => void;
  } = {},
) {
  let leaseCalls = 0;
  let adapterCalls = 0;
  const adapterInputs: AdapterInput[] = [];
  const result = await coordinateEduPublishCommitBegin(
    options.input === undefined ? VALID_INPUT : options.input,
    {
      createLeaseOwnerFn: () => {
        leaseCalls += 1;
        return options.onLease?.() ?? options.leaseOwner ?? LEASE_OWNER;
      },
      beginCommitViaRpcFn: async (binding) => {
        adapterCalls += 1;
        adapterInputs.push(binding);
        options.onAdapter?.(binding);
        return adapterResult as AdapterResult;
      },
    },
  );
  return { result, leaseCalls, adapterCalls, adapterInputs };
}

test("exports the exact coordinator contract and uses the exact call order", async () => {
  const input = {
    ...VALID_INPUT,
    privateExtra: "private-extra-field-sentinel",
  };
  const before = structuredClone(input);
  const calls: Array<{ step: string; value?: unknown }> = [];

  const result = await coordinateEduPublishCommitBegin(input, {
    createLeaseOwnerFn: () => {
      calls.push({ step: "lease:create" });
      return LEASE_OWNER;
    },
    beginCommitViaRpcFn: async (binding) => {
      calls.push({ step: "begin:rpc", value: binding });
      return claimedResult() as AdapterResult;
    },
  });

  assert.deepEqual(calls.map(({ step }) => step), ["lease:create", "begin:rpc"]);
  assert.deepEqual(Object.keys(calls[1].value as object).sort(), [
    "attemptId",
    "declaredManifestDigest",
    "leaseOwner",
    "manifestSchemaVersion",
    "slug",
  ]);
  assert.deepEqual(calls[1].value, {
    ...VALID_INPUT,
    leaseOwner: LEASE_OWNER,
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
    leaseOwner: LEASE_OWNER,
    leaseExpiresAt: LEASE_EXPIRES_AT,
    expiresAt: EXPIRES_AT,
  });
  assert.deepEqual(input, before);
});

test("all claimed outcomes normalize with the generated lease owner and preserve counters", async () => {
  for (const outcome of [
    "CLAIMED",
    "RECLAIMED_RETRYABLE",
    "TAKEN_OVER_STALE_LEASE",
  ]) {
    const { result, leaseCalls, adapterCalls } = await invoke(
      claimedResult({ outcome, attemptVersion: 7, retryCount: 3, commitCount: 5 }),
    );
    assert.deepEqual(result, {
      mode: "claimed",
      outcome,
      attemptId: VALID_INPUT.attemptId,
      slug: VALID_INPUT.slug,
      state: "VALIDATING",
      attemptVersion: 7,
      retryCount: 3,
      commitCount: 5,
      leaseOwner: LEASE_OWNER,
      leaseExpiresAt: LEASE_EXPIRES_AT,
      expiresAt: EXPIRES_AT,
    });
    assert.equal(leaseCalls, 1);
    assert.equal(adapterCalls, 1);
  }
});

test("published replay preserves project identity, omits lease owner, and accepts expired timestamps", async () => {
  const { result, leaseCalls, adapterCalls } = await invoke(publishedResult());

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
  assert.equal("leaseOwner" in result, false);
  assert.equal(leaseCalls, 1);
  assert.equal(adapterCalls, 1);
});

test("negative outcomes reuse the pure handler action mapping and expose only the negative outcome", async () => {
  for (const outcome of [
    "LEASE_ACTIVE",
    "ATTEMPT_EXPIRED",
    "BINDING_MISMATCH",
    "STATE_CONFLICT",
    "RETRY_EXHAUSTED",
  ]) {
    const { result } = await invoke(outcomeResult(outcome));
    assert.deepEqual(result, { mode: "outcome", outcome });
    assert.deepEqual(Object.keys(result), ["mode", "outcome"]);
    assert.doesNotMatch(
      JSON.stringify(result),
      /private-|00000000-0000-4000-8000-000000000001|abc123|a{64}/,
    );
  }
});

test("adapter INVALID_INPUT is an internal contract failure without identity exposure", async () => {
  const { result, leaseCalls, adapterCalls } = await invoke(
    outcomeResult("INVALID_INPUT"),
  );

  assert.deepEqual(result, { mode: "contract_failure" });
  assert.equal(leaseCalls, 1);
  assert.equal(adapterCalls, 1);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private-|00000000-0000-4000-8000-000000000001|abc123|a{64}/,
  );
});

test("invalid input is rejected before lease creation and adapter invocation", async () => {
  const invalidInputs: Array<[string, unknown]> = [
    ["null", null],
    ["array", []],
    ["class instance", new (class InvalidInput {})()],
    ["invalid attempt UUID", { ...VALID_INPUT, attemptId: "not-a-uuid" }],
    [
      "uppercase attempt UUID",
      { ...VALID_INPUT, attemptId: "00000000-0000-4000-8000-00000000000A" },
    ],
    ["invalid slug", { ...VALID_INPUT, slug: "not valid" }],
    ["schema 2", { ...VALID_INPUT, manifestSchemaVersion: 2 }],
    ["uppercase digest", { ...VALID_INPUT, declaredManifestDigest: "A".repeat(64) }],
    ["short digest", { ...VALID_INPUT, declaredManifestDigest: "a".repeat(63) }],
  ];

  for (const [label, input] of invalidInputs) {
    const { result, leaseCalls, adapterCalls } = await invoke(undefined, { input });
    assert.deepEqual(result, { mode: "contract_failure" }, label);
    assert.equal(leaseCalls, 0, label);
    assert.equal(adapterCalls, 0, label);
  }
});

test("lease generation failures are contract failures and never invoke the adapter", async () => {
  const leaseFailures: Array<[string, () => string]> = [
    ["throw", () => {
      throw new Error("private-lease-owner-sentinel");
    }],
    ["empty", () => ""],
    ["uppercase UUID", () => "00000000-0000-4000-8000-00000000000A"],
    ["malformed UUID", () => "not-a-uuid"],
    ["opaque string", () => "private-lease-owner-sentinel"],
    ["same as attempt", () => VALID_INPUT.attemptId],
  ];

  for (const [label, onLease] of leaseFailures) {
    const { result, leaseCalls, adapterCalls } = await invoke(undefined, { onLease });
    assert.deepEqual(result, { mode: "contract_failure" }, label);
    assert.equal(leaseCalls, 1, label);
    assert.equal(adapterCalls, 0, label);
    assert.doesNotMatch(JSON.stringify(result), /private-|00000000-0000-4000-8000-000000000001/);
  }
});

test("a fresh lease is generated for every invocation without an internal retry or cache", async () => {
  let leaseIndex = 0;
  const adapterInputs: AdapterInput[] = [];
  const dependencies: Dependencies = {
    createLeaseOwnerFn: () => {
      leaseIndex += 1;
      return leaseIndex === 1 ? LEASE_OWNER : SECOND_LEASE_OWNER;
    },
    beginCommitViaRpcFn: async (binding) => {
      adapterInputs.push(binding);
      return claimedResult() as AdapterResult;
    },
  };

  const first = await coordinateEduPublishCommitBegin(VALID_INPUT, dependencies);
  const second = await coordinateEduPublishCommitBegin(VALID_INPUT, dependencies);

  assert.equal(leaseIndex, 2);
  assert.equal(adapterInputs.length, 2);
  assert.equal(adapterInputs[0].leaseOwner, LEASE_OWNER);
  assert.equal(adapterInputs[1].leaseOwner, SECOND_LEASE_OWNER);
  assert.equal(first.mode, "claimed");
  assert.equal(second.mode, "claimed");
  if (first.mode !== "claimed" || second.mode !== "claimed") return;
  assert.equal(first.leaseOwner, LEASE_OWNER);
  assert.equal(second.leaseOwner, SECOND_LEASE_OWNER);
});

test("adapter throw and rpc_error are unavailable, while invalid_response is a contract failure", async () => {
  const thrown = await coordinateEduPublishCommitBegin(VALID_INPUT, {
    createLeaseOwnerFn: () => LEASE_OWNER,
    beginCommitViaRpcFn: async () => {
      throw new Error("private-adapter-error-sentinel");
    },
  });
  const rpcError = await coordinateEduPublishCommitBegin(VALID_INPUT, {
    createLeaseOwnerFn: () => LEASE_OWNER,
    beginCommitViaRpcFn: async () => ({ mode: "rpc_error" }) as AdapterResult,
  });
  const invalidResponse = await coordinateEduPublishCommitBegin(VALID_INPUT, {
    createLeaseOwnerFn: () => LEASE_OWNER,
    beginCommitViaRpcFn: async () => ({ mode: "invalid_response" }) as AdapterResult,
  });

  assert.deepEqual(thrown, { mode: "unavailable" });
  assert.deepEqual(rpcError, { mode: "unavailable" });
  assert.deepEqual(invalidResponse, { mode: "contract_failure" });
  assert.doesNotMatch(JSON.stringify(thrown), /private-/);
  assert.doesNotMatch(JSON.stringify(rpcError), /private-/);
  assert.doesNotMatch(JSON.stringify(invalidResponse), /private-/);
});

test("malformed claimed results fail closed", async () => {
  const malformedResults: Array<[string, Record<string, unknown>]> = [
    ["attemptId mismatch", claimedResult({ attemptId: "00000000-0000-4000-8000-000000000004" })],
    ["slug mismatch", claimedResult({ slug: "different-slug" })],
    ["wrong state", claimedResult({ state: "PREPARED" })],
    ["unknown outcome", claimedResult({ outcome: "UNKNOWN" })],
    ["negative attemptVersion", claimedResult({ attemptVersion: -1 })],
    ["fractional retryCount", claimedResult({ retryCount: 1.5 })],
    ["null commitCount", claimedResult({ commitCount: null })],
    ["empty lease expiry", claimedResult({ leaseExpiresAt: "" })],
    ["missing expiry", (() => {
      const value = claimedResult();
      delete value.expiresAt;
      return value;
    })()],
    ["extra private field", claimedResult({ privateExtra: "private-extra-field-sentinel" })],
  ];

  for (const [label, adapterResult] of malformedResults) {
    const { result } = await invoke(adapterResult);
    assert.deepEqual(result, { mode: "contract_failure" }, label);
    assert.doesNotMatch(JSON.stringify(result), /private-|00000000-0000-4000-8000-000000000002/);
  }
});

test("malformed published results fail closed and never return a lease owner", async () => {
  const malformedResults: Array<[string, Record<string, unknown>]> = [
    ["attemptId mismatch", publishedResult({ attemptId: "00000000-0000-4000-8000-000000000004" })],
    ["slug mismatch", publishedResult({ slug: "different-slug" })],
    ["wrong state", publishedResult({ state: "VALIDATING" })],
    ["wrong outcome", publishedResult({ outcome: "CLAIMED" })],
    ["negative counter", publishedResult({ commitCount: -1 })],
    ["empty expiry", publishedResult({ expiresAt: "" })],
    ["empty project", publishedResult({ projectId: "" })],
    ["extra lease owner", publishedResult({ leaseOwner: LEASE_OWNER })],
    ["extra private field", publishedResult({ privateExtra: "private-extra-field-sentinel" })],
  ];

  for (const [label, adapterResult] of malformedResults) {
    const { result } = await invoke(adapterResult);
    assert.deepEqual(result, { mode: "contract_failure" }, label);
    assert.equal("leaseOwner" in result, false);
    assert.doesNotMatch(JSON.stringify(result), /private-|00000000-0000-4000-8000-000000000002/);
  }
});

test("malformed outcome results fail closed, including INVALID_INPUT with identity fields", async () => {
  const malformedResults: Array<[string, Record<string, unknown>]> = [
    ["unknown outcome", outcomeResult("UNKNOWN")],
    ["INVALID_INPUT with lease expiry", { ...outcomeResult("INVALID_INPUT"), leaseExpiresAt: LEASE_EXPIRES_AT }],
    ["LEASE_ACTIVE with state", { ...outcomeResult("LEASE_ACTIVE"), state: "VALIDATING" }],
    ["extra private field", { ...outcomeResult("STATE_CONFLICT"), privateExtra: "private-extra-field-sentinel" }],
  ];

  for (const [label, adapterResult] of malformedResults) {
    const { result } = await invoke(adapterResult);
    assert.deepEqual(result, { mode: "contract_failure" }, label);
  }
});

test("unknown mode, non-plain objects, symbol keys, and extra failure keys fail closed", async () => {
  class AdapterResultClass {
    mode = "claimed";
    outcome = "CLAIMED";
  }

  const symbolResult = claimedResult();
  Object.defineProperty(symbolResult, Symbol("private"), {
    value: "private-extra-field-sentinel",
    enumerable: true,
  });

  const malformedResults: Array<[string, unknown]> = [
    ["null", null],
    ["array", []],
    ["Date", new Date("2026-01-01T00:00:00.000Z")],
    ["class instance", new AdapterResultClass()],
    ["unknown mode", { mode: "UNKNOWN" }],
    ["rpc_error extra field", { mode: "rpc_error", error: "private-adapter-error-sentinel" }],
    ["invalid_response extra field", { mode: "invalid_response", raw: "private-adapter-error-sentinel" }],
    ["symbol key", symbolResult],
  ];

  for (const [label, adapterResult] of malformedResults) {
    const { result } = await invoke(adapterResult);
    assert.deepEqual(result, { mode: "contract_failure" }, label);
  }
});

test("fixed lease and adapter dependencies are deterministic and do not mutate the adapter result", async () => {
  const adapterResult = claimedResult({ attemptVersion: 9 });
  const adapterBefore = structuredClone(adapterResult);
  const input = { ...VALID_INPUT, privateExtra: "private-extra-field-sentinel" };
  const inputBefore = structuredClone(input);
  const dependencies: Dependencies = {
    createLeaseOwnerFn: () => LEASE_OWNER,
    beginCommitViaRpcFn: async () => adapterResult as AdapterResult,
  };

  const first = await coordinateEduPublishCommitBegin(input, dependencies);
  const second = await coordinateEduPublishCommitBegin(input, dependencies);

  assert.deepEqual(first, second);
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(adapterResult, adapterBefore);
});

test("failure and negative results are secret-free while claimed success intentionally retains only its generated lease owner", async () => {
  const sentinels = [
    "private-lease-owner-sentinel",
    "private-adapter-error-sentinel",
    "private-attempt-sentinel",
    "private-slug-sentinel",
    "private-digest-sentinel",
    "private-project-sentinel",
    "private-extra-field-sentinel",
  ];
  const failureResults = [
    await coordinateEduPublishCommitBegin(VALID_INPUT, {
      createLeaseOwnerFn: () => {
        throw new Error(sentinels[0]);
      },
      beginCommitViaRpcFn: async () => {
        throw new Error(sentinels[1]);
      },
    }),
    await invoke({ mode: "outcome", outcome: "LEASE_ACTIVE" }).then(({ result }) => result),
    await invoke({ mode: "invalid_response" }).then(({ result }) => result),
  ];

  for (const result of failureResults) {
    const serialized = JSON.stringify(result);
    for (const sentinel of sentinels) assert.doesNotMatch(serialized, new RegExp(sentinel));
  }

  const claimed = await invoke(claimedResult()).then(({ result }) => result);
  assert.equal(claimed.mode, "claimed");
  assert.match(JSON.stringify(claimed), new RegExp(LEASE_OWNER));
  for (const sentinel of sentinels) assert.doesNotMatch(JSON.stringify(claimed), new RegExp(sentinel));
});

test("source boundary is server-only, imports only the contract and adapter, and reuses pure handler mapping", () => {
  const source = readFileSync(
    resolve(process.cwd(), "lib/server/edu/publish/beginCommitCoordinator.ts"),
    "utf8",
  );
  assert.equal(source.split("\n", 1)[0], 'import "server-only";');
  assert.match(source, /decideEduPublishBeginCommitHandlerAction/);
  assert.match(source, /decideEduPublishBeginCommitHandlerAction\(result\.outcome\)/);
  assert.doesNotMatch(
    source,
    /NextRequest|NextResponse|Response|handleEduPublishCommit|verifyEduPublishCommitCapability|commitCapabilityPolicy|createSupabaseAdminClient|headObject|listObjectKeysV2|recordOpsEvent|Date\.now|Math\.random|node:crypto|process\.env/,
  );
  assert.doesNotMatch(source, /from "@\/lib\/(?!edu\/publish\/beginCommitContract|server\/edu\/publish\/beginCommitRpc)/);
});
