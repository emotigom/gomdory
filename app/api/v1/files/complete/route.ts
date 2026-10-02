import { NextRequest } from "next/server";

import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { headObject } from "@/lib/r2/client";
import type { Database } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 200 * 1024 * 1024;
const BYTES_SAVED_SCHEMA_ERROR = /bytes_saved.+schema cache/i;

type CompleteBody = {
  boardId?: string;
  objectKey?: string;
  filename?: string;
  mime?: string;
  bytesOriginal?: number;
  bytesStored?: number;
  contentHash?: string;
  width?: number;
  height?: number;
  optimized?: boolean;
  dedupReused?: boolean;
};

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  headObjectFn?: typeof headObject;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
};

type BoardFileRow = Database["public"]["Tables"]["board_files"]["Row"];
type BoardFileRowFallback = Omit<BoardFileRow, "bytes_saved">;

function isValidHash(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function safeNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isBytesSavedSchemaError(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes("bytes_saved") && BYTES_SAVED_SCHEMA_ERROR.test(message);
}

function omitBytesSaved<T extends Record<string, unknown>>(value: T): Omit<T, "bytes_saved"> {
  const copy = { ...value };
  delete (copy as { bytes_saved?: unknown }).bytes_saved;
  return copy;
}

export async function POST(request: NextRequest, _context?: unknown, deps?: Dependencies) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const head = deps?.headObjectFn ?? headObject;
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

  const payload = (await request.json().catch(() => null)) as CompleteBody | null;
  if (!payload || !payload.objectKey || !payload.filename || !payload.mime || !isValidHash(payload.contentHash)) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  if (!payload.boardId) {
    return jsonErrorWithRequestId("BOARD_ID_REQUIRED", "boardId is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const bytesOriginal = safeNumber(payload.bytesOriginal);
  let bytesStored = safeNumber(payload.bytesStored);

  if (bytesStored < 0 || bytesOriginal < 0) {
    return jsonErrorWithRequestId("INVALID_BYTES", "invalid_bytes", requestId, 400, undefined, withNoStoreHeaders());
  }

  if (bytesStored > MAX_FILE_BYTES || bytesOriginal > MAX_FILE_BYTES) {
    return jsonErrorWithRequestId("TOO_LARGE", "too_large", requestId, 413, undefined, withNoStoreHeaders());
  }

  const supabase = createSupabase();
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

  if (!payload.dedupReused) {
    const headResult = await head(payload.objectKey);
    if (!headResult.exists) {
      return jsonErrorWithRequestId("UPLOAD_MISSING", "upload_missing", requestId, 400, undefined, withNoStoreHeaders());
    }
    if (typeof headResult.contentLength === "number" && Number.isFinite(headResult.contentLength)) {
      bytesStored = headResult.contentLength;
    }
  }

  const bytesSaved = Math.max(0, bytesOriginal - bytesStored);
  const boardFileSelect =
    "id, board_id, owner_id, r2_key, filename, bytes, mime, width, height, created_at, tags, is_favorite, last_used_at, deleted_at, hash_sha256, variant, original_bytes, optimized_bytes, bytes_saved";
  const boardFileSelectFallback =
    "id, board_id, owner_id, r2_key, filename, bytes, mime, width, height, created_at, tags, is_favorite, last_used_at, deleted_at, hash_sha256, variant, original_bytes, optimized_bytes";
  const boardFileInsert = {
    board_id: payload.boardId,
    owner_id: ownerId,
    inserted_by: ownerId,
    r2_key: payload.objectKey,
    filename: payload.filename,
    bytes: bytesStored,
    mime: payload.mime,
    width: payload.width ?? null,
    height: payload.height ?? null,
    hash_sha256: payload.contentHash,
    variant: "optimized",
    original_bytes: bytesOriginal,
    optimized_bytes: bytesStored,
    bytes_saved: bytesSaved,
  };
  const insertResult = await supabase
    .from("board_files")
    .insert(boardFileInsert)
    .select(boardFileSelect)
    .single<BoardFileRow>();
  let fileRow: BoardFileRow | null = insertResult.data;
  let insertError = insertResult.error;

  if (insertError && isBytesSavedSchemaError(insertError.message)) {
    const fallbackResult = await supabase
      .from("board_files")
      .insert(omitBytesSaved(boardFileInsert))
      .select(boardFileSelectFallback)
      .single<BoardFileRowFallback>();
    fileRow = fallbackResult.data ? { ...fallbackResult.data, bytes_saved: bytesSaved } : null;
    insertError = fallbackResult.error;
  }

  if (insertError) {
    return jsonErrorWithRequestId("SUPABASE_ERROR", insertError.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  return jsonOkWithRequestId({ file: fileRow }, requestId, withNoStoreHeaders());
}
