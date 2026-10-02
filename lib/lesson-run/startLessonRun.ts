import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUserApi } from "@/lib/auth/requireUserApi";
import { loadLessonRunDiagnostics, type LessonRunDiagnosticsSnapshot } from "@/lib/lesson-run/loadLessonRunDiagnostics";
import { resolveLessonRunState } from "@/lib/lesson-run/resolveLessonRunState";
import { toLessonRunInput } from "@/lib/lesson-run/toLessonRunInput";
import type {
  LessonRunIssue,
  LessonRunState,
  StartLessonRunRequestedOptions,
  ValidateStartLessonRunResult,
} from "@/lib/lesson-run/types";
import { validateStartLessonRun } from "@/lib/lesson-run/validateStartLessonRun";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const LESSON_RUN_START_FACADE_FLAG = "LESSON_RUN_START_FACADE_ENABLED";

type StartLessonRunBoardRow = {
  id: string;
  title: string | null;
  share_code: string | null;
  active_session_id: string | null;
  class_state: string | null;
  share_write_enabled: boolean | null;
  class_id: string | null;
  deleted_at: string | null;
};

type StartLessonRunSessionRow = {
  id: string;
  status: string | null;
  starts_at: string | null;
  ends_at: string | null;
  ended_at: string | null;
  created_at?: string | null;
};

type StartLessonRunSupabaseClient = Pick<SupabaseClient, "from" | "rpc">;

export type StartLessonRunInput = {
  boardId: string;
  requestedPreset?: string | null;
  durationMinutes?: number | null;
  options?: StartLessonRunRequestedOptions | null;
  idempotencyKey?: string | null;
  clientRequestId?: string | null;
};

export type StartLessonRunDisposition =
  | "feature_disabled"
  | "validation_failed"
  | "created_session"
  | "reuse_open_session"
  | "conflict_multiple_open_sessions"
  | "auth_required"
  | "board_not_found"
  | "permission_denied"
  | "internal_error";

export type StartLessonRunResult = {
  ok: boolean;
  disposition: StartLessonRunDisposition;
  httpStatus: number;
  message: string;
  sessionId: string | null;
  lessonRunState: LessonRunState | null;
  validation: ValidateStartLessonRunResult | null;
  diagnosticsWarnings: string[];
};

type StartLessonRunDeps = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseAdminClientFn?: () => StartLessonRunSupabaseClient;
  createSupabaseServerClientFn?: () => Pick<SupabaseClient, "rpc">;
  loadLessonRunDiagnosticsFn?: typeof loadLessonRunDiagnostics;
  env?: Record<string, string | undefined>;
  now?: Date;
};

type QueryResult<T> = {
  data: T | null;
  error: unknown;
};

function safeResult(args: {
  ok: boolean;
  disposition: StartLessonRunDisposition;
  httpStatus: number;
  message: string;
  sessionId?: string | null;
  lessonRunState?: LessonRunState | null;
  validation?: ValidateStartLessonRunResult | null;
  diagnosticsWarnings?: string[];
}): StartLessonRunResult {
  return {
    ok: args.ok,
    disposition: args.disposition,
    httpStatus: args.httpStatus,
    message: args.message,
    sessionId: args.sessionId ?? null,
    lessonRunState: args.lessonRunState ?? null,
    validation: args.validation ?? null,
    diagnosticsWarnings: args.diagnosticsWarnings ?? [],
  };
}

export function isLessonRunStartFacadeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[LESSON_RUN_START_FACADE_FLAG] === "true";
}

function isOpenSession(row: StartLessonRunSessionRow, now: Date): boolean {
  if (row.status !== "active") return false;
  if (row.ended_at) return false;
  if (row.starts_at && new Date(row.starts_at).getTime() > now.getTime()) return false;
  return Boolean(row.ends_at && new Date(row.ends_at).getTime() > now.getTime());
}

function issue(code: LessonRunIssue["code"], message: string): LessonRunIssue {
  return { code, message, severity: "conflict" };
}

