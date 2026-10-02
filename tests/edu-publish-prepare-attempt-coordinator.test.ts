import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { DeclaredPrepareManifestEvidenceV1 } from "@/lib/edu/publish/prepareManifestEvidence";
import type { EduPublishCommitCapabilityClaimsV2 } from "@/lib/edu/publish/commitCapability";
import {
  coordinateEduPublishSecuredPrepare,
  EDU_PUBLISH_PREPARE_MAX_SLUG_VERSIONS,
  type EduPublishSecuredPrepareCoordinatorDependencies,
} from "@/lib/server/edu/publish/prepareAttemptCoordinator";

type Dependencies = EduPublishSecuredPrepareCoordinatorDependencies;
type SignInput = Parameters<NonNullable<Dependencies["signPublishCapabilityFn"]>>[0];
type VerifyInput = Parameters<NonNullable<Dependencies["verifyPublishCapabilityFn"]>>[0];
type RpcInput = Parameters<NonNullable<Dependencies["prepareAttemptViaRpcFn"]>>[0];
type SignResult = Awaited<ReturnType<NonNullable<Dependencies["signPublishCapabilityFn"]>>>;
type VerificationResult = Awaited<ReturnType<NonNullable<Dependencies["verifyPublishCapabilityFn"]>>>;
type RpcResult = Awaited<ReturnType<NonNullable<Dependencies["prepareAttemptViaRpcFn"]>>>;

const BASE_SLUG = "abc123-123456-p1";
const FIRST_ATTEMPT_ID = "00000000-0000-4000-8000-000000000001";
const SECOND_ATTEMPT_ID = "00000000-0000-4000-8000-000000000002";
const FIRST_NOW_SECONDS = 1_798_074_000;
const FIRST_EXPIRES_AT = "2026-12-24T01:45:00.000Z";

const manifest = {
  schemaVersion: 1 as const,
  entryPoint: "index.html" as const,
  files: [
    {
      path: "index.html",
      sizeBytes: 10,
      contentType: "text/html",
      sha256: "a".repeat(64),
    },
  ],
};

const evidence: DeclaredPrepareManifestEvidenceV1 = {
  manifestSchemaVersion: 1,
  declaredManifestDigest: "b".repeat(64),
  declaredManifest: manifest,
  serializedManifest: JSON.stringify(manifest),
};

const input = {
  baseSlug: BASE_SLUG,
  lessonId: 1 as const,
  evidence,
};

const keyRing = {
  current: {
    kid: "current-v1",
    keyBytes: new Uint8Array(32).fill(7),
  },
};

function availableKeyRing() {
  return { mode: "available" as const, keyRing };
}

function successfulSignResult(binding: SignInput, sequence: number): SignResult {
  return {
    ok: true,
    token: `token-${sequence}-${binding.slug}`,
    claims: {
      v: 2,
      op: "edu_publish_commit",
      attemptId: binding.publishAttemptId,
      slug: binding.slug,
      declaredManifestDigest: binding.declaredManifestDigest,
      manifestSchema: 1,
      iat: binding.nowSeconds,
      exp: binding.nowSeconds + 2700,
      kid: keyRing.current.kid,
    },
  };
}

function successfulVerificationResult(binding: VerifyInput): VerificationResult {
  return {
    mode: "valid_v2",
    claims: {
      v: 2,
      op: "edu_publish_commit",
      attemptId: binding.expected.publishAttemptId,
      slug: binding.expected.slug,
      declaredManifestDigest: binding.expected.declaredManifestDigest,
      manifestSchema: binding.expected.manifestSchemaVersion,
      iat: binding.nowSeconds,
      exp: binding.nowSeconds + 2700,
      kid: keyRing.current.kid,
    },
    keySlot: "current",
  };
}

const validVerifier: NonNullable<Dependencies["verifyPublishCapabilityFn"]> = async (binding) =>
  successfulVerificationResult(binding);

function verificationWithClaimOverride(
  binding: VerifyInput,
  overrides: Partial<Record<keyof EduPublishCommitCapabilityClaimsV2, unknown>>,
): VerificationResult {
  const result = successfulVerificationResult(binding);
  if (result.mode !== "valid_v2") throw new Error("test verifier setup failed");
  return {
    ...result,
    claims: { ...result.claims, ...overrides } as EduPublishCommitCapabilityClaimsV2,
  };
}

function makeCandidateDependencies(
  overrides: Partial<Dependencies> = {},
): Dependencies {
  return {
    loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
    prefixExistsFn: async () => false,
    createPublishAttemptIdFn: () => FIRST_ATTEMPT_ID,
    nowSecondsFn: () => FIRST_NOW_SECONDS,
    signPublishCapabilityFn: async (binding) => successfulSignResult(binding, 1),
    verifyPublishCapabilityFn: validVerifier,
    prepareAttemptViaRpcFn: async (binding) => successfulRpcResult(binding),
    ...overrides,
  };
}

