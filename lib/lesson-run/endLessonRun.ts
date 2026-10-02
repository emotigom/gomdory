import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { loadLessonRunDiagnostics, type LessonRunDiagnosticsSnapshot } from "@/lib/lesson-run/loadLessonRunDiagnostics";
import { resolveLessonRunState } from "@/lib/lesson-run/resolveLessonRunState";
import { toLessonRunInput } from "@/lib/lesson-run/toLessonRunInput";
import type { LessonRunState } from "@/lib/lesson-run/types";
import { isLessonRunStartFacadeEnabled } from "@/lib/lesson-run/startLessonRun";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EndLessonRunSupabaseClient = Pick<SupabaseClient, "from" | "rpc">;

type EndLessonRunBoardRow = { id: string };
type EndLessonRunSessionRow = { id: string };

export type EndLessonRunInput = {
  boardId: string;
  idempotencyKey?: string | null;
  clientRequestId?: string | null;
};

export type EndLessonRunDisposition =
  | "feature_disabled"
  | "ended_session"
  | "already_closed"
  | "auth_required"
  | "board_not_found"
  | "permission_denied"
  | "internal_error";

export type EndLessonRunResult = {
  ok: boolean;
  disposition: EndLessonRunDisposition;
  httpStatus: number;
  message: string;
  sessionId: string | null;
  endedSessionIds: string[];
  lessonRunState: LessonRunState | null;
  validation: null;
  diagnosticsWarnings: string[];
};

type EndLessonRunDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: () => EndLessonRunSupabaseClient;
  createSupabaseServerClientFn?: () => Pick<SupabaseClient, "rpc">;
  loadLessonRunDiagnosticsFn?: typeof loadLessonRunDiagnostics;
  env?: Record<string, string | undefined>;
  now?: Date;
};

type QueryResult<T> = { data: T | null; error: unknown };

function safeResult(args: {
  ok: boolean;
  disposition: EndLessonRunDisposition;
  httpStatus: number;
  message: string;
  sessionId?: string | null;
  endedSessionIds?: string[];
  lessonRunState?: LessonRunState | null;
  diagnosticsWarnings?: string[];
}): EndLessonRunResult {
  return {
    ok: args.ok,
    disposition: args.disposition,
    httpStatus: args.httpStatus,
    message: args.message,
    sessionId: args.sessionId ?? null,
    endedSessionIds: args.endedSessionIds ?? [],
    lessonRunState: args.lessonRunState ?? null,
    validation: null,
    diagnosticsWarnings: args.diagnosticsWarnings ?? [],
  };
}

async function loadState(
  boardId: string,
  now: Date,
  supabase: EndLessonRunSupabaseClient,
  loadLessonRunDiagnosticsFn: typeof loadLessonRunDiagnostics,
): Promise<{ snapshot: LessonRunDiagnosticsSnapshot; state: LessonRunState; diagnosticsWarnings: string[] }> {
  const snapshot = await loadLessonRunDiagnosticsFn(boardId, { supabase });
  const { input, diagnosticsWarnings } = toLessonRunInput(snapshot, now.toISOString());
  return { snapshot, state: resolveLessonRunState(input), diagnosticsWarnings };
}

