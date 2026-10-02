import { finalizeUploadForUser } from "@/lib/data/files";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { getOrCreateRequestId } from "@/lib/http/requestId";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  try {
    const { user } = await requireUserApi();
    const { fileId } = await params;

    await finalizeUploadForUser(fileId, user.id);

    return jsonOkWithRequestId({}, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "unauthorized") {
      return jsonErrorWithRequestId("unauthorized", "Unauthorized", requestId, 401);
    }
    if (message === "file_not_found") {
      return jsonErrorWithRequestId("file_not_found", "File not found", requestId, 404);
    }
    if (message === "file_forbidden") {
      return jsonErrorWithRequestId("forbidden", "Forbidden", requestId, 403);
    }
    if (message.includes("확인") || message.includes("일치")) {
      return jsonErrorWithRequestId("invalid_upload_request", message, requestId, 400);
    }
    console.error("[files.finalize] unexpected error", { requestId, message });
    return jsonErrorWithRequestId("finalize_failed", "Finalize failed", requestId, 500);
  }
}
