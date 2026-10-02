import { requireUserApi } from "@/lib/auth/requireUserApi";
import { softDeleteBoardFile } from "@/lib/data/boardFiles";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { deleteObject } from "@/lib/r2/client";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  softDeleteBoardFileFn?: typeof softDeleteBoardFile;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
  deps?: Dependencies,
) {
  const requestId = getOrCreateRequestId(request);
  const route = new URL(request.url).pathname;
  const method = "POST";
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const deleteFile = deps?.softDeleteBoardFileFn ?? softDeleteBoardFile;

  const logStandardizedFileEvent = (input: { fileId: string; ownerId: string; status: number; code: string }) => {
    console.info(
      JSON.stringify({
        requestId,
        fileId: input.fileId,
        ownerId: input.ownerId,
        route,
        method,
        status: input.status,
        code: input.code,
      }),
    );
  };

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    const { fileId } = await params;
    logStandardizedFileEvent({ fileId, ownerId: userId ?? "", status: 401, code: "UNAUTHORIZED" });
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401);
  }

  try {
    const { fileId } = await params;
    const deletedFile = await deleteFile({ fileId, ownerId: userId ?? "", requestId, route, method, status: 200, code: "OK" });
    if (!deletedFile) {
      logStandardizedFileEvent({ fileId, ownerId: userId ?? "", status: 404, code: "NOT_FOUND" });
      return jsonErrorWithRequestId("NOT_FOUND", "not_found", requestId, 404);
    }
    if (!deletedFile.file_id || deletedFile.original_file_deleted !== false) {
      await deleteObject(deletedFile.r2_key);
    }
    logStandardizedFileEvent({ fileId, ownerId: userId ?? "", status: 200, code: "OK" });
    return jsonOkWithRequestId({}, requestId);
  } catch (error) {
    const { fileId } = await params;
    const message = error instanceof Error ? error.message : "파일을 삭제하지 못했습니다.";
    logStandardizedFileEvent({ fileId, ownerId: userId ?? "", status: 400, code: "DELETE_FAILED" });
    return jsonErrorWithRequestId("DELETE_FAILED", message, requestId, 400);
  }
}
