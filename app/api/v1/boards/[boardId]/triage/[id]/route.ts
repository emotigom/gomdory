import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { logAudit } from "@/lib/data/audit";
import { appendEvent } from "@/lib/data/sessionsReport";
import { getBoardLiveSession, upsertBoardLiveSession } from "@/lib/data/liveSession";
import { triageEntryToItem } from "@/lib/triage/triageItems";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withOps, type WithOpsContext } from "@/lib/ops/withOps";
import type { StudentActionTriageEntry, StudentActionTriageStatus } from "@/lib/types/studentActions";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION_ID_LIMIT = 120;

type TriageAction = "approve" | "hide" | "pin" | "unpin";

type TriageDeps = {
  requireUserApiFn?: typeof requireUserApi;
  getBoardLiveSessionFn?: typeof getBoardLiveSession;
  upsertBoardLiveSessionFn?: typeof upsertBoardLiveSession;
  appendEventFn?: typeof appendEvent;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  logAuditFn?: typeof logAudit;
  nowFn?: () => number;
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

function resolveStatus(action: TriageAction): StudentActionTriageStatus {
  if (action === "approve") return "approved";
  if (action === "hide") return "hidden";
  if (action === "pin") return "pinned";
  return "approved";
}

async function ensureBoardAccess(
  boardId: string,
  deps?: TriageDeps,
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

async function loadShareCode(boardId: string, deps?: TriageDeps) {
  const supabase = (deps?.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const { data } = await supabase
    .from("boards")
    .select("share_code")
    .eq("id", boardId)
    .maybeSingle();
  return (data as { share_code?: string | null } | null)?.share_code ?? null;
}

async function handlePost(
  request: Request,
  { params }: { params: Promise<{ boardId: string; id: string }> },
  _ops: WithOpsContext,
  deps?: TriageDeps,
) {
  const { boardId, id: rawActionId } = await params;
  const actionId = normalizeActionId(rawActionId);

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  if (!actionId) {
    return jsonError("invalid_action_id", "요청 ID가 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId, deps);
  if (!access.ok) return access.response;

  const payload = (await request.json().catch(() => null)) as
    | { action?: TriageAction; replyTemplateId?: string | null }
    | null;
  const action = payload?.action;

  if (!action || !["approve", "hide", "pin", "unpin"].includes(action)) {
    return jsonError("invalid_action", "작업 유형을 확인해주세요.");
  }

  const now = deps?.nowFn ? deps.nowFn() : Date.now();
  const nextStatus = resolveStatus(action);

  const getSession = deps?.getBoardLiveSessionFn ?? getBoardLiveSession;
  const session = await getSession(boardId);
  const snapshot = session?.snapshot ?? null;
  const triage = snapshot?.studentActionTriage?.actions ?? [];
  const current = triage.find((entry) => entry.actionId === actionId);

  if (!current) {
    return jsonError("not_found", "해당 요청을 찾을 수 없습니다.", 404);
  }

  const updatedEntry: StudentActionTriageEntry = {
    ...current,
    status: nextStatus,
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
      type: "triage_updated",
      payload: {
        itemId: actionId,
        delta: {
          status: nextStatus,
          pinned: nextStatus === "pinned",
          replyTemplateId: payload?.replyTemplateId ?? undefined,
        },
      },
    });
  }

  const audit = deps?.logAuditFn ?? logAudit;
  await audit({
    boardId,
    action: "triage.status_changed",
    targetType: "student_action",
    targetId: actionId,
    meta: {
      action,
      status: nextStatus,
    },
  });

  const mapped = triageEntryToItem(updatedEntry, boardId);
  if (!mapped) {
    return jsonError("unsupported", "해당 요청을 처리할 수 없습니다.", 400);
  }

  return { item: mapped };
}

export const POST = withOps(handlePost, { log: true, errorCode: "unknown" });