async function readOpenSessions(
  supabase: StartLessonRunSupabaseClient,
  boardId: string,
  now: Date,
): Promise<{ ok: true; sessions: StartLessonRunSessionRow[] } | { ok: false }> {
  const result = await supabase
    .from("student_app_class_sessions")
    .select("id, status, starts_at, ends_at, ended_at, created_at")
    .eq("board_id", boardId)
    .eq("status", "active")
    .is("ended_at", null)
    .gt("ends_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(3) as QueryResult<StartLessonRunSessionRow[]>;

  if (result.error) return { ok: false };
  return { ok: true, sessions: (result.data ?? []).filter((row) => isOpenSession(row, now)) };
}

async function loadState(
  boardId: string,
  now: Date,
  supabase: StartLessonRunSupabaseClient,
  loadLessonRunDiagnosticsFn: typeof loadLessonRunDiagnostics,
): Promise<{
  snapshot: LessonRunDiagnosticsSnapshot;
  state: LessonRunState;
  diagnosticsWarnings: string[];
}> {
  const snapshot = await loadLessonRunDiagnosticsFn(boardId, { supabase });
  const { input, diagnosticsWarnings } = toLessonRunInput(snapshot, now.toISOString());
  return {
    snapshot,
    state: resolveLessonRunState(input),
    diagnosticsWarnings,
  };
}

export async function startLessonRun(
  input: StartLessonRunInput,
  deps: StartLessonRunDeps = {},
): Promise<StartLessonRunResult> {
  const requireUserApiFn = deps.requireUserApiFn ?? requireUserApi;
  const createSupabaseAdminClientFn = deps.createSupabaseAdminClientFn ?? createSupabaseAdminClient;
  const createSupabaseServerClientFn = deps.createSupabaseServerClientFn ?? createSupabaseServerClient;
  const loadLessonRunDiagnosticsFn = deps.loadLessonRunDiagnosticsFn ?? loadLessonRunDiagnostics;
  const now = deps.now ?? new Date();

  let user: User;
  try {
    user = (await requireUserApiFn()).user;
  } catch {
    return safeResult({
      ok: false,
      disposition: "auth_required",
      httpStatus: 401,
      message: "로그인이 필요합니다.",
    });
  }

  const boardId = input.boardId.trim();
  if (!boardId) {
    return safeResult({
      ok: false,
      disposition: "board_not_found",
      httpStatus: 404,
      message: "보드를 찾을 수 없습니다.",
    });
  }

  const supabase = createSupabaseAdminClientFn();
  const boardResult = await supabase
    .from("boards")
    .select("id, title, share_code, active_session_id, class_state, share_write_enabled, class_id, deleted_at")
    .eq("id", boardId)
    .maybeSingle() as QueryResult<StartLessonRunBoardRow>;

  if (boardResult.error || !boardResult.data?.id) {
    return safeResult({
      ok: false,
      disposition: "board_not_found",
      httpStatus: 404,
      message: "보드를 찾을 수 없습니다.",
    });
  }

  let roleResult: QueryResult<string>;
  try {
    roleResult = await createSupabaseServerClientFn().rpc("board_role", { bid: boardResult.data.id }) as QueryResult<string>;
  } catch {
    return safeResult({
      ok: false,
      disposition: "permission_denied",
      httpStatus: 403,
      message: "이 보드에서 수업을 시작할 권한이 없습니다.",
    });
  }
  const role = normalizeBoardRole(roleResult.data);
  if (roleResult.error || !canEditBoard(role)) {
    return safeResult({
      ok: false,
      disposition: "permission_denied",
      httpStatus: 403,
      message: "이 보드에서 수업을 시작할 권한이 없습니다.",
    });
  }

  const initial = await loadState(boardResult.data.id, now, supabase, loadLessonRunDiagnosticsFn);
  const validation = validateStartLessonRun({
    now: now.toISOString(),
    lessonRunState: initial.state,
    board: initial.snapshot.board,
    eduClass: initial.snapshot.eduClass,
    studentAppDeployments: initial.snapshot.studentAppDeployments,
    lessonActivity: toLessonRunInput(initial.snapshot, now.toISOString()).input.lessonActivity ?? null,
    studentAppClassSessions: initial.snapshot.studentAppClassSessions,
    requestedPreset: input.requestedPreset ?? "45m",
    durationMinutes: input.durationMinutes ?? null,
    options: input.options ?? null,
    teacher: {
      role,
      canEditBoard: true,
      canStartLessonRun: true,
    },
    idempotencyKey: input.idempotencyKey ?? null,
    clientRequestId: input.clientRequestId ?? null,
  });

  if (!validation.ok) {
    const reusableSessionId = validation.reusableSessionId ?? null;
    const disposition =
      validation.idempotencyDisposition === "reuse_open_session" ||
      validation.idempotencyDisposition === "resume_existing_session"
        ? "reuse_open_session"
        : validation.idempotencyDisposition === "conflict_multiple_open_sessions"
          ? "conflict_multiple_open_sessions"
          : "validation_failed";
    return safeResult({
      ok: false,
      disposition,
      httpStatus: validation.httpStatusCandidate,
      message: validation.teacherMessage,
      sessionId: reusableSessionId,
      lessonRunState: initial.state,
      validation,
      diagnosticsWarnings: initial.diagnosticsWarnings,
    });
  }

  const openSessions = await readOpenSessions(supabase, boardResult.data.id, now);
  if (!openSessions.ok) {
    return safeResult({
      ok: false,
      disposition: "internal_error",
      httpStatus: 500,
      message: "수업 시작 상태를 확인하지 못했습니다.",
      lessonRunState: initial.state,
      validation,
      diagnosticsWarnings: initial.diagnosticsWarnings,
    });
  }

  if (openSessions.sessions.length > 1) {
    const conflictValidation: ValidateStartLessonRunResult = {
      ...validation,
      ok: false,
      conflicts: [...validation.conflicts, issue("multiple_open_student_app_sessions", "Multiple student app submission windows are open.")],
      teacherMessage: "열린 수업 시간이 여러 개입니다. 진단에서 상태를 확인해주세요.",
      recommendedTeacherAction: "resolve_conflict",
      httpStatusCandidate: 409,
      idempotencyDisposition: "conflict_multiple_open_sessions",
      normalizedInput: null,
    };
    return safeResult({
      ok: false,
      disposition: "conflict_multiple_open_sessions",
      httpStatus: 409,
      message: conflictValidation.teacherMessage,
      lessonRunState: initial.state,
      validation: conflictValidation,
      diagnosticsWarnings: initial.diagnosticsWarnings,
    });
  }

  if (openSessions.sessions.length === 1) {
    return safeResult({
      ok: true,
      disposition: "reuse_open_session",
      httpStatus: 200,
      message: "이미 열린 수업 시간이 있어 현재 수업을 재사용합니다.",
      sessionId: openSessions.sessions[0].id,
      lessonRunState: initial.state,
      validation,
      diagnosticsWarnings: initial.diagnosticsWarnings,
    });
  }

  if (!isLessonRunStartFacadeEnabled(deps.env)) {
    return safeResult({
      ok: false,
      disposition: "feature_disabled",
      httpStatus: 200,
      message: "수업 시작 기능은 아직 비활성화되어 있습니다.",
      lessonRunState: initial.state,
      validation,
      diagnosticsWarnings: initial.diagnosticsWarnings,
    });
  }

  const normalized = validation.normalizedInput;
  if (!normalized) {
    return safeResult({
      ok: false,
      disposition: "validation_failed",
      httpStatus: 409,
      message: "수업 시작 옵션을 다시 확인해주세요.",
      lessonRunState: initial.state,
      validation,
      diagnosticsWarnings: initial.diagnosticsWarnings,
    });
  }

  const insertPayload = {
    board_id: boardResult.data.id,
    class_id: boardResult.data.class_id ?? null,
    started_by: user.id,
    status: "active",
    starts_at: normalized.startsAt,
    ends_at: normalized.endsAt,
    updated_at: normalized.now,
  } as never;

  const inserted = await supabase
    .from("student_app_class_sessions")
    .insert(insertPayload)
    .select("id, status, starts_at, ends_at, ended_at")
    .maybeSingle() as QueryResult<StartLessonRunSessionRow>;

  if (inserted.error || !inserted.data?.id) {
    return safeResult({
      ok: false,
      disposition: "internal_error",
      httpStatus: 500,
      message: "수업 시간을 열지 못했습니다. 학생 화면은 변경되지 않았습니다.",
      lessonRunState: initial.state,
      validation,
      diagnosticsWarnings: initial.diagnosticsWarnings,
    });
  }

  const refreshed = await loadState(boardResult.data.id, now, supabase, loadLessonRunDiagnosticsFn);
  return safeResult({
    ok: true,
    disposition: "created_session",
    httpStatus: 200,
    message: "수업 시간이 열렸습니다.",
    sessionId: inserted.data.id,
    lessonRunState: refreshed.state,
    validation,
    diagnosticsWarnings: refreshed.diagnosticsWarnings,
  });
}