function successfulRpcResult(binding: RpcInput, outcome: "CREATED" | "ALREADY_PREPARED" = "CREATED", attemptVersion = 0): RpcResult {
  return {
    mode: "success",
    outcome,
    attemptId: binding.attemptId,
    slug: binding.slug,
    state: "PREPARED",
    attemptVersion,
    expiresAt: FIRST_EXPIRES_AT,
  };
}

function conflictRpcResult(outcome: "SLUG_CONFLICT" | "ATTEMPT_ID_CONFLICT"): RpcResult {
  return { mode: "outcome", outcome };
}

function makeSuccessHarness(outcome: "CREATED" | "ALREADY_PREPARED" = "CREATED") {
  const calls: Array<{ step: string; value?: unknown }> = [];
  const dependencies: Dependencies = {
    loadPublishCapabilityKeyRingFn: () => {
      calls.push({ step: "key" });
      return availableKeyRing();
    },
    prefixExistsFn: async (prefix) => {
      calls.push({ step: "prefix", value: prefix });
      return false;
    },
    createPublishAttemptIdFn: () => {
      calls.push({ step: "attempt" });
      return FIRST_ATTEMPT_ID;
    },
    nowSecondsFn: () => {
      calls.push({ step: "clock" });
      return FIRST_NOW_SECONDS;
    },
    signPublishCapabilityFn: async (binding) => {
      calls.push({ step: "sign", value: binding });
      return successfulSignResult(binding, 1);
    },
    verifyPublishCapabilityFn: async (binding) => {
      calls.push({ step: "verify", value: binding });
      return successfulVerificationResult(binding);
    },
    prepareAttemptViaRpcFn: async (binding) => {
      calls.push({ step: "rpc", value: binding });
      return successfulRpcResult(binding, outcome);
    },
  };
  return { calls, dependencies };
}

test("exports the exact coordinator API and max version", () => {
  assert.equal(EDU_PUBLISH_PREPARE_MAX_SLUG_VERSIONS, 200);
});

test("first candidate success uses the exact order, prefix, binding, and own result", async () => {
  const { calls, dependencies } = makeSuccessHarness();
  const before = structuredClone(input);

  const result = await coordinateEduPublishSecuredPrepare(input, dependencies);

  assert.deepEqual(calls.map(({ step }) => step), ["key", "prefix", "attempt", "clock", "sign", "verify", "rpc"]);
  assert.equal(calls[1].value, `edu/v1/${BASE_SLUG}/`);
  assert.deepEqual(calls[5].value, {
    token: `token-1-${BASE_SLUG}`,
    keyRing,
    nowSeconds: FIRST_NOW_SECONDS,
    expected: {
      publishAttemptId: FIRST_ATTEMPT_ID,
      slug: BASE_SLUG,
      declaredManifestDigest: "b".repeat(64),
      manifestSchemaVersion: 1,
    },
  });
  assert.strictEqual((calls[5].value as VerifyInput).keyRing, keyRing);
  assert.deepEqual(calls[6].value, {
    attemptId: FIRST_ATTEMPT_ID,
    slug: BASE_SLUG,
    lessonId: 1,
    manifestSchemaVersion: 1,
    declaredManifestDigest: "b".repeat(64),
    declaredManifestCanonicalJson: JSON.stringify(manifest),
    capabilityIssuedAtSeconds: FIRST_NOW_SECONDS,
    capabilityExpiresAtSeconds: FIRST_NOW_SECONDS + 2700,
    capabilityKid: keyRing.current.kid,
  });
  assert.deepEqual(result, {
    mode: "prepared",
    rpcOutcome: "CREATED",
    slug: BASE_SLUG,
    publishAttemptId: FIRST_ATTEMPT_ID,
    publishCapability: `token-1-${BASE_SLUG}`,
    manifestSchemaVersion: 1,
    declaredManifestDigest: "b".repeat(64),
    attemptVersion: 0,
    expiresAt: FIRST_EXPIRES_AT,
  });
  assert.deepEqual(input, before);
});

