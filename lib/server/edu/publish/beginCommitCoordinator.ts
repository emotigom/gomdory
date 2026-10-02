import "server-only";

import {
  decideEduPublishBeginCommitHandlerAction,
  validateEduPublishBeginCommitBinding,
  type EduPublishBeginCommitBinding,
} from "@/lib/edu/publish/beginCommitContract";
import {
  beginEduPublishCommitViaRpc,
  type EduPublishBeginCommitRpcAdapterResult,
} from "@/lib/server/edu/publish/beginCommitRpc";

export type EduPublishCommitBeginCoordinatorInput = {
  attemptId: string;
  slug: string;
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;
};

export type EduPublishCommitBeginCoordinatorDependencies = {
  createLeaseOwnerFn?: () => string;
  beginCommitViaRpcFn?: typeof beginEduPublishCommitViaRpc;
};

export type EduPublishCommitBeginCoordinatorResult =
  | {
      mode: "claimed";
      outcome:
        | "CLAIMED"
        | "RECLAIMED_RETRYABLE"
        | "TAKEN_OVER_STALE_LEASE";
      attemptId: string;
      slug: string;
      state: "VALIDATING";
      attemptVersion: number;
      retryCount: number;
      commitCount: number;
      leaseOwner: string;
      leaseExpiresAt: string;
      expiresAt: string;
    }
  | {
      mode: "published";
      outcome: "ALREADY_PUBLISHED";
      attemptId: string;
      slug: string;
      state: "PUBLISHED";
      attemptVersion: number;
      retryCount: number;
      commitCount: number;
      expiresAt: string;
      projectId: string;
    }
  | {
      mode: "outcome";
      outcome:
        | "LEASE_ACTIVE"
        | "ATTEMPT_EXPIRED"
        | "BINDING_MISMATCH"
        | "STATE_CONFLICT"
        | "RETRY_EXHAUSTED";
    }
  | {
      mode: "unavailable";
    }
  | {
      mode: "contract_failure";
    };

type PlainObject = Record<string, unknown>;
type ClaimedAdapterResult = Extract<
  EduPublishBeginCommitRpcAdapterResult,
  { mode: "claimed" }
>;
type OutcomeAdapterResult = Extract<
  EduPublishBeginCommitRpcAdapterResult,
  { mode: "outcome" }
>;
type ClaimedOutcome = ClaimedAdapterResult["outcome"];
type NegativeOutcome = Exclude<
  OutcomeAdapterResult["outcome"],
  "INVALID_INPUT"
>;

const LEASE_OWNER_VALIDATION_PLACEHOLDER =
  "00000000-0000-4000-8000-000000000000";

const CANONICAL_LEASE_OWNER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const PREVALIDATED_BINDING_KEYS = [
  "attemptId",
  "slug",
  "manifestSchemaVersion",
  "declaredManifestDigest",
  "leaseOwner",
] as const;

const CLAIMED_RESULT_KEYS = [
  "mode",
  "outcome",
  "attemptId",
  "slug",
  "state",
  "attemptVersion",
  "retryCount",
  "commitCount",
  "leaseExpiresAt",
  "expiresAt",
] as const;

const PUBLISHED_RESULT_KEYS = [
  "mode",
  "outcome",
  "attemptId",
  "slug",
  "state",
  "attemptVersion",
  "retryCount",
  "commitCount",
  "expiresAt",
  "projectId",
] as const;

const OUTCOME_RESULT_KEYS = ["mode", "outcome"] as const;
const FAILURE_RESULT_KEYS = ["mode"] as const;

