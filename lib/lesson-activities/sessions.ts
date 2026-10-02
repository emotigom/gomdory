import "server-only";

import { canEditBoard, normalizeBoardRole, type BoardRole } from "@/lib/auth/boardRoles";
import { getLessonTemplate, type LessonTemplate } from "@/lib/lesson-activities/registry";
import type { ActiveLessonSession } from "@/lib/lesson-activities/types";
import { endActivityRunsForSession, ensureLessonActivityRun } from "@/lib/lesson-activities/progress";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LessonSessionActor = {
  userId: string;
};

type LessonSessionMetadata = {
  kind: "gomdory_lesson_activity_session";
  lessonTemplateId: LessonTemplate["id"];
};

type ClassSessionLessonRow = {
  id: string;
  board_id: string;
  started_at: string;
  ended_at: string | null;
  status: string | null;
  report: unknown | null;
};

const LESSON_SESSION_KIND = "gomdory_lesson_activity_session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getLessonTemplateIdFromSessionReport(report: unknown): LessonTemplate["id"] | null {
  if (!isRecord(report)) return null;
  const lessonActivity = report.lessonActivity;
  if (!isRecord(lessonActivity)) return null;
  if (lessonActivity.kind !== LESSON_SESSION_KIND) return null;
  const templateId = lessonActivity.lessonTemplateId;
  return typeof templateId === "string" && getLessonTemplate(templateId as LessonTemplate["id"])
    ? (templateId as LessonTemplate["id"])
    : null;
}

export function buildLessonSessionReportMetadata(templateId: LessonTemplate["id"]): { lessonActivity: LessonSessionMetadata } {
  const template = getLessonTemplate(templateId);
  if (!template) {
    throw new Error("지원하지 않는 수업 실습 템플릿입니다.");
  }

  return {
    lessonActivity: {
      kind: LESSON_SESSION_KIND,
      lessonTemplateId: template.id,
    },
  };
}

function toActiveLessonSession(row: ClassSessionLessonRow): ActiveLessonSession | null {
  if (row.ended_at) return null;
  if (row.status && row.status !== "running") return null;

  const templateId = getLessonTemplateIdFromSessionReport(row.report);
  if (!templateId) return null;

  const template = getLessonTemplate(templateId);
  if (!template) return null;

  return {
    id: row.id,
    boardId: row.board_id,
    templateId: template.id,
    title: template.title,
    activityTypes: template.activities
      .map((activity) => activity.activityType)
      .filter((activityType): activityType is ActiveLessonSession["activityTypes"][number] => Boolean(activityType)),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: row.status ?? "running",
  };
}

async function getBoardRole(boardId: string): Promise<BoardRole | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("board_role", { bid: boardId });
  if (error) return null;
  return normalizeBoardRole(data);
}

async function assertCanManageLessonSession(boardId: string, actor: LessonSessionActor): Promise<void> {
  if (!actor.userId) {
    throw new Error("로그인이 필요합니다.");
  }

  const role = await getBoardRole(boardId);
  if (!canEditBoard(role)) {
    throw new Error("수업 실습을 관리할 권한이 없습니다.");
  }
}

export async function getActiveLessonSessionForBoard(boardId: string): Promise<ActiveLessonSession | null> {
  const supabase = createSupabaseAdminClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, active_session_id")
    .eq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; active_session_id: string | null }>();

  if (boardError) {
    throw new Error(boardError.message);
  }

  if (!board?.active_session_id) return null;

  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select("id, board_id, started_at, ended_at, status, report")
    .eq("id", board.active_session_id)
    .eq("board_id", boardId)
    .maybeSingle<ClassSessionLessonRow>();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  return session ? toActiveLessonSession(session) : null;
}

export async function startLessonSessionForBoard(
  boardId: string,
  lessonTemplateId: LessonTemplate["id"],
  actor: LessonSessionActor,
): Promise<ActiveLessonSession> {
  const template = getLessonTemplate(lessonTemplateId);
  if (!template) {
    throw new Error("지원하지 않는 수업 실습 템플릿입니다.");
  }

  await assertCanManageLessonSession(boardId, actor);

  const supabase = createSupabaseAdminClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, share_code, active_session_id")
    .eq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; share_code: string | null; active_session_id: string | null }>();

  if (boardError) throw new Error(boardError.message);
  if (!board) throw new Error("보드를 찾을 수 없습니다.");

  const endedAt = new Date().toISOString();
  if (board.active_session_id) {
    await endActivityRunsForSession({ boardId, classSessionId: board.active_session_id });
    await supabase
      .from("class_sessions")
      .update({ ended_at: endedAt, status: "ended" })
      .eq("id", board.active_session_id)
      .eq("board_id", boardId)
      .is("ended_at", null);
  }

  const report = buildLessonSessionReportMetadata(template.id);
  const { data: inserted, error: insertError } = await supabase
    .from("class_sessions")
    .insert({
      board_id: boardId,
      owner_id: actor.userId,
      created_by: actor.userId,
      share_code: board.share_code ?? "lesson",
      title: template.title,
      status: "running",
      report,
    })
    .select("id, board_id, started_at, ended_at, status, report")
    .single<ClassSessionLessonRow>();

  if (insertError) throw new Error(insertError.message);
  if (!inserted) throw new Error("수업 실습 세션을 시작하지 못했습니다.");

  const { error: updateError } = await supabase
    .from("boards")
    .update({ active_session_id: inserted.id } as never)
    .eq("id", boardId);

  if (updateError) throw new Error(updateError.message);

  await ensureLessonActivityRun({
    boardId,
    classSessionId: inserted.id,
    lessonTemplateId: template.id,
    createdBy: actor.userId,
  });

  const activeSession = toActiveLessonSession(inserted);
  if (!activeSession) throw new Error("수업 실습 세션 정보를 확인하지 못했습니다.");
  return activeSession;
}

export async function endActiveLessonSessionForBoard(
  boardId: string,
  actor: LessonSessionActor,
): Promise<ActiveLessonSession | null> {
  await assertCanManageLessonSession(boardId, actor);

  const supabase = createSupabaseAdminClient();
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, active_session_id")
    .eq("id", boardId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; active_session_id: string | null }>();

  if (boardError) throw new Error(boardError.message);
  if (!board?.active_session_id) return null;

  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select("id, board_id, started_at, ended_at, status, report")
    .eq("id", board.active_session_id)
    .eq("board_id", boardId)
    .maybeSingle<ClassSessionLessonRow>();

  if (sessionError) throw new Error(sessionError.message);

  const activeLessonSession = session ? toActiveLessonSession(session) : null;
  if (!session || !activeLessonSession) {
    return null;
  }
  const sessionRow = session;

  await endActivityRunsForSession({ boardId, classSessionId: sessionRow.id });

  const endedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("class_sessions")
    .update({ ended_at: endedAt, status: "ended" })
    .eq("id", sessionRow.id)
    .select("id, board_id, started_at, ended_at, status, report")
    .single<ClassSessionLessonRow>();

  if (updateError) throw new Error(updateError.message);

  const { error: boardUpdateError } = await supabase
    .from("boards")
    .update({ active_session_id: null } as never)
    .eq("id", boardId)
    .eq("active_session_id" as never, sessionRow.id);

  if (boardUpdateError) throw new Error(boardUpdateError.message);

  return updated
    ? {
        ...activeLessonSession,
        endedAt: updated.ended_at,
        status: updated.status ?? "ended",
      }
    : activeLessonSession;
}