test("verified claims are the only capability metadata source for RPC", async () => {
  let rpcBinding: RpcInput | undefined;
  let verificationClaims: EduPublishCommitCapabilityClaimsV2 | undefined;
  const result = await coordinateEduPublishSecuredPrepare(input, makeCandidateDependencies({
    verifyPublishCapabilityFn: async (binding) => {
      const verification = successfulVerificationResult(binding);
      if (verification.mode === "valid_v2") verificationClaims = verification.claims;
      return verification;
    },
    prepareAttemptViaRpcFn: async (binding) => {
      rpcBinding = binding;
      return successfulRpcResult(binding);
    },
  }));

  assert.equal(result.mode, "prepared");
  assert.ok(verificationClaims);
  assert.ok(rpcBinding);
  assert.equal(rpcBinding.capabilityIssuedAtSeconds, verificationClaims.iat);
  assert.equal(rpcBinding.capabilityExpiresAtSeconds, verificationClaims.exp);
  assert.equal(rpcBinding.capabilityKid, verificationClaims.kid);
});

test("token claim mismatches are contract failures without RPC", async () => {
  const mismatches = [
    ["attemptId", "other-attempt"],
    ["slug", "other-slug"],
    ["declaredManifestDigest", "c".repeat(64)],
    ["manifestSchema", 2],
    ["iat", FIRST_NOW_SECONDS + 1],
    ["exp", FIRST_NOW_SECONDS + 2701],
    ["kid", "other-kid"],
    ["v", 3],
    ["op", "other_operation"],
  ] as const;

  for (const [field, replacement] of mismatches) {
    let verifyCalls = 0;
    let rpcCalls = 0;
    const result = await coordinateEduPublishSecuredPrepare(input, makeCandidateDependencies({
      verifyPublishCapabilityFn: async (binding) => {
        verifyCalls += 1;
        return verificationWithClaimOverride(binding, { [field]: replacement });
      },
      prepareAttemptViaRpcFn: async () => {
        rpcCalls += 1;
        return { mode: "rpc_error" };
      },
    }));

    assert.deepEqual(result, { mode: "failed", reason: "contract_failure" }, field);
    assert.equal(verifyCalls, 1, field);
    assert.equal(rpcCalls, 0, field);
  }
});

test("signer claims must exactly match the verified token claims", async () => {
  const mismatches = [
    ["slug", "other-slug"],
    ["exp", FIRST_NOW_SECONDS + 2701],
  ] as const;

  for (const [field, replacement] of mismatches) {
    let rpcCalls = 0;
    const result = await coordinateEduPublishSecuredPrepare(input, makeCandidateDependencies({
      signPublishCapabilityFn: async (binding) => {
        const signed = successfulSignResult(binding, 1);
        if (!signed.ok) throw new Error("test signer setup failed");
        return {
          ...signed,
          claims: { ...signed.claims, [field]: replacement } as EduPublishCommitCapabilityClaimsV2,
        };
      },
      prepareAttemptViaRpcFn: async () => {
        rpcCalls += 1;
        return { mode: "rpc_error" };
      },
    }));

    assert.deepEqual(result, { mode: "failed", reason: "contract_failure" }, field);
    assert.equal(rpcCalls, 0, field);
  }
});

test("a freshly signed capability cannot pass with the previous key slot", async () => {
  let rpcCalls = 0;
  const result = await coordinateEduPublishSecuredPrepare(input, makeCandidateDependencies({
    verifyPublishCapabilityFn: async (binding) => {
      const verification = successfulVerificationResult(binding);
      return { ...verification, keySlot: "previous" } as VerificationResult;
    },
    prepareAttemptViaRpcFn: async () => {
      rpcCalls += 1;
      return { mode: "rpc_error" };
    },
  }));

  assert.deepEqual(result, { mode: "failed", reason: "contract_failure" });
  assert.equal(rpcCalls, 0);
});

test("verifier non-valid results are contract failures without RPC", async () => {
  const modes = [
    "malformed",
    "invalid_signature",
    "invalid_lifetime",
    "claim_mismatch",
    "expired",
    "not_yet_valid",
    "unknown_kid",
  ] as const;

  for (const mode of modes) {
    let rpcCalls = 0;
    const result = await coordinateEduPublishSecuredPrepare(input, makeCandidateDependencies({
      verifyPublishCapabilityFn: async () => ({ mode } as VerificationResult),
      prepareAttemptViaRpcFn: async () => {
        rpcCalls += 1;
        return { mode: "rpc_error" };
      },
    }));

    assert.deepEqual(result, { mode: "failed", reason: "contract_failure" }, mode);
    assert.equal(rpcCalls, 0, mode);
  }
});

