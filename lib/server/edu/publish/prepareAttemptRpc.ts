import "server-only";

import {
  EDU_PUBLISH_PREPARE_ATTEMPT_OUTCOMES,
  validateEduPublishPrepareAttemptBinding,
  type EduPublishPrepareAttemptBinding,
  type EduPublishPrepareAttemptOutcome,
} from "@/lib/edu/publish/prepareAttemptContract";
import { createSupabaseAdminClient, type Database } from "@/lib/supabase/admin";

export const EDU_PUBLISH_PREPARE_ATTEMPT_RPC =
  "prepare_edu_publish_attempt_v1" as const;

type PrepareRpcArgs =
  Database["public"]["Functions"]["prepare_edu_publish_attempt_v1"]["Args"];

type PrepareRpcCallResult = {
  data: unknown;
  error: unknown;
};

export type PrepareRpcCaller = (
  rpcName: typeof EDU_PUBLISH_PREPARE_ATTEMPT_RPC,
  args: PrepareRpcArgs,
) => Promise<PrepareRpcCallResult>;

export type PrepareEduPublishAttemptRpcDependencies = {
  callRpcFn?: PrepareRpcCaller;
};

export type EduPublishPrepareAttemptRpcAdapterResult =
  | {
      mode: "success";
      outcome: "CREATED" | "ALREADY_PREPARED";
      attemptId: string;
      slug: string;
      state: "PREPARED";
      attemptVersion: number;
      expiresAt: string;
    }
  | {
      mode: "outcome";
      outcome:
        | "SLUG_CONFLICT"
        | "ATTEMPT_ID_CONFLICT"
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
  "expires_at",
]);

async function callPrepareAttemptRpc(
  rpcName: typeof EDU_PUBLISH_PREPARE_ATTEMPT_RPC,
  args: PrepareRpcArgs,
): Promise<PrepareRpcCallResult> {
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

function isKnownOutcome(value: unknown): value is EduPublishPrepareAttemptOutcome {
  return (
    typeof value === "string" &&
    (EDU_PUBLISH_PREPARE_ATTEMPT_OUTCOMES as readonly string[]).includes(value)
  );
}

function epochSecondsToIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  if (value > Number.MAX_SAFE_INTEGER / 1000) return null;

  const milliseconds = value * 1000;
  if (!Number.isSafeInteger(milliseconds)) return null;

  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime()) || date.getTime() !== milliseconds) return null;

  try {
    const iso = date.toISOString();
    return iso.endsWith(".000Z") ? iso : null;
  } catch {
    return null;
  }
}

function parseWholeSecondTimestamptzSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;

  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || !Number.isInteger(milliseconds) || milliseconds % 1000 !== 0) {
    return null;
  }

  return milliseconds / 1000;
}

function normalizeRpcData(
  data: unknown,
  binding: EduPublishPrepareAttemptBinding,
): EduPublishPrepareAttemptRpcAdapterResult {
  try {
    if (!Array.isArray(data) || data.length !== 1) return { mode: "invalid_response" };

    const row = data[0];
    if (!isPlainObject(row) || !hasExactRpcRowKeys(row)) return { mode: "invalid_response" };
    if (!isKnownOutcome(row.outcome)) return { mode: "invalid_response" };

    if (row.outcome === "CREATED" || row.outcome === "ALREADY_PREPARED") {
      if (
        typeof row.attempt_id !== "string" ||
        row.attempt_id !== binding.attemptId ||
        typeof row.slug !== "string" ||
        row.slug !== binding.slug ||
        row.state !== "PREPARED" ||
        typeof row.attempt_version !== "number" ||
        !Number.isSafeInteger(row.attempt_version) ||
        row.attempt_version < 0 ||
        typeof row.expires_at !== "string" ||
        parseWholeSecondTimestamptzSeconds(row.expires_at) !== binding.capabilityExpiresAtSeconds
      ) {
        return { mode: "invalid_response" };
      }

      return {
        mode: "success",
        outcome: row.outcome,
        attemptId: row.attempt_id,
        slug: row.slug,
        state: "PREPARED",
        attemptVersion: row.attempt_version,
        expiresAt: row.expires_at,
      };
    }

    if (
      row.outcome === "SLUG_CONFLICT" ||
      row.outcome === "ATTEMPT_ID_CONFLICT" ||
      row.outcome === "STATE_CONFLICT" ||
      row.outcome === "INVALID_INPUT"
    ) {
      if (
        row.attempt_id !== null ||
        row.slug !== null ||
        row.state !== null ||
        row.attempt_version !== null ||
        row.expires_at !== null
      ) {
        return { mode: "invalid_response" };
      }

      return { mode: "outcome", outcome: row.outcome };
    }

    return { mode: "invalid_response" };
  } catch {
    return { mode: "invalid_response" };
  }
}

export async function prepareEduPublishAttemptViaRpc(
  input: unknown,
  dependencies?: PrepareEduPublishAttemptRpcDependencies,
): Promise<EduPublishPrepareAttemptRpcAdapterResult> {
  let validation: ReturnType<typeof validateEduPublishPrepareAttemptBinding>;
  try {
    validation = validateEduPublishPrepareAttemptBinding(input);
  } catch {
    return { mode: "outcome", outcome: "INVALID_INPUT" };
  }

  if (!validation.ok) return { mode: "outcome", outcome: "INVALID_INPUT" };

  const { binding } = validation;
  let parsedManifest: unknown;
  let issuedAtIso: string | null;
  let expiresAtIso: string | null;
  try {
    parsedManifest = JSON.parse(binding.declaredManifestCanonicalJson);
    issuedAtIso = epochSecondsToIso(binding.capabilityIssuedAtSeconds);
    expiresAtIso = epochSecondsToIso(binding.capabilityExpiresAtSeconds);
  } catch {
    return { mode: "outcome", outcome: "INVALID_INPUT" };
  }

  if (issuedAtIso === null || expiresAtIso === null) {
    return { mode: "outcome", outcome: "INVALID_INPUT" };
  }

  const args: PrepareRpcArgs = {
    p_attempt_id: binding.attemptId,
    p_slug: binding.slug,
    p_lesson_id: binding.lessonId as PrepareRpcArgs["p_lesson_id"],
    p_manifest_schema_version: binding.manifestSchemaVersion,
    p_declared_manifest_digest: binding.declaredManifestDigest,
    p_declared_manifest: parsedManifest,
    p_capability_issued_at: issuedAtIso,
    p_capability_expires_at: expiresAtIso,
    p_capability_kid: binding.capabilityKid,
  };

  let callRpcFn: PrepareRpcCaller;
  try {
    callRpcFn = dependencies?.callRpcFn ?? callPrepareAttemptRpc;
  } catch {
    return { mode: "rpc_error" };
  }

  let rpcResult: PrepareRpcCallResult;
  try {
    rpcResult = await callRpcFn(EDU_PUBLISH_PREPARE_ATTEMPT_RPC, args);
  } catch {
    return { mode: "rpc_error" };
  }

  try {
    if (typeof rpcResult !== "object" || rpcResult === null) return { mode: "rpc_error" };
    if (rpcResult.error !== null && rpcResult.error !== undefined) return { mode: "rpc_error" };
    return normalizeRpcData(rpcResult.data, binding);
  } catch {
    return { mode: "rpc_error" };
  }
}
