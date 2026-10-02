import { requireUserApi } from "@/lib/auth/requireUserApi";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { finalizeUpload } from "@/lib/data/files";
import { getOrCreateRequestId } from "@/lib/http/requestId";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const requestId = getOrCreateRequestId(request);

  try {
    await requireUserApi();
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "로그인이 필요합니다.", requestId, 401);
  }

  try {
    const { fileId } = await params;
    await finalizeUpload(fileId);
    return jsonOkWithRequestId({}, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "업로드 완료 처리에 실패했습니다.";
    return jsonErrorWithRequestId("FINALIZE_FAILED", message, requestId, 400);
  }
}
