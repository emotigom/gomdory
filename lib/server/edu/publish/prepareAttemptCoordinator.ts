import "server-only";

import {
  buildEduPublishPrefix,
} from "@/lib/edu/publish/objectKey";
import type { DeclaredPrepareManifestEvidenceV1 } from "@/lib/edu/publish/prepareManifestEvidence";
import {
  EDU_PUBLISH_COMMIT_CAPABILITY_OPERATION,
  EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS,
  EDU_PUBLISH_COMMIT_CAPABILITY_VERSION,
  signEduPublishCommitCapability,
  verifyEduPublishCommitCapability,
  type EduPublishCommitCapabilityClaimsV2,
  type SignEduPublishCommitCapabilityResult,
} from "@/lib/edu/publish/commitCapability";
import { prefixExists } from "@/lib/r2/client";
import { buildEduVersionedSlug } from "@/lib/share/slug";
import { loadEduPublishCapabilityKeyRing } from "@/lib/server/edu/publish/commitCapabilityRuntime";
import {
  prepareEduPublishAttemptViaRpc,
  type EduPublishPrepareAttemptRpcAdapterResult,
} from "@/lib/server/edu/publish/prepareAttemptRpc";

export const EDU_PUBLISH_PREPARE_MAX_SLUG_VERSIONS = 200;

export type EduPublishSecuredPrepareCoordinatorInput = {
  baseSlug: string;
  lessonId: 1 | 2 | 3 | 4;
  evidence: DeclaredPrepareManifestEvidenceV1;
};

export type EduPublishSecuredPrepareCoordinatorSuccess = {
  mode: "prepared";
  rpcOutcome: "CREATED" | "ALREADY_PREPARED";
  slug: string;
  publishAttemptId: string;
  publishCapability: string;
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;
  attemptVersion: number;
  expiresAt: string;
};

export type EduPublishSecuredPrepareCoordinatorFailure = {
  mode: "failed";
  reason:
    | "invalid_input"
    | "capability_configuration_unavailable"
    | "capability_signing_failed"
    | "prefix_lookup_failed"
    | "rpc_unavailable"
    | "contract_failure"
    | "slug_exhausted";
};

export type EduPublishSecuredPrepareCoordinatorResult =
  | EduPublishSecuredPrepareCoordinatorSuccess
  | EduPublishSecuredPrepareCoordinatorFailure;

export type EduPublishSecuredPrepareCoordinatorDependencies = {
  prefixExistsFn?: typeof prefixExists;
  createPublishAttemptIdFn?: () => string;
  loadPublishCapabilityKeyRingFn?: typeof loadEduPublishCapabilityKeyRing;
  signPublishCapabilityFn?: typeof signEduPublishCommitCapability;
  verifyPublishCapabilityFn?: typeof verifyEduPublishCommitCapability;
  prepareAttemptViaRpcFn?: typeof prepareEduPublishAttemptViaRpc;
  nowSecondsFn?: () => number;
};

type PlainObject = Record<string, unknown>;
type CapabilityVerificationResult = Awaited<ReturnType<typeof verifyEduPublishCommitCapability>>;

function isPlainObject(value: unknown): value is PlainObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deeplyEqualsJsonValues(
  left: unknown,
  right: unknown,
  compared = new WeakMap<object, object>(),
): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (typeof left !== "object" || typeof right !== "object") return false;

  const previousRight = compared.get(left);
  if (previousRight !== undefined) return previousRight === right;
  compared.set(left, right);

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => deeplyEqualsJsonValues(value, right[index], compared));
  }

  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) => Object.hasOwn(right, key) && deeplyEqualsJsonValues(left[key], right[key], compared),
  );
}

function isValidCoordinatorInput(value: unknown): value is EduPublishSecuredPrepareCoordinatorInput {
  try {
    if (!isPlainObject(value)) return false;
    if (typeof value.baseSlug !== "string" || value.baseSlug.length === 0) return false;
    if (value.lessonId !== 1 && value.lessonId !== 2 && value.lessonId !== 3 && value.lessonId !== 4) return false;
    if (!isPlainObject(value.evidence)) return false;

    const evidence = value.evidence;
    if (evidence.manifestSchemaVersion !== 1) return false;
    if (
      typeof evidence.declaredManifestDigest !== "string" ||
      !/^[0-9a-f]{64}$/.test(evidence.declaredManifestDigest)
    ) {
      return false;
    }
    if (typeof evidence.serializedManifest !== "string" || evidence.serializedManifest.length === 0) return false;

    const parsedManifest = JSON.parse(evidence.serializedManifest) as unknown;
    return deeplyEqualsJsonValues(parsedManifest, evidence.declaredManifest);
  } catch {
    return false;
  }
}

