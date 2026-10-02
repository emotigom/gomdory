export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireUserApi } from "@/lib/auth/requireUserApi";
import { touchBoardFile } from "@/lib/data/boardFiles";
import { jsonErrorWithRequestId, jsonOkWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  touchBoardFileFn?: typeof touchBoardFile;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
  deps?: Dependencies,
) {
  const requestId = getOrCreateRequestId(request);
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const touchFile = deps?.touchBoardFileFn ?? touchBoardFile;

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401);
  }

  try {
    const { fileId } = await params;
    await touchFile({ fileId, ownerId: userId ?? "" });
    return jsonOkWithRequestId({}, requestId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "파일 사용 기록을 업데이트하지 못했습니다.";
    return jsonErrorWithRequestId("TOUCH_FAILED", message, requestId, 400);
  }
}
