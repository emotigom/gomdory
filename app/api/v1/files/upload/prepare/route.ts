import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { resolveEffectiveStorageQuota } from "@/lib/data/effectiveStorageQuota.server";
import { buildRandomObjectKey } from "@/lib/files/objectKey";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { presignPutUrl } from "@/lib/r2/client";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { isStorageQuotaExceeded } from "@/lib/storage/quota";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const BYTES_SAVED_SCHEMA_ERROR = /bytes_saved.+schema cache/i;

type PrepareBody = {
  boardId?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
  sha256?: string | null;
  originalBytes?: number | null;
  optimizedBytes?: number | null;
  optimization?: Record<string, unknown> | null;
};

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  presignPutUrlFn?: typeof presignPutUrl;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  resolveEffectiveStorageQuotaFn?: typeof resolveEffectiveStorageQuota;
};

type BoardFileRow = Database["public"]["Tables"]["board_files"]["Row"];
type BoardFileRowFallback = Omit<BoardFileRow, "bytes_saved">;

function resolveExt(filename: string | undefined): string | null {
  if (!filename) return null;
  const parts = filename.split(".");
  if (parts.length <= 1) return null;
  const ext = parts.pop()?.trim();
  return ext ? ext.toLowerCase() : null;
}

function isValidSha256(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

const BOARD_FILE_SELECT =
  "id, board_id, owner_id, r2_key, filename, bytes, mime, width, height, created_at, tags, is_favorite, last_used_at, deleted_at, hash_sha256, variant, original_bytes, optimized_bytes, bytes_saved";
const BOARD_FILE_SELECT_FALLBACK =
  "id, board_id, owner_id, r2_key, filename, bytes, mime, width, height, created_at, tags, is_favorite, last_used_at, deleted_at, hash_sha256, variant, original_bytes, optimized_bytes";

function isBytesSavedSchemaError(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes("bytes_saved") && BYTES_SAVED_SCHEMA_ERROR.test(message);
}

export async function POST(request: NextRequest, _context?: unknown, deps?: Dependencies) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const presign = deps?.presignPutUrlFn ?? presignPutUrl;
  const createSupabase = deps?.createSupabaseServerClientFn ?? createSupabaseServerClient;
  const requestId = getOrCreateRequestId(request);

  let ownerId: string | null = null;
  try {
    const { user } = await ensureUser();
    ownerId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }
  if (!ownerId) {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const subject = await getRateLimitSubject(request, null);
  const host = request.headers.get("host") ?? "unknown";
  const ownerIdPrefix = ownerId.slice(0, 8);
  let limitResult: { ok: true } | { ok: false; retryAfterSeconds: number } | null = null;
  try {
    limitResult = await checkRateLimit(
      createSupabaseAdminClient() as unknown as Parameters<typeof checkRateLimit>[0],
      {
        key: `uploadPrepare:${host}:${ownerIdPrefix}:${subject}`,
        windowSeconds: 10,
        limit: 20,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    void recordOpsEvent(
      {
        level: "warn",
        kind: "storage",
        request_id: requestId,
        route: request.nextUrl.pathname,
        status: 429,
        meta: {
          reason: "rateLimited",
          ownerIdPrefix,
          retryAfterSeconds: limitResult.retryAfterSeconds,
          keyHint: "uploadPrepare",
        },
      },
      { sampleRate: 1, hardLimitPerMinute: 60 },
    );

    return jsonErrorWithRequestId(
      "RATE_LIMITED",
      "rate_limited",
      requestId,
      429,
      { retryAfterSeconds: limitResult.retryAfterSeconds },
      withNoStoreHeaders({ headers: { "Retry-After": String(limitResult.retryAfterSeconds) } }),
    );
  }

  const payload = (await request.json().catch(() => null)) as PrepareBody | null;
  if (!payload?.filename || !payload.contentType) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  if (!payload.boardId) {
    return jsonErrorWithRequestId("BOARD_ID_REQUIRED", "boardId is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const sizeBytes = Number(payload.sizeBytes ?? 0);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return jsonErrorWithRequestId("INVALID_SIZE", "invalid_size", requestId, 400, undefined, withNoStoreHeaders());
  }

  if (sizeBytes > MAX_FILE_BYTES) {
    return jsonErrorWithRequestId("TOO_LARGE", "too_large", requestId, 413, undefined, withNoStoreHeaders());
  }

  const supabase = createSupabase();
  const { data: usageRow, error: usageError } = await supabase
    .from("storage_usage")
    .select("bytes_used")
    .eq("user_id", ownerId)
    .maybeSingle();

  if (usageError) {
    return jsonErrorWithRequestId("SUPABASE_ERROR", usageError.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  let quotaBytes: number;
  try {
    const effectiveQuota = await (deps?.resolveEffectiveStorageQuotaFn ?? resolveEffectiveStorageQuota)(
      ownerId,
      deps?.createSupabaseServerClientFn ? { supabaseClient: supabase } : undefined,
    );
    quotaBytes = effectiveQuota.quotaBytes;
  } catch (error) {
    const message = error instanceof Error ? error.message : "storage_quota_failed";
    return jsonErrorWithRequestId("SUPABASE_ERROR", message, requestId, 400, undefined, withNoStoreHeaders());
  }

  const usedBytes = Number(usageRow?.bytes_used ?? 0);
  const attemptBytes = sizeBytes;
  if (isStorageQuotaExceeded({ usedBytes, attemptBytes, quotaBytes })) {
    void recordOpsEvent(
      {
        level: "warn",
        kind: "storage",
        request_id: requestId,
        route: request.nextUrl.pathname,
        status: 409,
        meta: {
          reason: "quotaExceeded",
          ownerIdPrefix,
          usedBytes,
          quotaBytes,
          attemptBytes,
        },
      },
      { sampleRate: 1, hardLimitPerMinute: 60 },
    );

    return jsonErrorWithRequestId(
      "QUOTA_EXCEEDED",
      "quota_exceeded",
      requestId,
      409,
      { usedBytes, quotaBytes, attemptBytes },
      withNoStoreHeaders(),
    );
  }
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, owner_id")
    .eq("id", payload.boardId)
    .eq("owner_id", ownerId ?? "")
    .maybeSingle();

  if (boardError) {
    return jsonErrorWithRequestId("SUPABASE_ERROR", boardError.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  if (!board) {
    return jsonErrorWithRequestId("BOARD_NOT_FOUND", "board_not_found", requestId, 404, undefined, withNoStoreHeaders());
  }

  if (isValidSha256(payload.sha256 ?? null)) {
    let { data: existing, error: dedupeError } = await supabase
      .from("board_files")
      .select(BOARD_FILE_SELECT)
      .eq("owner_id", ownerId ?? "")
      .eq("hash_sha256", payload.sha256 ?? "")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<BoardFileRow>();

    if (dedupeError && isBytesSavedSchemaError(dedupeError.message)) {
      const fallbackResult = await supabase
        .from("board_files")
        .select(BOARD_FILE_SELECT_FALLBACK)
        .eq("owner_id", ownerId ?? "")
        .eq("hash_sha256", payload.sha256 ?? "")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<BoardFileRowFallback>();
      existing = fallbackResult.data ? { ...fallbackResult.data, bytes_saved: null } : null;
      dedupeError = fallbackResult.error;
    }

    if (dedupeError) {
      return jsonErrorWithRequestId("SUPABASE_ERROR", dedupeError.message, requestId, 400, undefined, withNoStoreHeaders());
    }

    if (existing) {
      return jsonOkWithRequestId({ deduped: true, existingFile: existing }, requestId, withNoStoreHeaders());
    }
  }

  const objectKey = buildRandomObjectKey({
    ownerId: ownerId ?? "",
    ext: resolveExt(payload.filename),
  });

  const uploadUrl = await presign({
    key: objectKey,
    contentType: payload.contentType,
    expiresSeconds: 900,
  });

  return jsonOkWithRequestId(
    {
      upload: {
        r2Key: objectKey,
        url: uploadUrl,
        headers: { "Content-Type": payload.contentType },
      },
    },
    requestId,
    withNoStoreHeaders(),
  );
}
