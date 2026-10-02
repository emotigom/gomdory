import "server-only";

import {
  EDU_PUBLISH_FAIL_COMMIT_OUTCOMES,
  validateEduPublishFailCommitBinding,
  type EduPublishFailCommitBinding,
  type EduPublishFailCommitFailureCode,
  type EduPublishFailCommitOutcome,
} from "@/lib/edu/publish/failCommitContract";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";

export const EDU_PUBLISH_FAIL_COMMIT_RPC =
  "fail_edu_publish_commit_v1" as const;

type FailRpcArgs =
  Database["public"]["Functions"][typeof EDU_PUBLISH_FAIL_COMMIT_RPC]["Args"];

type FailRpcCallResult = {
  data: unknown;
  error: unknown;
};

export type FailRpcCaller = (
  rpcName: typeof EDU_PUBLISH_FAIL_COMMIT_RPC,
  args: FailRpcArgs,
) => Promise<FailRpcCallResult>;

export type FailEduPublishCommitRpcDependencies = {
  callRpcFn?: FailRpcCaller;
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

export type EduPublishFailCommitRpcAdapterResult =
  | {
      mode: "failed_retryable";
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
      mode: "failed_restart_required";
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
        | "STATE_CONFLICT"
        | "INVALID_INPUT";
    }
  | {
      mode: "rpc_error";
    }
  | {
      mode: "invalid_response";
    };

type RpcRow = Record<string, unknown>;

const RPC_ROW_KEYS = new Set([
  "outcome",
  "attempt_id",
  "slug",
  "state",
  "attempt_version",
  "retry_count",
  "commit_count",
  "failure_code",
  "failed_at",
  "expires_at",
]);

const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const POSTGRES_TIMESTAMPTZ =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/i;

async function callFailCommitRpc(
  rpcName: typeof EDU_PUBLISH_FAIL_COMMIT_RPC,
  args: FailRpcArgs,
): Promise<FailRpcCallResult> {
  const supabase = createSupabaseAdminClient();
  return supabase.rpc(rpcName, args);
}

function isPlainObject(value: unknown): value is RpcRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactRpcRowKeys(value: RpcRow): boolean {
  const keys = Reflect.ownKeys(value);
  return (
    keys.length === RPC_ROW_KEYS.size &&
    keys.every((key) => typeof key === "string" && RPC_ROW_KEYS.has(key))
  );
}

function isKnownOutcome(value: unknown): value is EduPublishFailCommitOutcome {
  return (
    typeof value === "string" &&
    (EDU_PUBLISH_FAIL_COMMIT_OUTCOMES as readonly string[]).includes(value)
  );
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID.test(value);
}

function parsePostgresTimestamptzMilliseconds(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const match = POSTGRES_TIMESTAMPTZ.exec(value);
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const daysInMonth = month === 2
    ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      ? 29
      : 28
    : [4, 6, 9, 11].includes(month)
      ? 30
      : 31;

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && Number.isInteger(milliseconds)
    ? milliseconds
    : null;
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

function hasNegativeOutcomeShape(row: RpcRow): boolean {
  return (
    row.attempt_id === null &&
    row.slug === null &&
    row.state === null &&
    row.attempt_version === null &&
    row.retry_count === null &&
    row.commit_count === null &&
    row.failure_code === null &&
    row.failed_at === null &&
    row.expires_at === null
  );
}

function normalizeSuccessfulRow(
  row: RpcRow,
  binding: EduPublishFailCommitBinding,
): EduPublishFailCommitRpcAdapterResult {
  const failedAtMilliseconds = parsePostgresTimestamptzMilliseconds(row.failed_at);
  const expiresAtMilliseconds = parsePostgresTimestamptzMilliseconds(row.expires_at);

  if (
    !isCanonicalUuid(row.attempt_id) ||
    row.attempt_id !== binding.attemptId ||
    typeof row.slug !== "string" ||
    row.slug !== binding.slug ||
    !isNonNegativeSafeInteger(row.attempt_version) ||
    !isNonNegativeSafeInteger(row.retry_count) ||
    !isNonNegativeSafeInteger(row.commit_count) ||
    typeof row.failed_at !== "string" ||
    failedAtMilliseconds === null ||
    typeof row.expires_at !== "string" ||
    expiresAtMilliseconds === null ||
    failedAtMilliseconds > expiresAtMilliseconds
  ) {
    return { mode: "invalid_response" };
  }

  if (
    row.outcome === "FAILED_RETRYABLE" &&
    row.state === "FAILED_RETRYABLE" &&
    isRetryableFailureCode(row.failure_code) &&
    row.failure_code === binding.failureCode
  ) {
    return {
      mode: "failed_retryable",
      outcome: "FAILED_RETRYABLE",
      attemptId: row.attempt_id,
      slug: row.slug,
      state: "FAILED_RETRYABLE",
      attemptVersion: row.attempt_version,
      retryCount: row.retry_count,
      commitCount: row.commit_count,
      failureCode: row.failure_code,
      failedAt: row.failed_at,
      expiresAt: row.expires_at,
    };
  }

  if (
    row.outcome === "FAILED_RESTART_REQUIRED" &&
    row.state === "FAILED_RESTART_REQUIRED" &&
    isRestartRequiredFailureCode(row.failure_code) &&
    row.failure_code === binding.failureCode
  ) {
    return {
      mode: "failed_restart_required",
      outcome: "FAILED_RESTART_REQUIRED",
      attemptId: row.attempt_id,
      slug: row.slug,
      state: "FAILED_RESTART_REQUIRED",
      attemptVersion: row.attempt_version,
      retryCount: row.retry_count,
      commitCount: row.commit_count,
      failureCode: row.failure_code,
      failedAt: row.failed_at,
      expiresAt: row.expires_at,
    };
  }

  return { mode: "invalid_response" };
}

function normalizeRpcData(
  data: unknown,
  binding: EduPublishFailCommitBinding,
): EduPublishFailCommitRpcAdapterResult {
  try {
    if (!Array.isArray(data) || data.length !== 1) {
      return { mode: "invalid_response" };
    }

    const row = data[0];
    if (!isPlainObject(row) || !hasExactRpcRowKeys(row)) {
      return { mode: "invalid_response" };
    }
    if (!isKnownOutcome(row.outcome)) {
      return { mode: "invalid_response" };
    }

    if (
      row.outcome === "FAILED_RETRYABLE" ||
      row.outcome === "FAILED_RESTART_REQUIRED"
    ) {
      return normalizeSuccessfulRow(row, binding);
    }

    if (
      row.outcome === "LEASE_EXPIRED" ||
      row.outcome === "LEASE_MISMATCH" ||
      row.outcome === "VERSION_MISMATCH" ||
      row.outcome === "BINDING_MISMATCH" ||
      row.outcome === "STATE_CONFLICT" ||
      row.outcome === "INVALID_INPUT"
    ) {
      return hasNegativeOutcomeShape(row)
        ? { mode: "outcome", outcome: row.outcome }
        : { mode: "invalid_response" };
    }

    return { mode: "invalid_response" };
  } catch {
    return { mode: "invalid_response" };
  }
}

function normalizeRpcResult(
  rpcResult: unknown,
  binding: EduPublishFailCommitBinding,
): EduPublishFailCommitRpcAdapterResult {
  try {
    if (typeof rpcResult !== "object" || rpcResult === null) {
      return { mode: "rpc_error" };
    }
    if (
      (rpcResult as { error?: unknown }).error !== null &&
      (rpcResult as { error?: unknown }).error !== undefined
    ) {
      return { mode: "rpc_error" };
    }

    return normalizeRpcData((rpcResult as { data?: unknown }).data, binding);
  } catch {
    return { mode: "rpc_error" };
  }
}

export async function failEduPublishCommitViaRpc(
  input: unknown,
  dependencies?: FailEduPublishCommitRpcDependencies,
): Promise<EduPublishFailCommitRpcAdapterResult> {
  let validation: ReturnType<typeof validateEduPublishFailCommitBinding>;
  try {
    validation = validateEduPublishFailCommitBinding(input);
  } catch {
    return { mode: "outcome", outcome: "INVALID_INPUT" };
  }

  if (!validation.ok) return { mode: "outcome", outcome: "INVALID_INPUT" };

  const { binding } = validation;
  const args: FailRpcArgs = {
    p_attempt_id: binding.attemptId,
    p_slug: binding.slug,
    p_manifest_schema_version: binding.manifestSchemaVersion,
    p_declared_manifest_digest: binding.declaredManifestDigest,
    p_lease_owner: binding.leaseOwner,
    p_expected_attempt_version: binding.expectedAttemptVersion,
    p_failure_code: binding.failureCode,
  };

  let callRpcFn: FailRpcCaller;
  try {
    callRpcFn = dependencies?.callRpcFn ?? callFailCommitRpc;
  } catch {
    return { mode: "rpc_error" };
  }

  let rpcResult: FailRpcCallResult;
  try {
    rpcResult = await callRpcFn(EDU_PUBLISH_FAIL_COMMIT_RPC, args);
  } catch {
    return { mode: "rpc_error" };
  }

  return normalizeRpcResult(rpcResult, binding);
}