export async function endLessonRun(input: EndLessonRunInput, deps: EndLessonRunDeps = {}): Promise<EndLessonRunResult> {
  const requireUserApiFn = deps.requireUserApiFn ?? requireUserApi;
  const createSupabaseAdminClientFn = deps.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
  const createSupabaseServerClientFn = deps.createSupabaseServerClientFn ?? createSupabaseServerClient;
  const loadLessonRunDiagnosticsFn = deps.loadLessonRunDiagnosticsFn ?? loadLessonRunDiagnostics;
  const now = deps.now ?? new Date();

  try {
    await requireUserApiFn();
  } catch {
    return safeResult({ ok: false, disposition: "auth_required", httpStatus: 401, message: "로그인이 필요합니다." });
  }

  const boardId = input.boardId.trim();
  if (!boardId) {
    return safeResult({ ok: false, disposition: "board_not_found", httpStatus: 404, message: "보드를 찾을 수 없습니다." });
  }

  const supabase = createSupabaseAdminClientFn();
  const boardResult = await supabase.from("boards").select("id").eq("id", boardId).maybeSingle() as QueryResult<EndLessonRunBoardRow>;
  if (boardResult.error || !boardResult.data?.id) {
    return safeResult({ ok: false, disposition: "board_not_found", httpStatus: 404, message: "보드를 찾을 수 없습니다." });
  }

  let roleResult: QueryResult<string>;
  try {
    roleResult = await createSupabaseServerClientFn().rpc("board_role", { bid: boardResult.data.id }) as QueryResult<string>;
  } catch {
    return safeResult({ ok: false, disposition: "permission_denied", httpStatus: 403, message: "이 보드에서 수업을 종료할 권한이 없습니다." });
  }
  const role = normalizeBoardRole(roleResult.data);
  if (roleResult.error || !canEditBoard(role)) {
    return safeResult({ ok: false, disposition: "permission_denied", httpStatus: 403, message: "이 보드에서 수업을 종료할 권한이 없습니다." });
  }

  const initial = await loadState(boardResult.data.id, now, supabase, loadLessonRunDiagnosticsFn);
  if (!isLessonRunStartFacadeEnabled(deps.env)) {
    return safeResult({
      ok: false,
      disposition: "feature_disabled",
      httpStatus: 200,
      message: "수업 시작 기능은 아직 비활성화되어 있습니다.",
      lessonRunState: initial.state,
      diagnosticsWarnings: initial.diagnosticsWarnings,
    });
  }

  // Preserve the legacy end meaning: close every active, not-yet-ended row,
  // including expired rows that were never cleaned up.
  const activeResult = await supabase
    .from("student_app_class_sessions")
    .select("id")
    .eq("board_id", boardResult.data.id)
    .eq("status", "active")
    .is("ended_at", null) as QueryResult<EndLessonRunSessionRow[]>;
  if (activeResult.error) {
    return safeResult({
      ok: false,
      disposition: "internal_error",
      httpStatus: 500,
      message: "수업 종료 상태를 확인하지 못했습니다.",
      lessonRunState: initial.state,
      diagnosticsWarnings: initial.diagnosticsWarnings,
    });
  }

  const activeSessionIds = (activeResult.data ?? []).map((row) => row.id);
  if (activeSessionIds.length === 0) {
    return safeResult({
      ok: true,
      disposition: "already_closed",
      httpStatus: 200,
      message: "이미 제출 시간이 닫혀 있습니다.",
      lessonRunState: initial.state,
      diagnosticsWarnings: initial.diagnosticsWarnings,
    });
  }

  const timestamp = now.toISOString();
  const ended = await supabase
    .from("student_app_class_sessions")
    .update({ status: "ended", ended_at: timestamp, updated_at: timestamp } as never)
    .eq("board_id", boardResult.data.id)
    .in("id", activeSessionIds)
    .eq("status", "active")
    .is("ended_at", null)
    .select("id") as QueryResult<EndLessonRunSessionRow[]>;
  if (ended.error) {
    return safeResult({
      ok: false,
      disposition: "internal_error",
      httpStatus: 500,
      message: "수업 시간을 종료하지 못했습니다.",
      lessonRunState: initial.state,
      diagnosticsWarnings: initial.diagnosticsWarnings,
    });
  }

  const endedSessionIds = (ended.data ?? []).map((row) => row.id);
  const refreshed = await loadState(boardResult.data.id, now, supabase, loadLessonRunDiagnosticsFn);
  if (endedSessionIds.length === 0) {
    return safeResult({
      ok: true,
      disposition: "already_closed",
      httpStatus: 200,
      message: "이미 제출 시간이 닫혀 있습니다.",
      lessonRunState: refreshed.state,
      diagnosticsWarnings: refreshed.diagnosticsWarnings,
    });
  }

  return safeResult({
    ok: true,
    disposition: "ended_session",
    httpStatus: 200,
    message: "제출 시간이 종료되었습니다.",
    sessionId: endedSessionIds[0],
    endedSessionIds,
    lessonRunState: refreshed.state,
    diagnosticsWarnings: refreshed.diagnosticsWarnings,
  });
}