test("verifier evaluation failures and throws are capability_signing_failed", async () => {
  for (const mode of ["evaluation_failed", "configuration_unavailable"] as const) {
    let rpcCalls = 0;
    const result = await coordinateEduPublishSecuredPrepare(input, makeCandidateDependencies({
      verifyPublishCapabilityFn: async () => ({ mode }),
      prepareAttemptViaRpcFn: async () => {
        rpcCalls += 1;
        return { mode: "rpc_error" };
      },
    }));

    assert.deepEqual(result, { mode: "failed", reason: "capability_signing_failed" }, mode);
    assert.equal(rpcCalls, 0, mode);
  }

  let rpcCalls = 0;
  const result = await coordinateEduPublishSecuredPrepare(input, makeCandidateDependencies({
    verifyPublishCapabilityFn: async () => {
      throw new Error("private-verifier-error-sentinel");
    },
    prepareAttemptViaRpcFn: async () => {
      rpcCalls += 1;
      return { mode: "rpc_error" };
    },
  }));

  assert.deepEqual(result, { mode: "failed", reason: "capability_signing_failed" });
  assert.equal(rpcCalls, 0);
  assert.doesNotMatch(JSON.stringify(result), /private-verifier-error-sentinel/);
});

test("an empty signer token is a contract failure before verification", async () => {
  let verifyCalls = 0;
  let rpcCalls = 0;
  const result = await coordinateEduPublishSecuredPrepare(input, makeCandidateDependencies({
    signPublishCapabilityFn: async (binding) => {
      const signed = successfulSignResult(binding, 1);
      return { ...signed, token: "" };
    },
    verifyPublishCapabilityFn: async (binding) => {
      verifyCalls += 1;
      return successfulVerificationResult(binding);
    },
    prepareAttemptViaRpcFn: async () => {
      rpcCalls += 1;
      return { mode: "rpc_error" };
    },
  }));

  assert.deepEqual(result, { mode: "failed", reason: "contract_failure" });
  assert.equal(verifyCalls, 0);
  assert.equal(rpcCalls, 0);
});

test("ALREADY_PREPARED is a normal coordinator success", async () => {
  const { dependencies } = makeSuccessHarness("ALREADY_PREPARED");

  const result = await coordinateEduPublishSecuredPrepare(input, dependencies);

  assert.equal(result.mode, "prepared");
  if (result.mode === "prepared") assert.equal(result.rpcOutcome, "ALREADY_PREPARED");
});

test("occupied R2 candidate is skipped before attempt identity and capability work", async () => {
  const calls: string[] = [];
  const dependencies: Dependencies = {
    loadPublishCapabilityKeyRingFn: () => {
      calls.push("key");
      return availableKeyRing();
    },
    prefixExistsFn: async (prefix) => {
      calls.push(`prefix:${prefix}`);
      return prefix.endsWith(`${BASE_SLUG}/`);
    },
    createPublishAttemptIdFn: () => {
      calls.push("attempt");
      return FIRST_ATTEMPT_ID;
    },
    nowSecondsFn: () => {
      calls.push("clock");
      return FIRST_NOW_SECONDS;
    },
    signPublishCapabilityFn: async (binding) => {
      calls.push("sign");
      return successfulSignResult(binding, 1);
    },
    verifyPublishCapabilityFn: async (binding) => {
      calls.push("verify");
      return validVerifier(binding);
    },
    prepareAttemptViaRpcFn: async (binding) => {
      calls.push("rpc");
      return successfulRpcResult(binding);
    },
  };

  const result = await coordinateEduPublishSecuredPrepare(input, dependencies);

  assert.equal(result.mode, "prepared");
  assert.deepEqual(calls, [
    "key",
    `prefix:edu/v1/${BASE_SLUG}/`,
    `prefix:edu/v1/${BASE_SLUG}-v2/`,
    "attempt",
    "clock",
    "sign",
    "verify",
    "rpc",
  ]);
  if (result.mode === "prepared") assert.equal(result.slug, `${BASE_SLUG}-v2`);
});

