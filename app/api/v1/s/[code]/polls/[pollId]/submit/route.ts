import { NextResponse } from "next/server";

import { PollError, submitPollResponse } from "@/lib/data/polls";
import { getBoardByShareCode, isValidShareCode, normalizeShareCode } from "@/lib/data/share";
import { goneResponse } from "@/lib/http/gone";
import { fingerprintFromRequest } from "@/lib/http/fingerprint";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; pollId: string }> },
) {
  const { code, pollId } = await params;
  const normalized = normalizeShareCode(code);

  if (!isValidShareCode(normalized)) {
    return jsonError("invalid_share_code", "공유 코드가 올바르지 않습니다.");
  }

  let board = null;
  try {
    board = await getBoardByShareCode(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "공유 보드를 확인하지 못했습니다.";
    return jsonError("board_lookup_failed", message, 502);
  }

  if (!board) {
    return jsonError("share_not_found", "공유 보드를 찾을 수 없습니다.", 404);
  }

  if (!hasToolEnabled(board, "polls")) {
    return goneResponse();
  }

  const payload = (await request.json().catch(() => null)) as { optionId?: string; timezoneOffset?: number } | null;
  const fingerprint = await fingerprintFromRequest(request, { timezoneOffset: payload?.timezoneOffset });

  if (!payload?.optionId) {
    return jsonError("invalid_option", "옵션을 선택해주세요.");
  }

  try {
    const result = await submitPollResponse(pollId, normalized, fingerprint, payload.optionId);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof PollError) {
      return jsonError(error.code, error.message, error.status);
    }
    const message = error instanceof Error ? error.message : "투표를 제출하지 못했습니다.";
    return jsonError("server_error", message, 502);
  }
}
