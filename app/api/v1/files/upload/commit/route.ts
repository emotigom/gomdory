import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { resolveEffectiveStorageQuota } from "@/lib/data/effectiveStorageQuota.server";
import {
  boardFilesBytesSavedColumn,
  buildBoardFilesInsertPayload,
  buildBoardFilesSelect,
  buildBoardFilesSelectFallback,
} from "@/lib/db/boardFilesPayload";
import { filesOwnerIdColumn } from "@/lib/db/filesInsertPayload";
import { buildFilesInsertPayload } from "@/lib/files/buildFilesInsertPayload";
import { isObjectKeyOwnedBy } from "@/lib/files/objectKey";
import { requestIdKey } from "@/lib/db/snakeCaseKeys";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { checkRateLimit } from "@/lib/safety/rateLimit";
import { getRateLimitSubject } from "@/lib/safety/rateLimitSubject";
import { isStorageQuotaExceeded } from "@/lib/storage/quota";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const BYTES_SAVED_SCHEMA_ERROR = /bytes.+saved.+schema cache/i;

type CommitBody = {
  boardId?: string;
  r2Key?: string;
  originalName?: string;
  contentType?: string;
  sizeBytes?: number;
  tags?: string[];
  sha256?: string | null;
  originalBytes?: number | null;
  optimizedBytes?: number | null;
  optimization?: Record<string, unknown> | null;
};

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  resolveEffectiveStorageQuotaFn?: typeof resolveEffectiveStorageQuota;
};

type BoardFileRow = Database["public"]["Tables"]["board_files"]["Row"];
type BoardFileRowFallback = Omit<BoardFileRow, typeof boardFilesBytesSavedColumn>;

function withBytesSaved(row: BoardFileRowFallback | null, bytesSaved: number): BoardFileRow | null {
  if (!row) return null;
  return { ...row, [boardFilesBytesSavedColumn]: bytesSaved } as BoardFileRow;
}

function isBytesSavedSchemaError(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes(boardFilesBytesSavedColumn) && BYTES_SAVED_SCHEMA_ERROR.test(message);
}

function omitBytesSaved<T extends Record<string, unknown>>(value: T): Omit<T, typeof boardFilesBytesSavedColumn> {
  const copy = { ...value };
  delete (copy as Record<string, unknown>)[boardFilesBytesSavedColumn];
  return copy as Omit<T, typeof boardFilesBytesSavedColumn>;
}