for (const conflict of ["SLUG_CONFLICT", "ATTEMPT_ID_CONFLICT"] as const) {
  test(`${conflict} rotates slug, attempt UUID, clock, capability, and RPC`, async () => {
    const calls: Array<{ step: string; value?: unknown }> = [];
    let attemptIndex = 0;
    let signIndex = 0;
    let rpcIndex = 0;
    const signTokens: string[] = [];
    const attemptIds = [FIRST_ATTEMPT_ID, SECOND_ATTEMPT_ID];
    const dependencies: Dependencies = {
      loadPublishCapabilityKeyRingFn: () => {
        calls.push({ step: "key" });
        return availableKeyRing();
      },
      prefixExistsFn: async (prefix) => {
        calls.push({ step: "prefix", value: prefix });
        return false;
      },
      createPublishAttemptIdFn: () => {
        const value = attemptIds[attemptIndex];
        attemptIndex += 1;
        calls.push({ step: "attempt", value });
        return value;
      },
      nowSecondsFn: () => {
        const value = FIRST_NOW_SECONDS + rpcIndex;
        calls.push({ step: "clock", value });
        return value;
      },
      signPublishCapabilityFn: async (binding) => {
        signIndex += 1;
        calls.push({ step: "sign", value: binding });
        const result = successfulSignResult(binding, signIndex);
        if (result.ok) signTokens.push(result.token);
        return result;
      },
      verifyPublishCapabilityFn: async (binding) => {
        calls.push({ step: "verify", value: binding });
        return successfulVerificationResult(binding);
      },
      prepareAttemptViaRpcFn: async (binding) => {
        rpcIndex += 1;
        calls.push({ step: "rpc", value: binding });
        return rpcIndex === 1 ? conflictRpcResult(conflict) : successfulRpcResult(binding);
      },
    };

    const result = await coordinateEduPublishSecuredPrepare(input, dependencies);
    const rpcBindings = calls.filter(({ step }) => step === "rpc").map(({ value }) => value as RpcInput);
    const signBindings = calls.filter(({ step }) => step === "sign").map(({ value }) => value as SignInput);

    assert.equal(result.mode, "prepared");
    assert.equal(rpcBindings.length, 2);
    assert.equal(signBindings.length, 2);
    assert.notEqual(rpcBindings[0].slug, rpcBindings[1].slug);
    assert.notEqual(rpcBindings[0].attemptId, rpcBindings[1].attemptId);
    assert.equal(signTokens.length, 2);
    assert.notEqual(signTokens[0], signTokens[1]);
    const verificationBindings = calls
      .filter(({ step }) => step === "verify")
      .map(({ value }) => value as VerifyInput);
    assert.equal(verificationBindings.length, 2);
    assert.notEqual(
      verificationBindings[0].expected.publishAttemptId,
      verificationBindings[1].expected.publishAttemptId,
    );
    assert.notEqual(verificationBindings[0].expected.slug, verificationBindings[1].expected.slug);
    assert.deepEqual(calls.map(({ step }) => step), [
      "key", "prefix", "attempt", "clock", "sign", "verify", "rpc",
      "prefix", "attempt", "clock", "sign", "verify", "rpc",
    ]);
  });
}

test("key configuration unavailable and loader throw stop before every candidate dependency", async () => {
  for (const loadPublishCapabilityKeyRingFn of [
    () => ({ mode: "configuration_unavailable" as const }),
    () => {
      throw new Error("private-capability-key-sentinel");
    },
  ]) {
    let downstreamCalls = 0;
    const result = await coordinateEduPublishSecuredPrepare(input, {
      loadPublishCapabilityKeyRingFn,
      prefixExistsFn: async () => {
        downstreamCalls += 1;
        return false;
      },
      createPublishAttemptIdFn: () => {
        downstreamCalls += 1;
        return FIRST_ATTEMPT_ID;
      },
      nowSecondsFn: () => {
        downstreamCalls += 1;
        return FIRST_NOW_SECONDS;
      },
      signPublishCapabilityFn: async () => {
        downstreamCalls += 1;
        return { ok: false, reason: "evaluation_failed" };
      },
      prepareAttemptViaRpcFn: async () => {
        downstreamCalls += 1;
        return { mode: "rpc_error" };
      },
    });

    assert.deepEqual(result, { mode: "failed", reason: "capability_configuration_unavailable" });
    assert.equal(downstreamCalls, 0);
  }
});

test("prefix lookup failure is not treated as an empty prefix", async () => {
  let signCalls = 0;
  let rpcCalls = 0;
  const result = await coordinateEduPublishSecuredPrepare(input, {
    loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
    prefixExistsFn: async () => {
      throw new Error("private-r2-error-sentinel");
    },
    signPublishCapabilityFn: async () => {
      signCalls += 1;
      return { ok: false, reason: "evaluation_failed" };
    },
    prepareAttemptViaRpcFn: async () => {
      rpcCalls += 1;
      return { mode: "rpc_error" };
    },
  });

  assert.deepEqual(result, { mode: "failed", reason: "prefix_lookup_failed" });
  assert.equal(signCalls, 0);
  assert.equal(rpcCalls, 0);
});

test("attempt UUID and clock failures stop before signing and RPC", async () => {
  for (const [label, dependencies] of [
    ["uuid", {
      loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
      prefixExistsFn: async () => false,
      createPublishAttemptIdFn: () => {
        throw new Error("private-attempt-sentinel");
      },
    }],
    ["clock", {
      loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
      prefixExistsFn: async () => false,
      createPublishAttemptIdFn: () => FIRST_ATTEMPT_ID,
      nowSecondsFn: () => {
        throw new Error("private-clock-sentinel");
      },
    }],
  ] as const) {
    let signCalls = 0;
    let rpcCalls = 0;
    const result = await coordinateEduPublishSecuredPrepare(input, {
      ...dependencies,
      signPublishCapabilityFn: async () => {
        signCalls += 1;
        return { ok: false, reason: "evaluation_failed" };
      },
      prepareAttemptViaRpcFn: async () => {
        rpcCalls += 1;
        return { mode: "rpc_error" };
      },
    });

    assert.deepEqual(result, { mode: "failed", reason: "contract_failure" }, label);
    assert.equal(signCalls, 0, label);
    assert.equal(rpcCalls, 0, label);
  }
});

