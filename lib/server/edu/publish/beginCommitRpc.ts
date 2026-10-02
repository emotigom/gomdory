import "server-only";

import {
  EDU_PUBLISH_BEGIN_COMMIT_OUTCOMES,
  validateEduPublishBeginCommitBinding,
  type EduPublishBeginCommitBinding,
  type EduPublishBeginCommitOutcome,
} from "@/lib/edu/publish/beginCommitContract";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";

export const EDU_PUBLISH_BEGIN_COMMIT_RPC =
  "begin_edu_publish_commit_v1" as const;

type BeginRpcArgs =
  Database["public"]["Functions"][typeof EDU_PUBLISH_BEGIN_COMMIT_RPC]["Args"];

type BeginRpcCallResult = {
  data: unknown;
  error: unknown;
};

export type BeginRpcCaller = (
  rpcName: typeof EDU_PUBLISH_BEGIN_COMMIT_RPC,
  args: BeginRpcArgs,
) => Promise<BeginRpcCallResult>;

export type BeginEduPublishCommitRpcDependencies = {
  callRpcFn?: BeginRpcCaller;
};

export type EduPublishBeginCommitRpcAdapterResult =
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
        | "RETRY_EXHAUSTED"
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
  "lease_expires_at",
  "expires_at",
  "project_id",
]);

const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function callBeginCommitRpc(
  rpcName: typeof EDU_PUBLISH_BEGIN_COMMIT_RPC,
  args: BeginRpcArgs,
): Promise<BeginRpcCallResult> {
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

function isKnownOutcome(value: unknown): value is EduPublishBeginCommitOutcome {
  return (
    typeof value === "string" &&
    (EDU_PUBLISH_BEGIN_COMMIT_OUTCOMES as readonly string[]).includes(value)
  );
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID.test(value);
}

function parseWholeSecondTimestamptzSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;

  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds) ||
    !Number.isInteger(milliseconds) ||
    milliseconds % 1000 !== 0
  ) {
    return null;
  }

  return milliseconds / 1000;
}

function hasNegativeOutcomeShape(row: RpcRow): boolean {
  return (
    row.attempt_id === null &&
    row.slug === null &&
    row.state === null &&
    row.attempt_version === null &&
    row.retry_count === null &&
    row.commit_count === null &&
    row.lease_expires_at === null &&
    row.expires_at === null &&
    row.project_id === null
  );
}

function normalizeRpcData(
  data: unknown,
  binding: EduPublishBeginCommitBinding,
): EduPublishBeginCommitRpcAdapterResult {
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
      row.outcome === "CLAIMED" ||
      row.outcome === "RECLAIMED_RETRYABLE" ||
      row.outcome === "TAKEN_OVER_STALE_LEASE"
    ) {
      const leaseExpiresAtSeconds = parseWholeSecondTimestamptzSeconds(
        row.lease_expires_at,
      );
      const expiresAtSeconds = parseWholeSecondTimestamptzSeconds(row.expires_at);

      if (
        !isCanonicalUuid(row.attempt_id) ||
        row.attempt_id !== binding.attemptId ||
        typeof row.slug !== "string" ||
        row.slug !== binding.slug ||
        row.state !== "VALIDATING" ||
        !isNonNegativeSafeInteger(row.attempt_version) ||
        !isNonNegativeSafeInteger(row.retry_count) ||
        !isNonNegativeSafeInteger(row.commit_count) ||
        typeof row.lease_expires_at !== "string" ||
        leaseExpiresAtSeconds === null ||
        typeof row.expires_at !== "string" ||
        expiresAtSeconds === null ||
        leaseExpiresAtSeconds > expiresAtSeconds ||
        row.project_id !== null
      ) {
        return { mode: "invalid_response" };
      }

      return {
        mode: "claimed",
        outcome: row.outcome,
        attemptId: row.attempt_id,
        slug: row.slug,
        state: "VALIDATING",
        attemptVersion: row.attempt_version,
        retryCount: row.retry_count,
        commitCount: row.commit_count,
        leaseExpiresAt: row.lease_expires_at,
        expiresAt: row.expires_at,
      };
    }

    if (row.outcome === "ALREADY_PUBLISHED") {
      if (
        !isCanonicalUuid(row.attempt_id) ||
        row.attempt_id !== binding.attemptId ||
        typeof row.slug !== "string" ||
        row.slug !== binding.slug ||
        row.state !== "PUBLISHED" ||
        !isNonNegativeSafeInteger(row.attempt_version) ||
        !isNonNegativeSafeInteger(row.retry_count) ||
        !isNonNegativeSafeInteger(row.commit_count) ||
        row.lease_expires_at !== null ||
        typeof row.expires_at !== "string" ||
        parseWholeSecondTimestamptzSeconds(row.expires_at) === null ||
        !isCanonicalUuid(row.project_id)
      ) {
        return { mode: "invalid_response" };
      }

      return {
        mode: "published",
        outcome: "ALREADY_PUBLISHED",
        attemptId: row.attempt_id,
        slug: row.slug,
        state: "PUBLISHED",
        attemptVersion: row.attempt_version,
        retryCount: row.retry_count,
        commitCount: row.commit_count,
        expiresAt: row.expires_at,
        projectId: row.project_id,
      };
    }

    if (
      row.outcome === "LEASE_ACTIVE" ||
      row.outcome === "ATTEMPT_EXPIRED" ||
      row.outcome === "BINDING_MISMATCH" ||
      row.outcome === "STATE_CONFLICT" ||
      row.outcome === "RETRY_EXHAUSTED" ||
      row.outcome === "INVALID_INPUT"
    ) {
      if (!hasNegativeOutcomeShape(row)) {
        return { mode: "invalid_response" };
      }

      return { mode: "outcome", outcome: row.outcome };
    }

    return { mode: "invalid_response" };
  } catch {
    return { mode: "invalid_response" };
  }
}

function normalizeRpcResult(
  rpcResult: unknown,
  binding: EduPublishBeginCommitBinding,
): EduPublishBeginCommitRpcAdapterResult {
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
    return { mode: "invalid_response" };
  }
}

export async function beginEduPublishCommitViaRpc(
  input: unknown,
  dependencies?: BeginEduPublishCommitRpcDependencies,
): Promise<EduPublishBeginCommitRpcAdapterResult> {
  let validation: ReturnType<typeof validateEduPublishBeginCommitBinding>;
  try {
    validation = validateEduPublishBeginCommitBinding(input);
  } catch {
    return { mode: "outcome", outcome: "INVALID_INPUT" };
  }

  if (!validation.ok) return { mode: "outcome", outcome: "INVALID_INPUT" };

  const { binding } = validation;
  const args: BeginRpcArgs = {
    p_attempt_id: binding.attemptId,
    p_slug: binding.slug,
    p_manifest_schema_version: binding.manifestSchemaVersion,
    p_declared_manifest_digest: binding.declaredManifestDigest,
    p_lease_owner: binding.leaseOwner,
  };

  let callRpcFn: BeginRpcCaller;
  try {
    callRpcFn = dependencies?.callRpcFn ?? callBeginCommitRpc;
  } catch {
    return { mode: "rpc_error" };
  }

  let rpcResult: BeginRpcCallResult;
  try {
    rpcResult = await callRpcFn(EDU_PUBLISH_BEGIN_COMMIT_RPC, args);
  } catch {
    return { mode: "rpc_error" };
  }

  return normalizeRpcResult(rpcResult, binding);
}
