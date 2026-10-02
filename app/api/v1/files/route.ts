export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import {
  listBoardFileLibrary,
  softDeleteBoardFile,
  updateBoardFileMetadata,
  type BoardFileLibrarySort,
} from "@/lib/data/boardFiles";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { parseFilesListParams } from "@/lib/api/files/listParams";
import { normalizeFileTags } from "@/lib/files/normalizeTags";
import { recordOpsEvent } from "@/lib/ops/recordEvent";
import { routes } from "@/lib/standards/routes";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  listBoardFileLibraryFn?: typeof listBoardFileLibrary;
  updateBoardFileMetadataFn?: typeof updateBoardFileMetadata;
  softDeleteBoardFileFn?: typeof softDeleteBoardFile;
  recordOpsEventFn?: typeof recordOpsEvent;
};

export async function GET(request: NextRequest, _context?: unknown, deps?: Dependencies) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const listFiles = deps?.listBoardFileLibraryFn ?? listBoardFileLibrary;
  const requestId = getOrCreateRequestId(request);

  try {
    await ensureUser();
  } catch {
    return jsonErrorWithRequestId(
      "UNAUTHORIZED",
      "Authentication required.",
      requestId,
      401,
      undefined,
      withNoStoreHeaders(),
    );
  }

  const { q, tag, boardId, type, cursor, limit, sort } = parseFilesListParams(request.nextUrl.searchParams);

  try {
    const result = await listFiles({
      query: q,
      tag,
      boardId,
      type,
      sort: sort as BoardFileLibrarySort,
      cursor,
      limit,
    });
    const items = result.items.map((file) => ({
      ...file,
      fileId: file.id,
      name: file.filename,
      mimeType: file.mime,
      sizeBytes: file.bytes,
      createdAt: file.created_at,
      url: routes.api.files.view(file.id),
      thumbUrl: file.mime?.startsWith("image/") ? routes.api.files.view(file.id) : null,
      tags: file.tags ?? [],
    }));
    return jsonOkWithRequestId({ items, nextCursor: result.nextCursor }, requestId, withNoStoreHeaders());
  } catch (error) {
    const message = error instanceof Error ? error.message : "파일을 불러오지 못했습니다.";
    return jsonErrorWithRequestId("FILES_UNAVAILABLE", message, requestId, 500, undefined, withNoStoreHeaders());
  }
}

export async function PATCH(request: NextRequest, _context?: unknown, deps?: Dependencies) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const updateFile = deps?.updateBoardFileMetadataFn ?? updateBoardFileMetadata;
  const logOps = deps?.recordOpsEventFn ?? recordOpsEvent;
  const requestId = getOrCreateRequestId(request);

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const payload = (await request.json().catch(() => null)) as
    | { fileId?: string; title?: string | null; tags?: string[] | null }
    | null;

  if (!payload?.fileId) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  const title =
    typeof payload.title === "string" && payload.title.trim().length > 0 ? payload.title.trim() : null;

  let tags: string[] | null | undefined = payload.tags ?? undefined;
  if (Array.isArray(payload.tags)) {
    const normalized = normalizeFileTags(payload.tags);
    if (normalized.invalid) {
      return jsonErrorWithRequestId("INVALID_TAGS", "invalid_tags", requestId, 400, undefined, withNoStoreHeaders());
    }
    tags = normalized.tags;
  }

  if (title === null && typeof tags === "undefined") {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  try {
    const updated = await updateFile({
      fileId: payload.fileId,
      ownerId: userId ?? "",
      tags,
      filename: title ?? undefined,
    });
    void logOps({
      level: "info",
      kind: "api_access",
      requestId,
      route: request.nextUrl.pathname,
      status: 200,
      meta: { action: "files.patch", fileId: payload.fileId },
    });
    return jsonOkWithRequestId({ item: updated }, requestId, withNoStoreHeaders());
  } catch (error) {
    const message = error instanceof Error ? error.message : "파일 정보를 업데이트하지 못했습니다.";
    void logOps({
      level: "warn",
      kind: "api_error",
      requestId,
      route: request.nextUrl.pathname,
      status: 400,
      meta: { action: "files.patch", fileId: payload.fileId, message },
    });
    return jsonErrorWithRequestId("FILES_UPDATE_FAILED", message, requestId, 400, undefined, withNoStoreHeaders());
  }
}

export async function DELETE(request: NextRequest, _context?: unknown, deps?: Dependencies) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const deleteFile = deps?.softDeleteBoardFileFn ?? softDeleteBoardFile;
  const requestId = getOrCreateRequestId(request);

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const payload = (await request.json().catch(() => null)) as { fileId?: string } | null;
  if (!payload?.fileId) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400, undefined, withNoStoreHeaders());
  }

  try {
    const deletedFile = await deleteFile({ fileId: payload.fileId, ownerId: userId ?? "" });
    if (!deletedFile) {
      return jsonErrorWithRequestId("NOT_FOUND", "not_found", requestId, 404, undefined, withNoStoreHeaders());
    }
    return jsonOkWithRequestId({}, requestId, withNoStoreHeaders());
  } catch (error) {
    const message = error instanceof Error ? error.message : "파일을 삭제하지 못했습니다.";
    return jsonErrorWithRequestId("FILES_DELETE_FAILED", message, requestId, 400, undefined, withNoStoreHeaders());
  }
}