for (const [label, signResult, expectedReason] of [
  ["invalid_input", { ok: false, reason: "invalid_input" }, "contract_failure"],
  ["evaluation_failed", { ok: false, reason: "evaluation_failed" }, "capability_signing_failed"],
] as const) {
  test(`signer ${label} is classified safely`, async () => {
    let rpcCalls = 0;
    const result = await coordinateEduPublishSecuredPrepare(input, {
      loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
      prefixExistsFn: async () => false,
      createPublishAttemptIdFn: () => FIRST_ATTEMPT_ID,
      nowSecondsFn: () => FIRST_NOW_SECONDS,
      signPublishCapabilityFn: async () => signResult,
      prepareAttemptViaRpcFn: async () => {
        rpcCalls += 1;
        return { mode: "rpc_error" };
      },
    });

    assert.deepEqual(result, { mode: "failed", reason: expectedReason });
    assert.equal(rpcCalls, 0);
  });
}

test("signer throw is capability_signing_failed and cannot reach RPC", async () => {
  let rpcCalls = 0;
  const result = await coordinateEduPublishSecuredPrepare(input, {
    loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
    prefixExistsFn: async () => false,
    createPublishAttemptIdFn: () => FIRST_ATTEMPT_ID,
    nowSecondsFn: () => FIRST_NOW_SECONDS,
    signPublishCapabilityFn: async () => {
      throw new Error("private-capability-signing-sentinel");
    },
    prepareAttemptViaRpcFn: async () => {
      rpcCalls += 1;
      return { mode: "rpc_error" };
    },
  });

  assert.deepEqual(result, { mode: "failed", reason: "capability_signing_failed" });
  assert.equal(rpcCalls, 0);
});

test("RPC error is unavailable without an automatic retry", async () => {
  let prefixCalls = 0;
  let rpcCalls = 0;
  const result = await coordinateEduPublishSecuredPrepare(input, {
    loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
    prefixExistsFn: async () => {
      prefixCalls += 1;
      return false;
    },
    createPublishAttemptIdFn: () => FIRST_ATTEMPT_ID,
    nowSecondsFn: () => FIRST_NOW_SECONDS,
    signPublishCapabilityFn: async (binding) => successfulSignResult(binding, 1),
    verifyPublishCapabilityFn: validVerifier,
    prepareAttemptViaRpcFn: async () => {
      rpcCalls += 1;
      return { mode: "rpc_error" };
    },
  });

  assert.deepEqual(result, { mode: "failed", reason: "rpc_unavailable" });
  assert.equal(prefixCalls, 1);
  assert.equal(rpcCalls, 1);
});

test("invalid RPC response and non-retryable outcomes fail as contract errors", async () => {
  for (const rpcResult of [
    { mode: "invalid_response" },
    { mode: "outcome", outcome: "STATE_CONFLICT" },
    { mode: "outcome", outcome: "INVALID_INPUT" },
  ] as const) {
    let prefixCalls = 0;
    const result = await coordinateEduPublishSecuredPrepare(input, {
      loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
      prefixExistsFn: async () => {
        prefixCalls += 1;
        return false;
      },
      createPublishAttemptIdFn: () => FIRST_ATTEMPT_ID,
      nowSecondsFn: () => FIRST_NOW_SECONDS,
      signPublishCapabilityFn: async (binding) => successfulSignResult(binding, 1),
      verifyPublishCapabilityFn: validVerifier,
      prepareAttemptViaRpcFn: async () => rpcResult,
    });

    assert.deepEqual(result, { mode: "failed", reason: "contract_failure" });
    assert.equal(prefixCalls, 1);
  }
});

