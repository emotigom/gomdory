import type {
  LessonRunState,
  ResolveLessonRunStateInput,
  StartLessonRunTeacherSnapshot,
  ValidateStartLessonRunInput,
} from "@/lib/lesson-run/types";
import type { LessonRunDiagnosticsSnapshot } from "@/lib/lesson-run/loadLessonRunDiagnostics";

export type LessonRunDiagnosticsAdapterResult = {
  input: ResolveLessonRunStateInput;
  diagnosticsWarnings: string[];
};

function activeLessonActivity(snapshot: LessonRunDiagnosticsSnapshot) {
  const activeRun = snapshot.lessonActivityRuns.find((run) => run.status === "active" && !run.ended_at) ?? null;
  if (!activeRun) return null;
  return {
    active: true,
    class_session_id: activeRun.class_session_id,
    lesson_template_id: activeRun.lesson_template_id,
  };
}

export function toLessonRunInput(
  snapshot: LessonRunDiagnosticsSnapshot,
  now: string | Date,
): LessonRunDiagnosticsAdapterResult {
  const diagnosticsWarnings: string[] = [];

  if (!snapshot.board) {
    diagnosticsWarnings.push("boards row was not available for this diagnostics snapshot.");
  }

  if (!snapshot.eduClass) {
    diagnosticsWarnings.push("edu_classes row was not available; share and lock state may be partial.");
  }

  return {
    input: {
      now,
      board: snapshot.board
        ? {
            id: snapshot.board.id,
            share_code: snapshot.board.share_code,
            active_session_id: snapshot.board.active_session_id,
            class_state: snapshot.board.class_state,
            share_write_enabled: snapshot.board.share_write_enabled,
            deleted_at: snapshot.board.deleted_at ?? null,
          }
        : null,
      eduClass: snapshot.eduClass
        ? {
            board_id: snapshot.eduClass.board_id,
            share_code: snapshot.eduClass.share_code,
            locked_at: snapshot.eduClass.locked_at,
            lock_reason: snapshot.eduClass.lock_reason,
          }
        : null,
      studentAppClassSessions: snapshot.studentAppClassSessions.map((session) => ({
        id: session.id,
        status: session.status,
        starts_at: session.starts_at,
        ends_at: session.ends_at,
        ended_at: session.ended_at,
      })),
      classSessions: snapshot.classSessions.map((session) => ({
        id: session.id,
        status: session.status,
        started_at: session.started_at,
        ended_at: session.ended_at,
        report: session.report,
      })),
      studentAppDeployments: snapshot.studentAppDeployments.map((deployment) => ({
        id: deployment.id,
        status: deployment.status,
        title: deployment.title,
        published_at: deployment.published_at,
        archived_at: deployment.archived_at,
        deleted_at: deployment.deleted_at,
      })),
      lessonActivity: activeLessonActivity(snapshot),
      coursewareSessions: snapshot.coursewareSessions.map((session) => ({
        id: session.id,
        status: session.status,
        expires_at: session.expires_at,
        ended_at: session.closed_at,
      })),
      shareAccess: null,
      query: null,
    },
    diagnosticsWarnings,
  };
}

export function toStartLessonRunPreviewInput(args: {
  lessonRunInput: ResolveLessonRunStateInput;
  lessonRunState: LessonRunState;
  now: string | Date;
  requestedPreset?: string | null;
  teacher: StartLessonRunTeacherSnapshot;
}): ValidateStartLessonRunInput {
  return {
    now: args.now,
    lessonRunState: args.lessonRunState,
    board: args.lessonRunInput.board ?? null,
    eduClass: args.lessonRunInput.eduClass ?? null,
    studentAppDeployments: args.lessonRunInput.studentAppDeployments ?? [],
    lessonActivity: args.lessonRunInput.lessonActivity ?? null,
    studentAppClassSessions: args.lessonRunInput.studentAppClassSessions ?? [],
    requestedPreset: args.requestedPreset ?? "45m",
    teacher: args.teacher,
  };
}
