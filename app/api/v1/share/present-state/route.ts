import { jsonOperationalError, jsonOperationalOk } from "@/lib/api/server/operational";
import { fetchPresentFollowState } from "@/lib/present/presentStateServer";
import { resolvePublicShareBoard } from "@/lib/share/public/access";
import { getOrCreateRequestId } from "@/lib/http/requestId";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getOrCreateRequestId(request);
  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get("boardId");
  const codeParam = searchParams.get("code") ?? "";

  if (!boardId || !codeParam) {
    return jsonOperationalError("INVALID_REQUEST", "요청 정보를 확인할 수 없습니다.", requestId, 400);
  }

  const { board } = await resolvePublicShareBoard(codeParam);
  if (!board || board.id !== boardId) {
    return jsonOperationalError("INVALID_SHARE_LINK", "유효하지 않은 공유 링크입니다.", requestId, 404);
  }

  const result = await fetchPresentFollowState(boardId);
  if (!result.ok) {
    return jsonOperationalError("PRESENT_STATE_UNAVAILABLE", "발표 상태를 불러오지 못했습니다.", requestId, 502);
  }

  const state = result.state ? { ...result.state, updatedBy: "teacher" as const } : null;
  return jsonOperationalOk({ state }, requestId);
}