test("R2 exhaustion checks every version and never allocates an attempt", async () => {
  let prefixCalls = 0;
  let attemptCalls = 0;
  let signCalls = 0;
  let rpcCalls = 0;
  const prefixes: string[] = [];
  const result = await coordinateEduPublishSecuredPrepare(input, {
    loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
    prefixExistsFn: async (prefix) => {
      prefixCalls += 1;
      prefixes.push(prefix);
      return true;
    },
    createPublishAttemptIdFn: () => {
      attemptCalls += 1;
      return FIRST_ATTEMPT_ID;
    },
    signPublishCapabilityFn: async (binding) => {
      signCalls += 1;
      return successfulSignResult(binding, 1);
    },
    verifyPublishCapabilityFn: validVerifier,
    prepareAttemptViaRpcFn: async (binding) => {
      rpcCalls += 1;
      return successfulRpcResult(binding);
    },
  });

  assert.deepEqual(result, { mode: "failed", reason: "slug_exhausted" });
  assert.equal(prefixCalls, EDU_PUBLISH_PREPARE_MAX_SLUG_VERSIONS);
  assert.equal(prefixes[0], `edu/v1/${BASE_SLUG}/`);
  assert.equal(prefixes.at(-1), `edu/v1/${BASE_SLUG}-v200/`);
  assert.equal(attemptCalls, 0);
  assert.equal(signCalls, 0);
  assert.equal(rpcCalls, 0);
});

test("RPC conflict exhaustion rotates every candidate identity and returns no owner data", async () => {
  const attempts: string[] = [];
  const slugs: string[] = [];
  let attemptNumber = 0;
  let prefixCalls = 0;
  let clockCalls = 0;
  let signCalls = 0;
  let rpcCalls = 0;
  const result = await coordinateEduPublishSecuredPrepare(input, {
    loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
    prefixExistsFn: async () => {
      prefixCalls += 1;
      return false;
    },
    createPublishAttemptIdFn: () => {
      const value = `00000000-0000-4000-8000-${String(attemptNumber + 1).padStart(12, "0")}`;
      attemptNumber += 1;
      attempts.push(value);
      return value;
    },
    nowSecondsFn: () => {
      clockCalls += 1;
      return FIRST_NOW_SECONDS + clockCalls;
    },
    signPublishCapabilityFn: async (binding) => {
      signCalls += 1;
      slugs.push(binding.slug);
      return successfulSignResult(binding, signCalls);
    },
    verifyPublishCapabilityFn: validVerifier,
    prepareAttemptViaRpcFn: async () => {
      rpcCalls += 1;
      return conflictRpcResult("SLUG_CONFLICT");
    },
  });

  assert.deepEqual(result, { mode: "failed", reason: "slug_exhausted" });
  assert.equal(prefixCalls, 200);
  assert.equal(attemptNumber, 200);
  assert.equal(clockCalls, 200);
  assert.equal(signCalls, 200);
  assert.equal(rpcCalls, 200);
  assert.equal(new Set(attempts).size, 200);
  assert.equal(new Set(slugs).size, 200);
  assert.equal(JSON.stringify(result).includes("private-owner"), false);
});

test("input validation rejects malformed evidence before loading any dependency", async () => {
  const invalidInputs: unknown[] = [
    { ...input, baseSlug: "" },
    { ...input, lessonId: 0 },
    { ...input, lessonId: 5 },
    { ...input, evidence: { ...evidence, declaredManifestDigest: "B".repeat(64) } },
    { ...input, evidence: { ...evidence, manifestSchemaVersion: 2 } },
    { ...input, evidence: { ...evidence, serializedManifest: "" } },
    { ...input, evidence: { ...evidence, serializedManifest: "{" } },
    {
      ...input,
      evidence: {
        ...evidence,
        declaredManifest: { ...manifest, entryPoint: "other.html" },
      },
    },
  ];
  let dependencyCalls = 0;
  const dependencies: Dependencies = {
    loadPublishCapabilityKeyRingFn: () => {
      dependencyCalls += 1;
      return availableKeyRing();
    },
    prefixExistsFn: async () => {
      dependencyCalls += 1;
      return false;
    },
    createPublishAttemptIdFn: () => {
      dependencyCalls += 1;
      return FIRST_ATTEMPT_ID;
    },
    nowSecondsFn: () => {
      dependencyCalls += 1;
      return FIRST_NOW_SECONDS;
    },
    signPublishCapabilityFn: async () => {
      dependencyCalls += 1;
      return { ok: false, reason: "invalid_input" };
    },
    prepareAttemptViaRpcFn: async () => {
      dependencyCalls += 1;
      return { mode: "rpc_error" };
    },
  };

  for (const invalidInput of invalidInputs) {
    assert.deepEqual(
      await coordinateEduPublishSecuredPrepare(invalidInput as never, dependencies),
      { mode: "failed", reason: "invalid_input" },
    );
  }
  assert.equal(dependencyCalls, 0);
});