export async function POST(request: NextRequest, _context?: unknown, deps?: Dependencies) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const createSupabase = deps?.createSupabaseServerClientFn ?? createSupabaseServerClient;
  const requestId = getOrCreateRequestId(request);
  const route = request.nextUrl.pathname;
  const method = request.method;

  const logStandardizedFileEvent = (input: {
    fileId?: string | null;
    ownerId: string;
    status: number;
    code: string;
    extra?: Record<string, unknown>;
  }) => {
    console.info(
      JSON.stringify({
        requestId,
        fileId: input.fileId ?? null,
        ownerId: input.ownerId,
        route,
        method,
        status: input.status,
        code: input.code,
        ...(input.extra ?? {}),
      }),
    );
  };

  let ownerId: string | null = null;
  try {
    const { user } = await ensureUser();
    ownerId = user.id;
  } catch {
    logStandardizedFileEvent({ ownerId: "", status: 401, code: "UNAUTHORIZED" });
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }
  if (!ownerId) {
    logStandardizedFileEvent({ ownerId: "", status: 401, code: "UNAUTHORIZED" });
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
        key: `uploadCommit:${host}:${ownerIdPrefix}:${subject}`,
        windowSeconds: 10,
        limit: 10,
      },
    );
  } catch {
    limitResult = null;
  }

  if (limitResult && !limitResult.ok) {
    logStandardizedFileEvent({
      ownerId,
      status: 429,
      code: "RATE_LIMITED",
    });
    void recordOpsEvent(
      {
        level: "warn",
        kind: "storage",
        [requestIdKey]: requestId,
        route: request.nextUrl.pathname,
        status: 429,
        meta: {
          reason: "rateLimited",
          ownerIdPrefix,
          retryAfterSeconds: limitResult.retryAfterSeconds,
          keyHint: "uploadCommit",
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

  const payload = (await request.json().catch(() => null)) as CommitBody | null;
  if (!payload?.r2Key || !payload.originalName || !payload.contentType) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  if (!isObjectKeyOwnedBy(payload.r2Key, ownerId)) {
    return jsonErrorWithRequestId(
      "INVALID_OBJECT_KEY",
      "object_key_not_owned",
      requestId,
      403,
      undefined,
      withNoStoreHeaders(),
    );
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

  const originalBytes = Number(payload.originalBytes ?? sizeBytes);
  const optimizedBytes = Number(payload.optimizedBytes ?? sizeBytes);
  if (!Number.isFinite(originalBytes) || originalBytes <= 0) {
    return jsonErrorWithRequestId(
      "INVALID_ORIGINAL_SIZE",
      "invalid_original_size",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }
  if (!Number.isFinite(optimizedBytes) || optimizedBytes <= 0) {
    return jsonErrorWithRequestId(
      "INVALID_OPTIMIZED_SIZE",
      "invalid_optimized_size",
      requestId,
      400,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const bytesSaved = Math.max(0, originalBytes - optimizedBytes);

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
  const attemptBytes = optimizedBytes;
  if (isStorageQuotaExceeded({ usedBytes, attemptBytes, quotaBytes })) {
    logStandardizedFileEvent({
      ownerId,
      status: 409,
      code: "QUOTA_EXCEEDED",
    });
    void recordOpsEvent(
      {
        level: "warn",
        kind: "storage",
        [requestIdKey]: requestId,
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

  let fileRecordId: string | null = null;

  try {
    const fileInsert = buildFilesInsertPayload({
      ownerId,
      boardId: payload.boardId,
      r2Key: payload.r2Key,
      originalName: payload.originalName,
      contentType: payload.contentType,
      optimizedBytes,
      originalBytes,
      sha256: payload.sha256 ?? null,
      tags: payload.tags ?? [],
    });

    const { data: fileRecord, error: fileRecordError } = await supabase
      .from("files")
      .insert(fileInsert)
      .select("id")
      .single();

    if (fileRecordError) {
      console.warn(
        JSON.stringify({
          stage: "board_files_file_index_insert_failed",
          message: fileRecordError.message,
        }),
      );
    } else {
      fileRecordId = fileRecord?.id ?? null;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.warn(
      JSON.stringify({
        stage: "board_files_file_index_insert_failed",
        message,
      }),
    );
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select(`id, ${filesOwnerIdColumn}`)
    .eq("id", payload.boardId)
    .eq(filesOwnerIdColumn, ownerId ?? "")
    .maybeSingle();

  if (boardError) {
    return jsonErrorWithRequestId("SUPABASE_ERROR", boardError.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  if (!board) {
    return jsonErrorWithRequestId("BOARD_NOT_FOUND", "board_not_found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const boardFileBase = buildBoardFilesInsertPayload({
    ownerIdColumn: filesOwnerIdColumn,
    boardId: payload.boardId,
    ownerId,
    r2Key: payload.r2Key,
    originalName: payload.originalName,
    optimizedBytes,
    contentType: payload.contentType,
    tags: payload.tags ?? [],
    sha256: payload.sha256 ?? null,
    originalBytes,
    bytesSaved,
    fileRecordId: null,
  });
  const boardFileInsert = buildBoardFilesInsertPayload({
    ownerIdColumn: filesOwnerIdColumn,
    boardId: payload.boardId,
    ownerId,
    r2Key: payload.r2Key,
    originalName: payload.originalName,
    optimizedBytes,
    contentType: payload.contentType,
    tags: payload.tags ?? [],
    sha256: payload.sha256 ?? null,
    originalBytes,
    bytesSaved,
    fileRecordId,
  });
  const boardFileSelect = buildBoardFilesSelect(filesOwnerIdColumn);
  const boardFileSelectFallback = buildBoardFilesSelectFallback(filesOwnerIdColumn);
  const insertResult = await supabase
    .from("board_files")
    .insert(boardFileInsert)
    .select(boardFileSelect)
    .single<BoardFileRow>();
  let fileRow: BoardFileRow | null = insertResult.data;
  let insertError = insertResult.error;

  if (insertError && isBytesSavedSchemaError(insertError.message)) {
    logStandardizedFileEvent({
      ownerId,
      fileId: fileRecordId,
      status: 200,
      code: "BOARD_FILES_INSERT_BYTES_SAVED_FALLBACK",
      extra: { softDeleteFallbackUsed: true },
    });
    const fallbackResult = await supabase
      .from("board_files")
      .insert(omitBytesSaved(boardFileInsert))
      .select(boardFileSelectFallback)
      .single<BoardFileRowFallback>();
    fileRow = withBytesSaved(fallbackResult.data, bytesSaved);
    insertError = fallbackResult.error;
  }

  if (insertError && fileRecordId) {
    console.warn(
      JSON.stringify({
        stage: "board_files_insert_fallback",
        message: insertError.message,
        code: insertError.code ?? null,
      }),
    );
    const fallbackResult = await supabase
      .from("board_files")
      .insert(boardFileBase)
      .select(boardFileSelect)
      .single<BoardFileRow>();
    fileRow = fallbackResult.data;
    insertError = fallbackResult.error;
  }

  if (insertError && isBytesSavedSchemaError(insertError.message)) {
    logStandardizedFileEvent({
      ownerId,
      fileId: fileRecordId,
      status: 200,
      code: "BOARD_FILES_BASE_BYTES_SAVED_FALLBACK",
      extra: { softDeleteFallbackUsed: true },
    });
    const fallbackResult = await supabase
      .from("board_files")
      .insert(omitBytesSaved(boardFileBase))
      .select(boardFileSelectFallback)
      .single<BoardFileRowFallback>();
    fileRow = withBytesSaved(fallbackResult.data, bytesSaved);
    insertError = fallbackResult.error;
  }

  if (insertError) {
    logStandardizedFileEvent({
      ownerId,
      fileId: fileRecordId,
      status: 400,
      code: "SUPABASE_ERROR",
    });
    return jsonErrorWithRequestId("SUPABASE_ERROR", insertError.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  logStandardizedFileEvent({
    ownerId,
    fileId: fileRow?.id ?? fileRecordId,
    status: 200,
    code: "OK",
  });

  return jsonOkWithRequestId({ file: fileRow }, requestId, withNoStoreHeaders());
}
