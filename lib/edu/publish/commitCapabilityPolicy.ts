export type EduPublishCapabilityClassification =
  | "missing"
  | "valid_v2"
  | "malformed"
  | "unsupported_version"
  | "unknown_kid"
  | "invalid_signature"
  | "expired"
  | "not_yet_valid"
  | "invalid_lifetime"
  | "invalid_claim"
  | "claim_mismatch"
  | "configuration_unavailable"
  | "attempt_unconfirmed"
  | "evidence_unconfirmed"
  | "evaluation_failed";

export type EduPublishCapabilityPolicyMode = "observe" | "enforce_present";

export type EduPublishCapabilityPolicyAllowReason =
  | "observation_only"
  | "legacy_missing"
  | "valid_capability";

export type EduPublishCapabilityPolicyAllowDecision = {
  action: "allow";
  reason: EduPublishCapabilityPolicyAllowReason;
};

export type EduPublishCapabilityPolicyErrorCode =
  | "PUBLISH_CAPABILITY_INVALID"
  | "PUBLISH_CAPABILITY_EXPIRED"
  | "PUBLISH_CAPABILITY_MISMATCH"
  | "PUBLISH_CAPABILITY_UNAVAILABLE";

export type EduPublishCapabilityPolicyRejectDecision = {
  action: "reject";
  status: 401 | 409 | 503;
  code: EduPublishCapabilityPolicyErrorCode;
  message: string;
  retryAfterSeconds?: 30;
};

export type EduPublishCapabilityPolicyDecision =
  | EduPublishCapabilityPolicyAllowDecision
  | EduPublishCapabilityPolicyRejectDecision;

const INVALID_CLASSIFICATIONS: ReadonlySet<EduPublishCapabilityClassification> = new Set([
  "malformed",
  "unsupported_version",
  "unknown_kid",
  "invalid_signature",
  "not_yet_valid",
  "invalid_lifetime",
  "invalid_claim",
]);

const MISMATCH_CLASSIFICATIONS: ReadonlySet<EduPublishCapabilityClassification> = new Set([
  "claim_mismatch",
  "attempt_unconfirmed",
  "evidence_unconfirmed",
]);

const UNAVAILABLE_CLASSIFICATIONS: ReadonlySet<EduPublishCapabilityClassification> = new Set([
  "configuration_unavailable",
  "evaluation_failed",
]);

const INVALID_DECISION: EduPublishCapabilityPolicyRejectDecision = {
  action: "reject",
  status: 401,
  code: "PUBLISH_CAPABILITY_INVALID",
  message: "게시 권한 증명이 유효하지 않습니다. 다시 게시를 시작해 주세요.",
};

const EXPIRED_DECISION: EduPublishCapabilityPolicyRejectDecision = {
  action: "reject",
  status: 401,
  code: "PUBLISH_CAPABILITY_EXPIRED",
  message: "게시 권한 증명이 만료되었습니다. 다시 게시를 시작해 주세요.",
};

const MISMATCH_DECISION: EduPublishCapabilityPolicyRejectDecision = {
  action: "reject",
  status: 409,
  code: "PUBLISH_CAPABILITY_MISMATCH",
  message: "게시 정보가 달라 다시 게시를 시작해 주세요.",
};

const UNAVAILABLE_DECISION: EduPublishCapabilityPolicyRejectDecision = {
  action: "reject",
  status: 503,
  code: "PUBLISH_CAPABILITY_UNAVAILABLE",
  message: "서버 게시 기능이 잠시 준비되지 않았어요. 잠시 후 다시 시도해 주세요.",
  retryAfterSeconds: 30,
};

function isPolicyMode(value: unknown): value is EduPublishCapabilityPolicyMode {
  return value === "observe" || value === "enforce_present";
}

function isClassification(value: unknown): value is EduPublishCapabilityClassification {
  return (
    value === "missing" ||
    value === "valid_v2" ||
    value === "expired" ||
    INVALID_CLASSIFICATIONS.has(value as EduPublishCapabilityClassification) ||
    MISMATCH_CLASSIFICATIONS.has(value as EduPublishCapabilityClassification) ||
    UNAVAILABLE_CLASSIFICATIONS.has(value as EduPublishCapabilityClassification)
  );
}

function unavailableDecision(): EduPublishCapabilityPolicyRejectDecision {
  return { ...UNAVAILABLE_DECISION };
}

function decideKnownEnforcePresent(
  classification: EduPublishCapabilityClassification,
): EduPublishCapabilityPolicyDecision {
  if (classification === "missing") return { action: "allow", reason: "legacy_missing" };
  if (classification === "valid_v2") return { action: "allow", reason: "valid_capability" };
  if (classification === "expired") return { ...EXPIRED_DECISION };
  if (INVALID_CLASSIFICATIONS.has(classification)) return { ...INVALID_DECISION };
  if (MISMATCH_CLASSIFICATIONS.has(classification)) return { ...MISMATCH_DECISION };
  if (UNAVAILABLE_CLASSIFICATIONS.has(classification)) return unavailableDecision();
  return unavailableDecision();
}

function readPolicyInput(input: unknown, key: "mode" | "classification"): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  return (input as Record<string, unknown>)[key];
}

function decideFromUnknownValues(mode: unknown, classification: unknown): EduPublishCapabilityPolicyDecision {
  if (!isPolicyMode(mode)) return unavailableDecision();
  if (mode === "observe") return { action: "allow", reason: "observation_only" };
  if (!isClassification(classification)) return unavailableDecision();
  return decideKnownEnforcePresent(classification);
}

/**
 * enforce_present blocks submitted capability integrity and binding failures,
 * while allowing missing legacy requests; capability removal is not prevented.
 */
export function decideEduPublishCapabilityPolicy(input: {
  mode: EduPublishCapabilityPolicyMode;
  classification: EduPublishCapabilityClassification;
}): EduPublishCapabilityPolicyDecision {
  return decideFromUnknownValues(
    readPolicyInput(input, "mode"),
    readPolicyInput(input, "classification"),
  );
}

export function decideEduPublishCapabilityPolicyFromUnknown(input: {
  mode: unknown;
  classification: unknown;
}): EduPublishCapabilityPolicyDecision {
  return decideFromUnknownValues(
    readPolicyInput(input, "mode"),
    readPolicyInput(input, "classification"),
  );
}
