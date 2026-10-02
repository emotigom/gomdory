import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { computeContractHash } from "@/lib/contracts/contractHash";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { buildObjectKey } from "@/lib/files/objectKey";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { presignPutUrl } from "@/lib/r2/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 200 * 1024 * 1024;

type PrepareBody = {
  boardId?: string;
  filename?: string;
  mime?: string;
  bytesOriginal?: number;
  bytesStored?: number;
  contentHash?: string;
  width?: number;
  height?: number;
  optimized?: boolean;
};

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  presignPutUrlFn?: typeof presignPutUrl;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
};

function isValidHash(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function resolveExt(filename: string | undefined): string | null {
  if (!filename) return null;
  const parts = filename.split(".");
  if (parts.length <= 1) return null;
  const ext = parts.pop()?.trim();
  return ext ? ext.toLowerCase() : null;
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

  const payload = (await request.json().catch(() => null)) as PrepareBody | null;
  if (!payload || !isValidHash(payload.contentHash)) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  if (!payload.boardId) {
    return jsonErrorWithRequestId("BOARD_ID_REQUIRED", "boardId is required", requestId, 400, undefined, withNoStoreHeaders());
  }

  const bytesOriginal = Number(payload.bytesOriginal ?? 0);
  const bytesStored = Number(payload.bytesStored ?? 0);
  if (!Number.isFinite(bytesOriginal) || !Number.isFinite(bytesStored) || bytesStored < 0 || bytesOriginal < 0) {
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
  const { data: existing, error } = await supabase
    .from("board_files")
    .select("id, r2_key, bytes")
    .eq("owner_id", ownerId ?? "")
    .eq("hash_sha256", payload.contentHash)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return jsonErrorWithRequestId("SUPABASE_ERROR", error.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  if (existing?.r2_key) {
    const data = {
      reuse: true,
      existing: {
        objectKey: existing.r2_key,
        bytesStored: existing.bytes,
      },
    };
    const schemaVersion = SCHEMA_VERSIONS.filesPrepare;
    const contractHash = computeContractHash(data);
    return jsonOkWithRequestId(
      {
        schemaVersion,
        contractHash,
        ...data,
      },
      requestId,
      withNoStoreHeaders(),
    );
  }

  const objectKey = buildObjectKey({
    ownerId: ownerId ?? "",
    hash: payload.contentHash,
    ext: resolveExt(payload.filename),
  });

  const uploadUrl = await presign({
    key: objectKey,
    contentType: payload.mime ?? "application/octet-stream",
    expiresSeconds: 900,
  });

  const data = {
    reuse: false,
    upload: {
      url: uploadUrl,
      method: "PUT",
      headers: { "Content-Type": payload.mime ?? "application/octet-stream" },
      objectKey,
    },
  };
  const schemaVersion = SCHEMA_VERSIONS.filesPrepare;
  const contractHash = computeContractHash(data);

  return jsonOkWithRequestId(
    { schemaVersion, contractHash, ...data },
    requestId,
    withNoStoreHeaders(),
  );
}
