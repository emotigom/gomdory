import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type LessonRunDiagnosticsBoardRow = {
  id: string;
  title: string | null;
  share_code: string | null;
  active_session_id: string | null;
  class_state: string | null;
  share_write_enabled: boolean | null;
  class_id?: string | null;
  deleted_at?: string | null;
};

export type LessonRunDiagnosticsEduClassRow = {
  board_id: string | null;
  share_code: string | null;
  locked_at: string | null;
  lock_reason: string | null;
};

export type LessonRunDiagnosticsStudentAppClassSessionRow = {
  id: string;
  status: string | null;
  starts_at: string | null;
  ends_at: string | null;
  ended_at: string | null;
  created_at: string | null;
};

export type LessonRunDiagnosticsClassSessionRow = {
  id: string;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  report: unknown | null;
  created_at: string | null;
};

export type LessonRunDiagnosticsStudentAppDeploymentRow = {
  id: string;
  status: string | null;
  title: string | null;
  published_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string | null;
};

export type LessonRunDiagnosticsLessonActivityRow = {
  id: string;
  class_session_id: string | null;
  lesson_template_id: string | null;
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
};

export type LessonRunDiagnosticsCoursewareSessionRow = {
  id: string;
  status: string | null;
  expires_at: string | null;
  closed_at: string | null;
  updated_at: string | null;
};

export type LessonRunDiagnosticsSnapshot = {
  board: LessonRunDiagnosticsBoardRow | null;
  eduClass: LessonRunDiagnosticsEduClassRow | null;
  studentAppClassSessions: LessonRunDiagnosticsStudentAppClassSessionRow[];
  classSessions: LessonRunDiagnosticsClassSessionRow[];
  studentAppDeployments: LessonRunDiagnosticsStudentAppDeploymentRow[];
  lessonActivityRuns: LessonRunDiagnosticsLessonActivityRow[];
  coursewareSessions: LessonRunDiagnosticsCoursewareSessionRow[];
  loadWarnings: string[];
  sourceTables: string[];
};

type DiagnosticsSupabaseClient = Pick<SupabaseClient, "from">;

type LoaderOptions = {
  supabase?: DiagnosticsSupabaseClient;
};

type QueryResult<T> = {
  data: T | null;
  error: { message?: string; code?: string } | null;
};

function warningFor(table: string, error: unknown): string {
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "read failed";
  return `${table}: ${message}`;
}

async function readMaybeSingle<T>(
  loadWarnings: string[],
  table: string,
  query: PromiseLike<QueryResult<T>>,
): Promise<T | null> {
  try {
    const { data, error } = await query;
    if (error) {
      loadWarnings.push(warningFor(table, error));
      return null;
    }
    return data ?? null;
  } catch (error) {
    loadWarnings.push(warningFor(table, error));
    return null;
  }
}

async function readRows<T>(
  loadWarnings: string[],
  table: string,
  query: PromiseLike<QueryResult<T[]>>,
): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) {
      loadWarnings.push(warningFor(table, error));
      return [];
    }
    return data ?? [];
  } catch (error) {
    loadWarnings.push(warningFor(table, error));
    return [];
  }
}

export async function loadLessonRunDiagnostics(
  boardId: string,
  options: LoaderOptions = {},
): Promise<LessonRunDiagnosticsSnapshot> {
  const supabase = options.supabase ?? createSupabaseAdminClient();
  const loadWarnings: string[] = [];

  const board = await readMaybeSingle<LessonRunDiagnosticsBoardRow>(
    loadWarnings,
    "boards",
    supabase
      .from("boards")
      .select("id, title, share_code, active_session_id, class_state, share_write_enabled, class_id, deleted_at")
      .eq("id", boardId)
      .maybeSingle(),
  );

  const [
    eduClass,
    studentAppClassSessions,
    classSessions,
    studentAppDeployments,
    lessonActivityRuns,
  ] = await Promise.all([
    readMaybeSingle<LessonRunDiagnosticsEduClassRow>(
      loadWarnings,
      "edu_classes",
      supabase.from("edu_classes").select("board_id, share_code, locked_at, lock_reason").eq("board_id", boardId).maybeSingle(),
    ),
    readRows<LessonRunDiagnosticsStudentAppClassSessionRow>(
      loadWarnings,
      "student_app_class_sessions",
      supabase
        .from("student_app_class_sessions")
        .select("id, status, starts_at, ends_at, ended_at, created_at")
        .eq("board_id", boardId)
        .order("created_at", { ascending: false })
        .limit(20),
    ),
    readRows<LessonRunDiagnosticsClassSessionRow>(
      loadWarnings,
      "class_sessions",
      supabase
        .from("class_sessions")
        .select("id, status, started_at, ended_at, report, created_at")
        .eq("board_id", boardId)
        .order("started_at", { ascending: false })
        .limit(20),
    ),
    readRows<LessonRunDiagnosticsStudentAppDeploymentRow>(
      loadWarnings,
      "student_app_deployments",
      supabase
        .from("student_app_deployments")
        .select("id, status, title, published_at, archived_at, deleted_at, created_at")
        .eq("board_id", boardId)
        .order("created_at", { ascending: false })
        .limit(20),
    ),
    readRows<LessonRunDiagnosticsLessonActivityRow>(
      loadWarnings,
      "lesson_activity_runs",
      supabase
        .from("lesson_activity_runs")
        .select("id, class_session_id, lesson_template_id, status, started_at, ended_at")
        .eq("board_id", boardId)
        .order("started_at", { ascending: false })
        .limit(20),
    ),
  ]);

  const coursewareSessions: LessonRunDiagnosticsCoursewareSessionRow[] = [];
  loadWarnings.push("courseware_class_sessions: skipped because the current schema has no board_id correlation field.");

  return {
    board,
    eduClass,
    studentAppClassSessions,
    classSessions,
    studentAppDeployments,
    lessonActivityRuns,
    coursewareSessions,
    loadWarnings,
    sourceTables: [
      "boards",
      "edu_classes",
      "student_app_class_sessions",
      "class_sessions",
      "student_app_deployments",
      "lesson_activity_runs",
    ],
  };
}
