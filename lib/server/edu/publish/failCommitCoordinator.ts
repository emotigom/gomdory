import "server-only";

import {
  decideEduPublishFailCommitHandlerAction,
  validateEduPublishFailCommitBinding,
  type EduPublishFailCommitBinding,
  type EduPublishFailCommitFailureCode,
} from "@/lib/edu/publish/failCommitContract";
import {
  failEduPublishCommitViaRpc,
  type EduPublishFailCommitRpcAdapterResult,
} from "@/lib/server/edu/publish/failCommitRpc";

export type EduPublishCommitFailCoordinatorInput = {
  attemptId: string;
  slug: string;
  manifestSchemaVersion: 1;
  declaredManifestDigest: string;
  leaseOwner: string;
  expectedAttemptVersion: number;
  failureCode: EduPublishFailCommitFailureCode;
};

export type EduPublishCommitFailCoordinatorDependencies = {
  failCommitViaRpcFn?: typeof failEduPublishCommitViaRpc;
};

type RetryableFailureCode = Extract<
  EduPublishFailCommitFailureCode,
  | "R2_TEMPORARY_FAILURE"
  | "DB_TEMPORARY_FAILURE"
  | "RPC_TEMPORARY_FAILURE"
  | "INTERNAL_EVALUATION_FAILED"
>;

type RestartRequiredFailureCode = Extract<
  EduPublishFailCommitFailureCode,
  | "R2_OBJECT_MISSING"
  | "R2_SIZE_MISMATCH"
  | "R2_DIGEST_MISMATCH"
  | "SLUG_CONFLICT"
>;

export type EduPublishCommitFailCoordinatorResult =
  | {
      mode: "failed";
      outcome: "FAILED_RETRYABLE";
      attemptId: string;
      slug: string;
      state: "FAILED_RETRYABLE";
      attemptVersion: number;
      retryCount: number;
      commitCount: number;
      failureCode: RetryableFailureCode;
      failedAt: string;
      expiresAt: string;
    }
  | {
      mode: "failed";
      outcome: "FAILED_RESTART_REQUIRED";
      attemptId: string;
      slug: string;
      state: "FAILED_RESTART_REQUIRED";
      attemptVersion: number;
      retryCount: number;
      commitCount: number;
      failureCode: RestartRequiredFailureCode;
      failedAt: string;
      expiresAt: string;
    }
  | {
      mode: "outcome";
      outcome:
        | "LEASE_EXPIRED"
        | "LEASE_MISMATCH"
        | "VERSION_MISMATCH"
        | "BINDING_MISMATCH"
        | "STATE_CONFLICT";
    }
  | {
      mode: "unavailable";
    }
  | {
      mode: "contract_failure";
    };

type PlainObject = Record<string, unknown>;
type AdapterFailedResult = Extract<
  EduPublishFailCommitRpcAdapterResult,
  { mode: "failed_retryable" | "failed_restart_required" }
>;
type AdapterOutcomeResult = Extract<
  EduPublishFailCommitRpcAdapterResult,
  { mode: "outcome" }
>;
type NegativeOutcome = Exclude<AdapterOutcomeResult["outcome"], "INVALID_INPUT">;

const INPUT_KEYS = [
  "attemptId",
  "slug",
  "manifestSchemaVersion",
  "declaredManifestDigest",
  "leaseOwner",
  "expectedAttemptVersion",
  "failureCode",
] as const;

const BINDING_KEYS = INPUT_KEYS;
const VALIDATION_KEYS = ["ok", "binding"] as const;
const FAILED_RETRYABLE_RESULT_KEYS = [
  "mode",
  "outcome",
  "attemptId",
  "slug",
  "state",
  "attemptVersion",
  "retryCount",
  "commitCount",
  "failureCode",
  "failedAt",
  "expiresAt",
] as const;
const FAILED_RESTART_REQUIRED_RESULT_KEYS = FAILED_RETRYABLE_RESULT_KEYS;
const OUTCOME_RESULT_KEYS = ["mode", "outcome"] as const;
const FAILURE_RESULT_KEYS = ["mode"] as const;

