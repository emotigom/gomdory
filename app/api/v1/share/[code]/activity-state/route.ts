import { NextResponse } from "next/server";

import {
  getOrCreateAiBingoStateForParticipant,
  getOrCreateAiJudgmentSortStateForParticipant,
  getOrCreatePythonStudioLiteStateForParticipant,
  getOrCreateWebCodingLiteStateForParticipant,
  updateAiJudgmentSortState,
  updatePythonStudioLiteState,
  updateWebCodingLiteState,
  upsertAiBingoSelection,
} from "@/lib/lesson-activities/progress";
import { resolvePublicShareBoard } from "@/lib/share/public/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function getOptionalUserId(): Promise<string | null> {
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

function readParticipantKey(request: Request, body?: { participantKey?: unknown } | null): string {
  const headerKey = request.headers.get("x-gomdory-participant-key") ?? "";
  const bodyKey = typeof body?.participantKey === "string" ? body.participantKey : "";
  return headerKey || bodyKey;
}


function parseCodingStudioOperation(value: unknown): "save_code" | "submit" | "reset_to_starter" {
  if (value === "save_code" || value === "submit" || value === "reset_to_starter") return value;
  throw new Error("지원하지 않는 웹 코딩 실습 요청입니다.");
}

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 40) : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { board } = await resolvePublicShareBoard(code);
  if (!board) return jsonError("board_not_found", "공유 보드를 찾을 수 없습니다.", 404);

  const participantKey = readParticipantKey(request);
  const searchParams = new URL(request.url).searchParams;
  const displayName = normalizeDisplayName(searchParams.get("displayName"));
  const activityType = searchParams.get("activityType");
  const userId = await getOptionalUserId();

  try {
    const payload = activityType === "python_studio_lite"
      ? await getOrCreatePythonStudioLiteStateForParticipant({
          boardId: board.id,
          participantKey,
          displayName,
          userId,
        })
      : activityType === "web_coding_lite"
        ? await getOrCreateWebCodingLiteStateForParticipant({
            boardId: board.id,
            participantKey,
            displayName,
            userId,
          })
        : activityType === "ai_judgment_sort"
        ? await getOrCreateAiJudgmentSortStateForParticipant({
            boardId: board.id,
            participantKey,
            displayName,
            userId,
          })
        : await getOrCreateAiBingoStateForParticipant({
            boardId: board.id,
            participantKey,
            displayName,
            userId,
          });
    if (!payload) {
      const message = activityType === "python_studio_lite"
        ? "진행 중인 파이썬 실습이 없습니다."
        : activityType === "web_coding_lite"
          ? "진행 중인 웹 코딩 실습이 없습니다."
          : activityType === "ai_judgment_sort"
          ? "진행 중인 AI 판단 카드 분류 활동이 없습니다."
          : "진행 중인 AI 빙고 활동이 없습니다.";
      return jsonError("activity_not_found", message, 404);
    }
    return NextResponse.json({ ok: true, data: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "활동 상태를 불러오지 못했습니다.";
    return jsonError("activity_state_get_failed", message, 400);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { board } = await resolvePublicShareBoard(code);
  if (!board) return jsonError("board_not_found", "공유 보드를 찾을 수 없습니다.", 404);

  const body = (await request.json().catch(() => null)) as {
    participantKey?: unknown;
    activityRunId?: unknown;
    tileId?: unknown;
    reason?: unknown;
    displayName?: unknown;
    activityType?: unknown;
    operation?: unknown;
    cardId?: unknown;
    category?: unknown;
    html?: unknown;
    css?: unknown;
    js?: unknown;
    code?: unknown;
    stdin?: unknown;
    stdout?: unknown;
    stderr?: unknown;
  } | null;

  const participantKey = readParticipantKey(request, body);
  const activityRunId = typeof body?.activityRunId === "string" ? body.activityRunId : "";
  const tileId = typeof body?.tileId === "string" ? body.tileId : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const displayName = normalizeDisplayName(body?.displayName);
  const userId = await getOptionalUserId();
  const activityType = typeof body?.activityType === "string" ? body.activityType : "ai_bingo";

  try {
    const payload = activityType === "python_studio_lite"
      ? await updatePythonStudioLiteState({
          boardId: board.id,
          activityRunId,
          participantKey,
          operation: parseCodingStudioOperation(body?.operation),
          code: body?.code,
          stdin: body?.stdin,
          stdout: body?.stdout,
          stderr: body?.stderr,
          displayName,
          userId,
        })
      : activityType === "web_coding_lite"
        ? await updateWebCodingLiteState({
            boardId: board.id,
            activityRunId,
            participantKey,
            operation: parseCodingStudioOperation(body?.operation),
            html: body?.html,
            css: body?.css,
            js: body?.js,
            displayName,
            userId,
          })
        : activityType === "ai_judgment_sort"
        ? await updateAiJudgmentSortState({
            boardId: board.id,
            activityRunId,
            participantKey,
            operation: body?.operation === "save_reason" || body?.operation === "submit" ? body.operation : "place_card",
            cardId: typeof body?.cardId === "string" ? body.cardId : undefined,
            category: body?.category,
            reason: body?.reason,
            displayName,
            userId,
          })
        : await upsertAiBingoSelection({
            boardId: board.id,
            activityRunId,
            participantKey,
            tileId,
            reason,
            displayName,
            userId,
          });
    return NextResponse.json({ ok: true, data: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "활동 상태를 저장하지 못했습니다.";
    const status = message.includes("없는") || message.includes("확인") ? 403 : 400;
    return jsonError("activity_state_update_failed", message, status);
  }
}