test("failure results never expose sentinels from capability, RPC, R2, or owner errors", async () => {
  const results = await Promise.all([
    coordinateEduPublishSecuredPrepare(input, {
      loadPublishCapabilityKeyRingFn: () => {
        throw new Error("private-capability-key-sentinel");
      },
    }),
    coordinateEduPublishSecuredPrepare(input, {
      loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
      prefixExistsFn: async () => {
        throw new Error("private-r2-error-sentinel");
      },
    }),
    coordinateEduPublishSecuredPrepare(input, {
      loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
      prefixExistsFn: async () => false,
      createPublishAttemptIdFn: () => "private-owner-attempt-sentinel",
      nowSecondsFn: () => FIRST_NOW_SECONDS,
      signPublishCapabilityFn: async () => {
        throw new Error("private-capability-signing-sentinel");
      },
    }),
    coordinateEduPublishSecuredPrepare(input, {
      loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
      prefixExistsFn: async () => false,
      createPublishAttemptIdFn: () => FIRST_ATTEMPT_ID,
      nowSecondsFn: () => FIRST_NOW_SECONDS,
      signPublishCapabilityFn: async (binding) => {
        const signed = successfulSignResult(binding, 1);
        return { ...signed, token: "private-token-sentinel" };
      },
      verifyPublishCapabilityFn: async () => ({ mode: "invalid_signature" }),
      prepareAttemptViaRpcFn: async () => ({ mode: "rpc_error" }),
    }),
    coordinateEduPublishSecuredPrepare(input, {
      loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
      prefixExistsFn: async () => false,
      createPublishAttemptIdFn: () => FIRST_ATTEMPT_ID,
      nowSecondsFn: () => FIRST_NOW_SECONDS,
      signPublishCapabilityFn: async (binding) => successfulSignResult(binding, 1),
      verifyPublishCapabilityFn: async () => ({
        mode: "valid_v2",
        keySlot: "current",
        claims: {
          v: 2,
          op: "edu_publish_commit",
          attemptId: "private-claim-attempt-sentinel",
          slug: "private-claim-slug-sentinel",
          declaredManifestDigest: "private-claim-digest-sentinel",
          manifestSchema: 1,
          iat: FIRST_NOW_SECONDS,
          exp: FIRST_NOW_SECONDS + 2700,
          kid: "private-claim-kid-sentinel",
        },
      } as VerificationResult),
      prepareAttemptViaRpcFn: async () => ({ mode: "rpc_error" }),
    }),
    coordinateEduPublishSecuredPrepare(input, {
      loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
      prefixExistsFn: async () => false,
      createPublishAttemptIdFn: () => FIRST_ATTEMPT_ID,
      nowSecondsFn: () => FIRST_NOW_SECONDS,
      signPublishCapabilityFn: async (binding) => successfulSignResult(binding, 1),
      verifyPublishCapabilityFn: async () => {
        throw new Error("private-verifier-error-sentinel");
      },
      prepareAttemptViaRpcFn: async () => {
        throw new Error("private-rpc-error-sentinel");
      },
    }),
  ]);

  for (const result of results) {
    assert.match(JSON.stringify(result), /^\{"mode":"failed","reason":"/);
    assert.doesNotMatch(
      JSON.stringify(result),
      /private-(?:capability-key|capability-signing|rpc-error|r2-error|owner-attempt|owner-project|token|claim-attempt|claim-slug|claim-digest|claim-kid|verifier-error)/,
    );
  }
});

test("fixed dependencies produce deterministic results and do not mutate input", async () => {
  const before = structuredClone(input);
  const makeDependencies = (): Dependencies => ({
    loadPublishCapabilityKeyRingFn: () => availableKeyRing(),
    prefixExistsFn: async () => false,
    createPublishAttemptIdFn: () => FIRST_ATTEMPT_ID,
    nowSecondsFn: () => FIRST_NOW_SECONDS,
    signPublishCapabilityFn: async (binding) => successfulSignResult(binding, 1),
    verifyPublishCapabilityFn: validVerifier,
    prepareAttemptViaRpcFn: async (binding) => successfulRpcResult(binding, "ALREADY_PREPARED", 7),
  });

  const first = await coordinateEduPublishSecuredPrepare(input, makeDependencies());
  const second = await coordinateEduPublishSecuredPrepare(input, makeDependencies());

  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test("coordinator is server-only and has no handler, HTTP, presign, or direct Supabase boundary", async () => {
  const source = await readFile(
    path.join(process.cwd(), "lib/server/edu/publish/prepareAttemptCoordinator.ts"),
    "utf8",
  );
  assert.equal(source.split("\n", 1)[0], 'import "server-only";');
  assert.doesNotMatch(
    source,
    /NextRequest|NextResponse|\bResponse\b|jsonError|jsonOk|recordOpsEvent|rateLimit|createSupabaseAdminClient|presignPutUrl|headObject|edu_atomic_publish/,
  );
});