function isPlainObject(value: unknown): value is PlainObject {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
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
    const ownKeys = Reflect.ownKeys(value);
    return (
      ownKeys.length === expectedKeys.length &&
      ownKeys.every(
        (key) => typeof key === "string" && expectedKeys.includes(key),
      )
    );
  } catch {
    return false;
  }
}

function sameBindingValues(
  actual: PlainObject,
  expected: PlainObject,
): boolean {
  return INPUT_KEYS.every((key) => actual[key] === expected[key]);
}

function getValidatedBinding(
  input: unknown,
): EduPublishFailCommitBinding | null {
  if (!isPlainObject(input) || !hasExactOwnKeys(input, INPUT_KEYS)) {
    return null;
  }

  try {
    const validation = validateEduPublishFailCommitBinding(input);
    if (
      !hasExactOwnKeys(validation, VALIDATION_KEYS) ||
      validation.ok !== true ||
      !hasExactOwnKeys(validation.binding, BINDING_KEYS) ||
      !sameBindingValues(validation.binding, input)
    ) {
      return null;
    }

    const bindingValidation = validateEduPublishFailCommitBinding(
      validation.binding,
    );
    if (
      !hasExactOwnKeys(bindingValidation, VALIDATION_KEYS) ||
      bindingValidation.ok !== true ||
      !hasExactOwnKeys(bindingValidation.binding, BINDING_KEYS) ||
      !sameBindingValues(bindingValidation.binding, validation.binding)
    ) {
      return null;
    }

    return validation.binding as EduPublishFailCommitBinding;
  } catch {
    return null;
  }
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRetryCount(value: unknown): value is number {
  return isNonNegativeSafeInteger(value) && value <= 3;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRetryableFailureCode(value: unknown): value is RetryableFailureCode {
  return (
    value === "R2_TEMPORARY_FAILURE" ||
    value === "DB_TEMPORARY_FAILURE" ||
    value === "RPC_TEMPORARY_FAILURE" ||
    value === "INTERNAL_EVALUATION_FAILED"
  );
}

function isRestartRequiredFailureCode(
  value: unknown,
): value is RestartRequiredFailureCode {
  return (
    value === "R2_OBJECT_MISSING" ||
    value === "R2_SIZE_MISMATCH" ||
    value === "R2_DIGEST_MISMATCH" ||
    value === "SLUG_CONFLICT"
  );
}

function isNegativeHandlerAction(
  action: ReturnType<typeof decideEduPublishFailCommitHandlerAction>,
): boolean {
  return (
    action === "reject_lease_expired" ||
    action === "reject_lease_mismatch" ||
    action === "reject_version_mismatch" ||
    action === "reject_binding" ||
    action === "reject_state_conflict"
  );
}

function isExactFailedIdentityAndCounters(
  result: AdapterFailedResult,
  binding: EduPublishFailCommitBinding,
): boolean {
  return (
    result.attemptId === binding.attemptId &&
    result.slug === binding.slug &&
    isNonNegativeSafeInteger(result.attemptVersion) &&
    isRetryCount(result.retryCount) &&
    isNonNegativeSafeInteger(result.commitCount) &&
    isNonEmptyString(result.failedAt) &&
    isNonEmptyString(result.expiresAt) &&
    result.failureCode === binding.failureCode
  );
}

function normalizeAdapterResult(
  result: unknown,
  binding: EduPublishFailCommitBinding,
): EduPublishCommitFailCoordinatorResult {
  try {
    if (!isPlainObject(result) || typeof result.mode !== "string") {
      return { mode: "contract_failure" };
    }

    if (result.mode === "failed_retryable") {
      if (
        !hasExactOwnKeys(result, FAILED_RETRYABLE_RESULT_KEYS) ||
        result.outcome !== "FAILED_RETRYABLE" ||
        result.state !== "FAILED_RETRYABLE" ||
        decideEduPublishFailCommitHandlerAction(result.outcome) !==
          "return_retryable_failure" ||
        !isExactFailedIdentityAndCounters(
          result as AdapterFailedResult,
          binding,
        ) ||
        !isRetryableFailureCode(result.failureCode)
      ) {
        return { mode: "contract_failure" };
      }

      return {
        mode: "failed",
        outcome: "FAILED_RETRYABLE",
        attemptId: result.attemptId as string,
        slug: result.slug as string,
        state: "FAILED_RETRYABLE",
        attemptVersion: result.attemptVersion as number,
        retryCount: result.retryCount as number,
        commitCount: result.commitCount as number,
        failureCode: result.failureCode,
        failedAt: result.failedAt as string,
        expiresAt: result.expiresAt as string,
      };
    }

    if (result.mode === "failed_restart_required") {
      if (
        !hasExactOwnKeys(result, FAILED_RESTART_REQUIRED_RESULT_KEYS) ||
        result.outcome !== "FAILED_RESTART_REQUIRED" ||
        result.state !== "FAILED_RESTART_REQUIRED" ||
        decideEduPublishFailCommitHandlerAction(result.outcome) !==
          "return_restart_required" ||
        !isExactFailedIdentityAndCounters(
          result as AdapterFailedResult,
          binding,
        ) ||
        !isRestartRequiredFailureCode(result.failureCode)
      ) {
        return { mode: "contract_failure" };
      }

      return {
        mode: "failed",
        outcome: "FAILED_RESTART_REQUIRED",
        attemptId: result.attemptId as string,
        slug: result.slug as string,
        state: "FAILED_RESTART_REQUIRED",
        attemptVersion: result.attemptVersion as number,
        retryCount: result.retryCount as number,
        commitCount: result.commitCount as number,
        failureCode: result.failureCode,
        failedAt: result.failedAt as string,
        expiresAt: result.expiresAt as string,
      };
    }

    if (result.mode === "outcome") {
      if (!hasExactOwnKeys(result, OUTCOME_RESULT_KEYS)) {
        return { mode: "contract_failure" };
      }

      const action = decideEduPublishFailCommitHandlerAction(result.outcome);
      if (!isNegativeHandlerAction(action)) {
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

// The caller must cryptographically verify the commit capability and successfully claim the begin lease before invoking this coordinator.
export async function coordinateEduPublishCommitFail(
  input: unknown,
  dependencies?: EduPublishCommitFailCoordinatorDependencies,
): Promise<EduPublishCommitFailCoordinatorResult> {
  const validatedBinding = getValidatedBinding(input);
  if (validatedBinding === null) return { mode: "contract_failure" };

  const failBinding: EduPublishFailCommitBinding = {
    attemptId: validatedBinding.attemptId,
    slug: validatedBinding.slug,
    manifestSchemaVersion: validatedBinding.manifestSchemaVersion,
    declaredManifestDigest: validatedBinding.declaredManifestDigest,
    leaseOwner: validatedBinding.leaseOwner,
    expectedAttemptVersion: validatedBinding.expectedAttemptVersion,
    failureCode: validatedBinding.failureCode,
  };

  let failCommitViaRpcFn: typeof failEduPublishCommitViaRpc;
  try {
    failCommitViaRpcFn =
      dependencies?.failCommitViaRpcFn ?? failEduPublishCommitViaRpc;
  } catch {
    return { mode: "unavailable" };
  }

  let result: EduPublishFailCommitRpcAdapterResult;
  try {
    result = await failCommitViaRpcFn(failBinding);
  } catch {
    return { mode: "unavailable" };
  }

  return normalizeAdapterResult(result, failBinding);
}