function isPlainObject(value: unknown): value is PlainObject {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function hasExactOwnKeys(
  value: unknown,
  expectedKeys: readonly string[],
): value is PlainObject {
  if (!isPlainObject(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    return (
      keys.length === expectedKeys.length &&
      keys.every(
        (key) => typeof key === "string" && expectedKeys.includes(key),
      )
    );
  } catch {
    return false;
  }
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCanonicalLeaseOwner(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_LEASE_OWNER_UUID.test(value);
}

function isClaimedOutcome(value: unknown): value is ClaimedOutcome {
  return (
    value === "CLAIMED" ||
    value === "RECLAIMED_RETRYABLE" ||
    value === "TAKEN_OVER_STALE_LEASE"
  );
}

function isSuccessfulBinding(
  value: unknown,
  expected: EduPublishBeginCommitBinding,
): value is EduPublishBeginCommitBinding {
  return (
    hasExactOwnKeys(value, PREVALIDATED_BINDING_KEYS) &&
    value.attemptId === expected.attemptId &&
    value.slug === expected.slug &&
    value.manifestSchemaVersion === expected.manifestSchemaVersion &&
    value.declaredManifestDigest === expected.declaredManifestDigest &&
    value.leaseOwner === expected.leaseOwner
  );
}

function getPrevalidatedBinding(input: unknown): EduPublishBeginCommitBinding | null {
  if (!isPlainObject(input)) return null;

  try {
    const validation = validateEduPublishBeginCommitBinding({
      attemptId: input.attemptId,
      slug: input.slug,
      manifestSchemaVersion: input.manifestSchemaVersion,
      declaredManifestDigest: input.declaredManifestDigest,
      leaseOwner: LEASE_OWNER_VALIDATION_PLACEHOLDER,
    });

    if (
      !isPlainObject(validation) ||
      validation.ok !== true
    ) {
      return null;
    }

    const binding = validation.binding;
    if (
      !isSuccessfulBinding(binding, {
        attemptId: input.attemptId as string,
        slug: input.slug as string,
        manifestSchemaVersion: 1,
        declaredManifestDigest: input.declaredManifestDigest as string,
        leaseOwner: LEASE_OWNER_VALIDATION_PLACEHOLDER,
      })
    ) {
      return null;
    }

    return binding;
  } catch {
    return null;
  }
}

function normalizeAdapterResult(
  result: EduPublishBeginCommitRpcAdapterResult,
  requested: EduPublishBeginCommitBinding,
  leaseOwner: string,
): EduPublishCommitBeginCoordinatorResult {
  try {
    if (!isPlainObject(result) || typeof result.mode !== "string") {
      return { mode: "contract_failure" };
    }

    if (result.mode === "claimed") {
      if (
        !hasExactOwnKeys(result, CLAIMED_RESULT_KEYS) ||
        !isClaimedOutcome(result.outcome) ||
        result.attemptId !== requested.attemptId ||
        result.slug !== requested.slug ||
        result.state !== "VALIDATING" ||
        !isNonNegativeSafeInteger(result.attemptVersion) ||
        !isNonNegativeSafeInteger(result.retryCount) ||
        !isNonNegativeSafeInteger(result.commitCount) ||
        !isNonEmptyString(result.leaseExpiresAt) ||
        !isNonEmptyString(result.expiresAt)
      ) {
        return { mode: "contract_failure" };
      }

      return {
        mode: "claimed",
        outcome: result.outcome,
        attemptId: result.attemptId,
        slug: result.slug,
        state: "VALIDATING",
        attemptVersion: result.attemptVersion,
        retryCount: result.retryCount,
        commitCount: result.commitCount,
        leaseOwner,
        leaseExpiresAt: result.leaseExpiresAt,
        expiresAt: result.expiresAt,
      };
    }

    if (result.mode === "published") {
      if (
        !hasExactOwnKeys(result, PUBLISHED_RESULT_KEYS) ||
        result.outcome !== "ALREADY_PUBLISHED" ||
        result.attemptId !== requested.attemptId ||
        result.slug !== requested.slug ||
        result.state !== "PUBLISHED" ||
        !isNonNegativeSafeInteger(result.attemptVersion) ||
        !isNonNegativeSafeInteger(result.retryCount) ||
        !isNonNegativeSafeInteger(result.commitCount) ||
        !isNonEmptyString(result.expiresAt) ||
        !isNonEmptyString(result.projectId)
      ) {
        return { mode: "contract_failure" };
      }

      return {
        mode: "published",
        outcome: "ALREADY_PUBLISHED",
        attemptId: result.attemptId,
        slug: result.slug,
        state: "PUBLISHED",
        attemptVersion: result.attemptVersion,
        retryCount: result.retryCount,
        commitCount: result.commitCount,
        expiresAt: result.expiresAt,
        projectId: result.projectId,
      };
    }

    if (result.mode === "outcome") {
      if (!hasExactOwnKeys(result, OUTCOME_RESULT_KEYS)) {
        return { mode: "contract_failure" };
      }

      const action = decideEduPublishBeginCommitHandlerAction(result.outcome);
      if (
        action !== "reject_lease_active" &&
        action !== "reject_attempt_expired" &&
        action !== "reject_binding" &&
        action !== "reject_state_conflict" &&
        action !== "reject_retry_exhausted"
      ) {
        return { mode: "contract_failure" };
      }

      return {
        mode: "outcome",
        outcome: result.outcome as NegativeOutcome,
      };
    }

    if (result.mode === "rpc_error" || result.mode === "invalid_response") {
      if (!hasExactOwnKeys(result, FAILURE_RESULT_KEYS)) {
        return { mode: "contract_failure" };
      }
      return result.mode === "rpc_error"
        ? { mode: "unavailable" }
        : { mode: "contract_failure" };
    }

    return { mode: "contract_failure" };
  } catch {
    return { mode: "contract_failure" };
  }
}

// The caller must cryptographically verify the commit capability before invoking this coordinator.
export async function coordinateEduPublishCommitBegin(
  input: unknown,
  dependencies?: EduPublishCommitBeginCoordinatorDependencies,
): Promise<EduPublishCommitBeginCoordinatorResult> {
  const prevalidatedBinding = getPrevalidatedBinding(input);
  if (prevalidatedBinding === null) return { mode: "contract_failure" };

  let leaseOwner: string;
  try {
    const createLeaseOwnerFn =
      dependencies?.createLeaseOwnerFn ??
      (() => globalThis.crypto.randomUUID());
    leaseOwner = createLeaseOwnerFn();
  } catch {
    return { mode: "contract_failure" };
  }

  if (
    !isCanonicalLeaseOwner(leaseOwner) ||
    leaseOwner === prevalidatedBinding.attemptId
  ) {
    return { mode: "contract_failure" };
  }

  const beginBinding: EduPublishBeginCommitBinding = {
    attemptId: prevalidatedBinding.attemptId,
    slug: prevalidatedBinding.slug,
    manifestSchemaVersion: prevalidatedBinding.manifestSchemaVersion,
    declaredManifestDigest: prevalidatedBinding.declaredManifestDigest,
    leaseOwner,
  };

  try {
    const validation = validateEduPublishBeginCommitBinding(beginBinding);
    if (!validation.ok || !isSuccessfulBinding(validation.binding, beginBinding)) {
      return { mode: "contract_failure" };
    }
  } catch {
    return { mode: "contract_failure" };
  }

  let result: EduPublishBeginCommitRpcAdapterResult;
  try {
    const beginCommitViaRpcFn =
      dependencies?.beginCommitViaRpcFn ?? beginEduPublishCommitViaRpc;
    result = await beginCommitViaRpcFn(beginBinding);
  } catch {
    return { mode: "unavailable" };
  }

  return normalizeAdapterResult(result, beginBinding, leaseOwner);
}
