export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { BOARD_FILE_SELECT, softDeleteBoardFile, updateBoardFileMetadata } from "@/lib/data/boardFiles";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { computeContractHash } from "@/lib/contracts/contractHash";
import { SCHEMA_VERSIONS } from "@/lib/contracts/schemaVersion";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { routes } from "@/lib/standards/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  updateBoardFileMetadataFn?: typeof updateBoardFileMetadata;
  softDeleteBoardFileFn?: typeof softDeleteBoardFile;
  createSupabaseClientFn?: typeof createSupabaseServerClient;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
  deps?: Dependencies,
) {
  const requestId = getOrCreateRequestId(request);
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const createSupabase = deps?.createSupabaseClientFn ?? createSupabaseServerClient;

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401);
  }

  try {
    const { fileId } = await params;
    const supabase = createSupabase();
    const { data: fileRow, error } = await supabase
      .from("board_files")
      .select(BOARD_FILE_SELECT)
      .eq("id", fileId)
      .eq("owner_id", userId ?? "")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!fileRow) {
      return jsonErrorWithRequestId("NOT_FOUND", "not_found", requestId, 404);
    }

    const item = {
      ...fileRow,
      fileId: fileRow.id,
      name: fileRow.filename,
      mimeType: fileRow.mime,
      sizeBytes: fileRow.bytes,
      createdAt: fileRow.created_at,
      url: routes.api.files.view(fileRow.id),
      thumbUrl: fileRow.mime?.startsWith("image/") ? routes.api.files.view(fileRow.id) : null,
      tags: fileRow.tags ?? [],
    };
    const data = { item };
    const schemaVersion = SCHEMA_VERSIONS.filesMeta;
    const contractHash = computeContractHash(data);
    return jsonOkWithRequestId({ schemaVersion, contractHash, ...data }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "파일 정보를 불러오지 못했습니다.";
    return jsonErrorWithRequestId("FILE_FETCH_FAILED", message, requestId, 400);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
  deps?: Dependencies,
) {
  const requestId = getOrCreateRequestId(request);
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const updateFile = deps?.updateBoardFileMetadataFn ?? updateBoardFileMetadata;

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401);
  }

  const payload = (await request.json().catch(() => null)) as
    | { tags?: string[]; is_favorite?: boolean }
    | null;

  if (!payload) {
    return jsonErrorWithRequestId("INVALID_PAYLOAD", "invalid_payload", requestId, 400);
  }

  try {
    const { fileId } = await params;
    const updated = await updateFile({
      fileId,
      ownerId: userId ?? "",
      tags: payload.tags,
      isFavorite: payload.is_favorite,
    });
    return jsonOkWithRequestId({ item: updated }, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "파일 정보를 업데이트하지 못했습니다.";
    return jsonErrorWithRequestId("UPDATE_FAILED", message, requestId, 400);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
  deps?: Dependencies,
) {
  const requestId = getOrCreateRequestId(request);
  const route = new URL(request.url).pathname;
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const deleteFile = deps?.softDeleteBoardFileFn ?? softDeleteBoardFile;

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401);
  }

  try {
    const { fileId } = await params;
    const deletedFile = await deleteFile({ fileId, ownerId: userId ?? "", requestId, route, method: "DELETE" });
    if (!deletedFile) {
      return jsonErrorWithRequestId("NOT_FOUND", "not_found", requestId, 404);
    }
    if (deletedFile.board_id) {
      void logAudit({
        boardId: deletedFile.board_id,
        action: "file.deleted",
        targetType: "file",
        targetId: fileId,
        meta: { filename: deletedFile.filename },
      });
    }
    return jsonOkWithRequestId({}, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "파일을 삭제하지 못했습니다.";
    return jsonErrorWithRequestId("DELETE_FAILED", message, requestId, 400);
  }
}
