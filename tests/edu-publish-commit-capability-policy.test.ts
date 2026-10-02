import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import {
  decideEduPublishCapabilityPolicy,
  decideEduPublishCapabilityPolicyFromUnknown,
  type EduPublishCapabilityClassification,
  type EduPublishCapabilityPolicyDecision,
} from "@/lib/edu/publish/commitCapabilityPolicy";

const CLASSIFICATIONS: readonly EduPublishCapabilityClassification[] = [
  "missing",
  "valid_v2",
  "malformed",
  "unsupported_version",
  "unknown_kid",
  "invalid_signature",
  "expired",
  "not_yet_valid",
  "invalid_lifetime",
  "invalid_claim",
  "claim_mismatch",
  "configuration_unavailable",
  "attempt_unconfirmed",
  "evidence_unconfirmed",
  "evaluation_failed",
];

const INVALID_CLASSIFICATIONS = [
  "malformed",
  "unsupported_version",
  "unknown_kid",
  "invalid_signature",
  "not_yet_valid",
  "invalid_lifetime",
  "invalid_claim",
] as const;

const MISMATCH_CLASSIFICATIONS = ["claim_mismatch", "attempt_unconfirmed", "evidence_unconfirmed"] as const;
const UNAVAILABLE_CLASSIFICATIONS = ["configuration_unavailable", "evaluation_failed"] as const;

const INVALID_DECISION = {
  action: "reject",
  status: 401,
  code: "PUBLISH_CAPABILITY_INVALID",
  message: "게시 권한 증명이 유효하지 않습니다. 다시 게시를 시작해 주세요.",
};

const EXPIRED_DECISION = {
  action: "reject",
  status: 401,
  code: "PUBLISH_CAPABILITY_EXPIRED",
  message: "게시 권한 증명이 만료되었습니다. 다시 게시를 시작해 주세요.",
};

const MISMATCH_DECISION = {
  action: "reject",
  status: 409,
  code: "PUBLISH_CAPABILITY_MISMATCH",
  message: "게시 정보가 달라 다시 게시를 시작해 주세요.",
};

const UNAVAILABLE_DECISION = {
  action: "reject",
  status: 503,
  code: "PUBLISH_CAPABILITY_UNAVAILABLE",
  message: "서버 게시 기능이 잠시 준비되지 않았어요. 잠시 후 다시 시도해 주세요.",
  retryAfterSeconds: 30,
};

function decide(mode: "observe" | "enforce_present", classification: EduPublishCapabilityClassification) {
  return decideEduPublishCapabilityPolicy({ mode, classification });
}

function assertExactDecision(actual: EduPublishCapabilityPolicyDecision, expected: EduPublishCapabilityPolicyDecision) {
  assert.deepEqual(actual, expected);
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
}

test("keeps the exact handler classification inventory", () => {
  assert.deepEqual(CLASSIFICATIONS, [
    "missing",
    "valid_v2",
    "malformed",
    "unsupported_version",
    "unknown_kid",
    "invalid_signature",
    "expired",
    "not_yet_valid",
    "invalid_lifetime",
    "invalid_claim",
    "claim_mismatch",
    "configuration_unavailable",
    "attempt_unconfirmed",
    "evidence_unconfirmed",
    "evaluation_failed",
  ]);
  assert.equal(new Set(CLASSIFICATIONS).size, 15);
});

test("observe allows every classification with the observation-only reason", () => {
  for (const classification of CLASSIFICATIONS) {
    assertExactDecision(decide("observe", classification), { action: "allow", reason: "observation_only" });
  }
});

test("enforce_present allows legacy missing and valid capability", () => {
  assertExactDecision(decide("enforce_present", "missing"), { action: "allow", reason: "legacy_missing" });
  assertExactDecision(decide("enforce_present", "valid_v2"), { action: "allow", reason: "valid_capability" });
});

test("enforce_present maps every invalid credential classification to the exact 401 contract", () => {
  for (const classification of INVALID_CLASSIFICATIONS) {
    assertExactDecision(decide("enforce_present", classification), INVALID_DECISION);
  }
});

test("enforce_present maps expired to the exact 401 expired contract", () => {
  assertExactDecision(decide("enforce_present", "expired"), EXPIRED_DECISION);
});

test("enforce_present maps every mismatch classification to the exact 409 contract", () => {
  for (const classification of MISMATCH_CLASSIFICATIONS) {
    assertExactDecision(decide("enforce_present", classification), MISMATCH_DECISION);
  }
});

test("enforce_present maps every unavailable classification to the exact 503 contract", () => {
  for (const classification of UNAVAILABLE_CLASSIFICATIONS) {
    assertExactDecision(decide("enforce_present", classification), UNAVAILABLE_DECISION);
  }
});

test("unknown inputs fail safely without throwing", () => {
  assertExactDecision(decideEduPublishCapabilityPolicyFromUnknown({ mode: "unknown", classification: "missing" }), UNAVAILABLE_DECISION);
  assertExactDecision(decideEduPublishCapabilityPolicyFromUnknown({ mode: "observe", classification: "unknown" }), {
    action: "allow",
    reason: "observation_only",
  });
  assertExactDecision(decideEduPublishCapabilityPolicyFromUnknown({ mode: "enforce_present", classification: "unknown" }), UNAVAILABLE_DECISION);

  for (const input of [null, [], 42, "input", undefined]) {
    assert.doesNotThrow(() => decideEduPublishCapabilityPolicyFromUnknown(input as never));
    assertExactDecision(decideEduPublishCapabilityPolicyFromUnknown(input as never), UNAVAILABLE_DECISION);
  }
});

test("ignores additive input fields and does not expose secret sentinels", () => {
  const input = {
    mode: "enforce_present" as const,
    classification: "valid_v2" as const,
    token: "private-token-sentinel",
    secret: "private-secret-sentinel",
    kid: "private-kid-sentinel",
    claims: "private-claim-sentinel",
  };
  const before = structuredClone(input);
  const result = decideEduPublishCapabilityPolicyFromUnknown(input);
  assert.deepEqual(result, { action: "allow", reason: "valid_capability" });
  assert.deepEqual(input, before);
  assert.doesNotMatch(JSON.stringify(result), /private-token-sentinel|private-secret-sentinel|private-kid-sentinel|private-claim-sentinel/);
});

test("does not mutate input and is deterministic", () => {
  const input = { mode: "enforce_present" as const, classification: "claim_mismatch" as const };
  const before = structuredClone(input);
  const first = decideEduPublishCapabilityPolicy(input);
  const second = decideEduPublishCapabilityPolicy(input);
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
});

test("keeps the required error code and strict mode absent from the product module", async () => {
  const { readFile } = await import("node:fs/promises");
  const modulePath = path.join(process.cwd(), "lib/edu/publish/commitCapabilityPolicy.ts");
  const source = await readFile(modulePath, "utf8");
  assert.doesNotMatch(source, /PUBLISH_CAPABILITY_REQUIRED/);
  assert.doesNotMatch(source, /strict|enforce_all|reject_missing/);
});