function failed(reason: EduPublishSecuredPrepareCoordinatorFailure["reason"]): EduPublishSecuredPrepareCoordinatorFailure {
  return { mode: "failed", reason };
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isSuccessfulSignerResult(
  value: unknown,
): value is Extract<SignEduPublishCommitCapabilityResult, { ok: true }> {
  if (!isPlainObject(value) || value.ok !== true || typeof value.token !== "string" || value.token.length === 0) {
    return false;
  }
  if (!isPlainObject(value.claims)) return false;
  return true;
}

function isValidCapabilityVerificationResult(
  value: unknown,
): value is Extract<CapabilityVerificationResult, { mode: "valid_v2" }> {
  return isPlainObject(value) && value.mode === "valid_v2";
}

function hasExactOwnKeys(value: unknown, expected: object): value is PlainObject {
  if (!isPlainObject(value)) return false;
  const valueKeys = Reflect.ownKeys(value);
  const expectedKeys = Reflect.ownKeys(expected);
  return (
    valueKeys.length === expectedKeys.length &&
    valueKeys.every((key) => expectedKeys.includes(key))
  );
}

function hasExactExpectedCapabilityClaims(
  value: unknown,
  expected: EduPublishCommitCapabilityClaimsV2,
): value is EduPublishCommitCapabilityClaimsV2 {
  if (!hasExactOwnKeys(value, expected)) return false;
  if (!isPositiveSafeInteger(value.iat) || !isPositiveSafeInteger(value.exp)) return false;
  return deeplyEqualsJsonValues(value, expected);
}

function isSuccessfulRpcResult(
  value: EduPublishPrepareAttemptRpcAdapterResult,
): value is Extract<EduPublishPrepareAttemptRpcAdapterResult, { mode: "success" }> {
  return (
    isPlainObject(value) &&
    value.mode === "success" &&
    (value.outcome === "CREATED" || value.outcome === "ALREADY_PREPARED") &&
    typeof value.attemptId === "string" &&
    typeof value.slug === "string" &&
    value.state === "PREPARED" &&
    typeof value.attemptVersion === "number" &&
    Number.isSafeInteger(value.attemptVersion) &&
    value.attemptVersion >= 0 &&
    typeof value.expiresAt === "string"
  );
}

export async function coordinateEduPublishSecuredPrepare(
  input: EduPublishSecuredPrepareCoordinatorInput,
  dependencies?: EduPublishSecuredPrepareCoordinatorDependencies,
): Promise<EduPublishSecuredPrepareCoordinatorResult> {
  if (!isValidCoordinatorInput(input)) return failed("invalid_input");

  try {
    const prefixExistsFn = dependencies?.prefixExistsFn ?? prefixExists;
    const createPublishAttemptIdFn =
      dependencies?.createPublishAttemptIdFn ?? (() => globalThis.crypto.randomUUID());
    const loadPublishCapabilityKeyRingFn =
      dependencies?.loadPublishCapabilityKeyRingFn ?? loadEduPublishCapabilityKeyRing;
    const signPublishCapabilityFn = dependencies?.signPublishCapabilityFn ?? signEduPublishCommitCapability;
    const verifyPublishCapabilityFn =
      dependencies?.verifyPublishCapabilityFn ?? verifyEduPublishCommitCapability;
    const prepareAttemptViaRpcFn = dependencies?.prepareAttemptViaRpcFn ?? prepareEduPublishAttemptViaRpc;
    const nowSecondsFn = dependencies?.nowSecondsFn ?? (() => Math.floor(Date.now() / 1000));

    let keyRingResult: ReturnType<typeof loadEduPublishCapabilityKeyRing>;
    try {
      keyRingResult = loadPublishCapabilityKeyRingFn();
    } catch {
      return failed("capability_configuration_unavailable");
    }

    if (keyRingResult?.mode === "configuration_unavailable") {
      return failed("capability_configuration_unavailable");
    }
    if (keyRingResult?.mode !== "available") return failed("contract_failure");

    for (
      let version = 1;
      version <= EDU_PUBLISH_PREPARE_MAX_SLUG_VERSIONS;
      version += 1
    ) {
      let slug: string;
      try {
        slug = buildEduVersionedSlug(input.baseSlug, version);
      } catch {
        return failed("contract_failure");
      }

      let occupied: boolean;
      try {
        occupied = await prefixExistsFn(buildEduPublishPrefix(slug));
      } catch {
        return failed("prefix_lookup_failed");
      }
      if (typeof occupied !== "boolean") return failed("contract_failure");
      if (occupied) continue;

      let publishAttemptId: string;
      try {
        publishAttemptId = createPublishAttemptIdFn();
      } catch {
        return failed("contract_failure");
      }

      let nowSeconds: number;
      try {
        nowSeconds = nowSecondsFn();
      } catch {
        return failed("contract_failure");
      }

      let signResult: SignEduPublishCommitCapabilityResult;
      try {
        signResult = await signPublishCapabilityFn({
          keyRing: keyRingResult.keyRing,
          nowSeconds,
          publishAttemptId,
          slug,
          declaredManifestDigest: input.evidence.declaredManifestDigest,
          manifestSchemaVersion: input.evidence.manifestSchemaVersion,
        });
      } catch {
        return failed("capability_signing_failed");
      }

      if (isPlainObject(signResult) && signResult.ok === false) {
        return failed(signResult.reason === "invalid_input" ? "contract_failure" : "capability_signing_failed");
      }
      if (!isSuccessfulSignerResult(signResult)) return failed("contract_failure");

      let verification: CapabilityVerificationResult;
      try {
        verification = await verifyPublishCapabilityFn({
          token: signResult.token,
          keyRing: keyRingResult.keyRing,
          nowSeconds,
          expected: {
            publishAttemptId,
            slug,
            declaredManifestDigest: input.evidence.declaredManifestDigest,
            manifestSchemaVersion: input.evidence.manifestSchemaVersion,
          },
        });
      } catch {
        return failed("capability_signing_failed");
      }

      if (
        isPlainObject(verification) &&
        (verification.mode === "evaluation_failed" || verification.mode === "configuration_unavailable")
      ) {
        return failed("capability_signing_failed");
      }

      const expectedClaims: EduPublishCommitCapabilityClaimsV2 = {
        v: EDU_PUBLISH_COMMIT_CAPABILITY_VERSION,
        op: EDU_PUBLISH_COMMIT_CAPABILITY_OPERATION,
        attemptId: publishAttemptId,
        slug,
        declaredManifestDigest: input.evidence.declaredManifestDigest,
        manifestSchema: input.evidence.manifestSchemaVersion,
        iat: nowSeconds,
        exp: nowSeconds + EDU_PUBLISH_COMMIT_CAPABILITY_TTL_SECONDS,
        kid: keyRingResult.keyRing.current.kid,
      };

      if (
        !isValidCapabilityVerificationResult(verification) ||
        verification.keySlot !== "current" ||
        !hasExactExpectedCapabilityClaims(verification.claims, expectedClaims) ||
        !hasExactOwnKeys(signResult.claims, expectedClaims) ||
        !deeplyEqualsJsonValues(signResult.claims, verification.claims)
      ) {
        return failed("contract_failure");
      }

      let rpcResult: EduPublishPrepareAttemptRpcAdapterResult;
      try {
        rpcResult = await prepareAttemptViaRpcFn({
          attemptId: publishAttemptId,
          slug,
          lessonId: input.lessonId,
          manifestSchemaVersion: input.evidence.manifestSchemaVersion,
          declaredManifestDigest: input.evidence.declaredManifestDigest,
          declaredManifestCanonicalJson: input.evidence.serializedManifest,
          capabilityIssuedAtSeconds: verification.claims.iat,
          capabilityExpiresAtSeconds: verification.claims.exp,
          capabilityKid: verification.claims.kid,
        });
      } catch {
        return failed("rpc_unavailable");
      }

      if (isSuccessfulRpcResult(rpcResult)) {
        if (rpcResult.attemptId !== publishAttemptId || rpcResult.slug !== slug) {
          return failed("contract_failure");
        }
        return {
          mode: "prepared",
          rpcOutcome: rpcResult.outcome,
          slug: rpcResult.slug,
          publishAttemptId: rpcResult.attemptId,
          publishCapability: signResult.token,
          manifestSchemaVersion: input.evidence.manifestSchemaVersion,
          declaredManifestDigest: input.evidence.declaredManifestDigest,
          attemptVersion: rpcResult.attemptVersion,
          expiresAt: rpcResult.expiresAt,
        };
      }

      if (!isPlainObject(rpcResult)) return failed("contract_failure");
      if (rpcResult.mode === "rpc_error") return failed("rpc_unavailable");
      if (rpcResult.mode === "invalid_response") return failed("contract_failure");
      if (rpcResult.mode !== "outcome") return failed("contract_failure");

      if (rpcResult.outcome === "SLUG_CONFLICT" || rpcResult.outcome === "ATTEMPT_ID_CONFLICT") {
        continue;
      }
      if (rpcResult.outcome === "STATE_CONFLICT" || rpcResult.outcome === "INVALID_INPUT") {
        return failed("contract_failure");
      }
      return failed("contract_failure");
    }

    return failed("slug_exhausted");
  } catch {
    return failed("contract_failure");
  }
}
