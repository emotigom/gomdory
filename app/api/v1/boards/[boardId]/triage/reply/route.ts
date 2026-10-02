import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { appendEvent } from "@/lib/data/sessionsReport";
import { getBoardLiveSession, upsertBoardLiveSession } from "@/lib/data/liveSession";
import type { StudentActionTriageEntry } from "@/lib/types/studentActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION_ID_LIMIT = 120;
const TEXT_LIMIT = 200;

type ReplyDeps = {
  requireUserApiFn?: typeof requireUserApi;
  getBoardLiveSessionFn?: typeof getBoardLiveSession;
  upsertBoardLiveSessionFn?: typeof upsertBoardLiveSession;
  appendEventFn?: typeof appendEvent;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function normalizeActionId(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, ACTION_ID_LIMIT);
}

async function ensureBoardAccess(
  boardId: string,
  deps?: ReplyDeps,
): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  let userId: string;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return { ok: false, response: jsonError("unauthorized", "인증이 필요합니다.", 401) };
  }

  const supabase = (deps?.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return { ok: false, response: jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403) };
  }

  return { ok: true, userId };
}

async function loadShareCode(boardId: string, deps?: ReplyDeps) {
  const supabase = (deps?.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const { data } = await supabase
    .from("boards")
    .select("share_code")
    .eq("id", boardId)
    .maybeSingle();
  return (data as { share_code?: string | null } | null)?.share_code ?? null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  deps?: ReplyDeps,
) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId, deps);
  if (!access.ok) return access.response;

  const payload = (await request.json().catch(() => null)) as
    | { actionId?: string; text?: string }
    | null;
  const actionId = normalizeActionId(payload?.actionId);
  const text = typeof payload?.text === "string" ? payload.text.trim().slice(0, TEXT_LIMIT) : "";

  if (!actionId) {
    return jsonError("invalid_action_id", "요청 ID가 올바르지 않습니다.");
  }

  if (!text) {
    return jsonError("invalid_text", "답장 내용을 입력해주세요.");
  }

  const now = Date.now();
  const getSession = deps?.getBoardLiveSessionFn ?? getBoardLiveSession;
  const session = await getSession(boardId);
  const snapshot = session?.snapshot ?? null;
  const triage = snapshot?.studentActionTriage?.actions ?? [];
  const current = triage.find((entry) => entry.actionId === actionId);

  if (!current) {
    return jsonError("not_found", "해당 요청을 찾을 수 없습니다.", 404);
  }

  const nextStatus = current.status === "pending" ? "approved" : current.status;
  const updatedEntry: StudentActionTriageEntry = {
    ...current,
    status: nextStatus,
    replyText: text,
    handledBy: access.userId,
    handledAt: now,
    updatedAt: now,
  };

  const nextActions = triage.map((entry) => (entry.actionId === actionId ? updatedEntry : entry));
  const nextState = {
    actions: nextActions,
    updatedAt: now,
  };

  const saveSession = deps?.upsertBoardLiveSessionFn ?? upsertBoardLiveSession;
  await saveSession(boardId, { studentActionTriage: nextState, ts: now });

  const shareCode = snapshot?.activeSessionId ? await loadShareCode(boardId, deps) : null;
  const append = deps?.appendEventFn ?? appendEvent;
  if (snapshot?.activeSessionId && shareCode) {
    await append({
      boardId,
      shareCode,
      sessionId: snapshot.activeSessionId,
      type: "action_status_changed",
      payload: {
        actionId,
        status: nextStatus,
        handledBy: access.userId,
        handledAt: now,
      },
    });
    await append({
      boardId,
      shareCode,
      sessionId: snapshot.activeSessionId,
      type: "action_replied",
      payload: {
        actionId,
        text,
        handledBy: access.userId,
        handledAt: now,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
