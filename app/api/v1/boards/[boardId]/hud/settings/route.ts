import { NextResponse } from "next/server";

import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { appendEvent } from "@/lib/data/sessionsReport";
import { getBoardLiveSession, upsertBoardLiveSession } from "@/lib/data/liveSession";
import type { StudentHudSettings } from "@/lib/types/studentActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HudSettingsDeps = {
  requireUserApiFn?: typeof requireUserApi;
  getBoardLiveSessionFn?: typeof getBoardLiveSession;
  upsertBoardLiveSessionFn?: typeof upsertBoardLiveSession;
  appendEventFn?: typeof appendEvent;
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
};

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

async function ensureBoardAccess(
  boardId: string,
  deps?: HudSettingsDeps,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  try {
    await ensureUser();
  } catch {
    return { ok: false, response: jsonError("unauthorized", "인증이 필요합니다.", 401) };
  }

  const supabase = (deps?.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return { ok: false, response: jsonError("forbidden", "보드에 접근할 권한이 없습니다.", 403) };
  }

  return { ok: true };
}

async function loadShareCode(boardId: string, deps?: HudSettingsDeps) {
  const supabase = (deps?.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const { data } = await supabase
    .from("boards")
    .select("share_code")
    .eq("id", boardId)
    .maybeSingle();
  return (data as { share_code?: string | null } | null)?.share_code ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
  deps?: HudSettingsDeps,
) {
  const { boardId } = await params;

  if (!UUID_REGEX.test(boardId)) {
    return jsonError("invalid_board_id", "보드 ID 형식이 올바르지 않습니다.");
  }

  const access = await ensureBoardAccess(boardId, deps);
  if (!access.ok) return access.response;

  const payload = (await request.json().catch(() => null)) as
    | { approvalMode?: string; announcement?: string | null; lockStudentInput?: boolean }
    | null;
  if (!payload || typeof payload !== "object") {
    return jsonError("invalid_payload", "설정 값을 확인해주세요.");
  }

  const approvalMode =
    payload.approvalMode === "auto" || payload.approvalMode === "teacher_approve"
      ? payload.approvalMode
      : undefined;
  const announcement =
    typeof payload.announcement === "string" ? payload.announcement.trim().slice(0, 200) : payload.announcement ?? undefined;
  const lockStudentInput = typeof payload.lockStudentInput === "boolean" ? payload.lockStudentInput : undefined;

  if (approvalMode === undefined && announcement === undefined && lockStudentInput === undefined) {
    return jsonError("invalid_payload", "업데이트할 값이 없습니다.");
  }

  const now = Date.now();
  const getSession = deps?.getBoardLiveSessionFn ?? getBoardLiveSession;
  const session = await getSession(boardId);
  const snapshot = session?.snapshot ?? null;
  const currentSettings = snapshot?.studentHudSettings ?? {};

  const nextSettings: StudentHudSettings = {
    ...currentSettings,
    ...(approvalMode !== undefined ? { approvalMode } : null),
    ...(announcement !== undefined ? { announcement: announcement ?? null } : null),
    ...(lockStudentInput !== undefined ? { lockStudentInput } : null),
    updatedAt: now,
  };

  const saveSession = deps?.upsertBoardLiveSessionFn ?? upsertBoardLiveSession;
  await saveSession(boardId, { studentHudSettings: nextSettings, ts: now });

  const shareCode = snapshot?.activeSessionId ? await loadShareCode(boardId, deps) : null;
  const append = deps?.appendEventFn ?? appendEvent;
  if (snapshot?.activeSessionId && shareCode) {
    await append({
      boardId,
      shareCode,
      sessionId: snapshot.activeSessionId,
      type: "hud_settings_changed",
      payload: {
        approvalMode: nextSettings.approvalMode ?? null,
        announcement: nextSettings.announcement ?? null,
        lockStudentInput: nextSettings.lockStudentInput ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true, settings: nextSettings });
}
