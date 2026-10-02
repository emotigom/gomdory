import type {
  LessonRunClassSessionSnapshot,
  LessonRunCoursewareSessionSnapshot,
  LessonRunIssue,
  LessonRunState,
  LessonRunStatus,
  LessonRunStudentAppClassSessionSnapshot,
  ResolveLessonRunStateInput,
} from "@/lib/lesson-run/types";

const LESSON_ACTIVITY_KIND = "gomdory_lesson_activity_session";
const RECENT_STUDENT_APP_SESSION_EXPIRATION_MS = 30 * 60 * 1000;

function asTimestamp(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function isPresent(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function firstString(...values: Array<string | null | undefined>): string | null {
  return values.find((value) => isPresent(value))?.trim() ?? null;
}

function isEnded(value: { endedAt?: string | null; ended_at?: string | null }): boolean {
  return Boolean(firstString(value.endedAt, value.ended_at));
}

function sessionEndsAt(session: LessonRunStudentAppClassSessionSnapshot): string | null {
  return firstString(session.endsAt, session.ends_at, session.expiresAt, session.expires_at);
}

function sessionStartsAt(session: LessonRunStudentAppClassSessionSnapshot): string | null {
  return firstString(session.startsAt, session.starts_at);
}

function isStudentAppSessionOpen(session: LessonRunStudentAppClassSessionSnapshot, nowMs: number): boolean {
  if (session.status && session.status !== "active") return false;
  if (isEnded(session)) return false;

  const startsAt = sessionStartsAt(session);
  if (startsAt && asTimestamp(startsAt) > nowMs) return false;

  const endsAt = sessionEndsAt(session);
  return Boolean(endsAt && asTimestamp(endsAt) > nowMs);
}

function isStudentAppSessionExpired(session: LessonRunStudentAppClassSessionSnapshot, nowMs: number): boolean {
  if (session.status && session.status !== "active") return false;
  if (isEnded(session)) return false;

  const endsAt = sessionEndsAt(session);
  return Boolean(endsAt && asTimestamp(endsAt) <= nowMs);
}

function isRecentlyExpiredStudentAppSession(session: LessonRunStudentAppClassSessionSnapshot, nowMs: number): boolean {
  const endsAt = sessionEndsAt(session);
  if (!endsAt) return false;
  const endedMs = asTimestamp(endsAt);
  return endedMs <= nowMs && nowMs - endedMs <= RECENT_STUDENT_APP_SESSION_EXPIRATION_MS;
}

function isClassSessionActive(session: LessonRunClassSessionSnapshot): boolean {
  if (isEnded(session)) return false;
  if (!session.status) return true;
  return ["active", "live", "running", "open"].includes(session.status);
}

function isCoursewareSessionActive(session: LessonRunCoursewareSessionSnapshot, nowMs: number): boolean {
  if (isEnded(session)) return false;
  if (session.status && ["ended", "closed", "archived"].includes(session.status)) return false;

  const expiresAt = firstString(session.expiresAt, session.expires_at);
  return !expiresAt || asTimestamp(expiresAt) > nowMs;
}

function reportHasLessonActivity(report: unknown): boolean {
  if (!report || typeof report !== "object" || Array.isArray(report)) return false;
  const lessonActivity = (report as { lessonActivity?: unknown }).lessonActivity;
  if (!lessonActivity || typeof lessonActivity !== "object" || Array.isArray(lessonActivity)) return false;
  return (lessonActivity as { kind?: unknown }).kind === LESSON_ACTIVITY_KIND;
}

function issue(code: LessonRunIssue["code"], message: string, severity: LessonRunIssue["severity"], refId?: string): LessonRunIssue {
  return { code, message, severity, ...(refId ? { refId } : {}) };
}

function pickTeacherStatus(args: {
  hasConflict: boolean;
  hasShareCode: boolean;
  eduClassLocked: boolean;
  hasOpenStudentAppSession: boolean;
  sessionExpired: boolean;
  canExtendStudentAppSession: boolean;
  hasStudentAppDeployment: boolean;
}): LessonRunStatus {
  if (args.hasConflict) return "conflict";
  if (!args.hasShareCode) return "no_share_code";
  if (args.eduClassLocked && args.hasOpenStudentAppSession) return "open_but_locked";
  if (args.eduClassLocked) return "locked";
  if (args.hasOpenStudentAppSession) return "open";
  if (args.sessionExpired && args.canExtendStudentAppSession) return "expired";
  if (args.hasStudentAppDeployment) return "ready_to_start";
  if (args.sessionExpired) return "expired";
  return "board_only";
}

function pickStudentStatus(args: {
  hasShareCode: boolean;
  eduClassLocked: boolean;
  hasOpenStudentAppSession: boolean;
  sessionExpired: boolean;
  hasStudentAppDeployment: boolean;
}): LessonRunStatus {
  if (!args.hasShareCode) return "no_share_code";
  if (args.eduClassLocked && args.hasOpenStudentAppSession) return "submissions_locked";
  if (args.eduClassLocked) return "locked";
  if (args.hasOpenStudentAppSession) return "student_app_open";
  if (args.hasStudentAppDeployment) return "submissions_locked";
  if (args.sessionExpired) return "expired";
  return "board_only";
}

export function resolveLessonRunState(input: ResolveLessonRunStateInput): LessonRunState {
  const nowMs = asTimestamp(input.now);
  const board = input.board ?? null;
  const eduClass = input.eduClass ?? null;
  const studentAppClassSessions = input.studentAppClassSessions ?? [];
  const classSessions = input.classSessions ?? [];
  const studentAppDeployments = input.studentAppDeployments ?? [];
  const coursewareSessions = input.coursewareSessions ?? [];

  const boardReady = Boolean(board && !firstString(board.deletedAt, board.deleted_at));
  const shareCode = firstString(board?.shareCode, board?.share_code, eduClass?.shareCode, eduClass?.share_code);
  const hasShareCode = Boolean(shareCode);
  const eduClassLocked = Boolean(firstString(eduClass?.lockedAt, eduClass?.locked_at));

  const activeStudentAppSessions = studentAppClassSessions.filter((session) => isStudentAppSessionOpen(session, nowMs));
  const expiredStudentAppSessions = studentAppClassSessions.filter((session) => isStudentAppSessionExpired(session, nowMs));
  const activeClassSessions = classSessions.filter(isClassSessionActive);
  const publishedDeployments = studentAppDeployments.filter((deployment) => {
    if (firstString(deployment.deletedAt, deployment.deleted_at, deployment.archivedAt, deployment.archived_at)) return false;
    return deployment.status === "published" && Boolean(firstString(deployment.publishedAt, deployment.published_at));
  });
  const usableDeployments = studentAppDeployments.filter((deployment) => {
    if (firstString(deployment.deletedAt, deployment.deleted_at, deployment.archivedAt, deployment.archived_at)) return false;
    return deployment.status !== "blocked" && deployment.status !== "archived";
  });

  const hasStudentAppDeployment = usableDeployments.length > 0;
  const hasOpenStudentAppSession = activeStudentAppSessions.length > 0;
  const sessionExpired = expiredStudentAppSessions.length > 0 && !hasOpenStudentAppSession;
  const canExtendStudentAppSession =
    sessionExpired && expiredStudentAppSessions.some((session) => isRecentlyExpiredStudentAppSession(session, nowMs));
  const hasActiveClassSession = activeClassSessions.length > 0 || Boolean(firstString(board?.activeSessionId, board?.active_session_id));
  const hasLessonActivity = Boolean(input.lessonActivity?.active) || activeClassSessions.some((session) => reportHasLessonActivity(session.report));
  const galleryMaybeAvailable = publishedDeployments.length > 0;
  const queryWantsStudentApp =
    input.query?.view === "student-app" || input.query?.mode === "coding" || isPresent(input.query?.lessonKit ?? input.query?.lesson_kit);
  const hasAccessProof = input.shareAccess?.hasAccessProof ?? input.shareAccess?.has_access_proof ?? null;
  const activeCoursewareSessions = coursewareSessions.filter((session) => isCoursewareSessionActive(session, nowMs));

  const blockingReasons: LessonRunIssue[] = [];
  const warnings: LessonRunIssue[] = [];
  const conflicts: LessonRunIssue[] = [];

  if (!hasShareCode) {
    blockingReasons.push(issue("no_share_code", "Board or EDU class snapshot has no share code.", "blocking"));
  }

  if (!hasStudentAppDeployment) {
    warnings.push(issue("no_deployment", "No usable student app deployment is present.", "warning"));
  }

  if (hasStudentAppDeployment && !hasOpenStudentAppSession && !canExtendStudentAppSession) {
    const message = sessionExpired
      ? "A deployment exists, but the prior student app submission window is closed. Start a new lesson window for students."
      : "A deployment exists, but no open student app submission window was found. Start the lesson window before collecting submissions.";
    warnings.push(issue("no_open_student_app_session", message, "warning"));
  }

  if (canExtendStudentAppSession) {
    for (const session of expiredStudentAppSessions.filter((expiredSession) => isRecentlyExpiredStudentAppSession(expiredSession, nowMs))) {
      warnings.push(
        issue(
          "student_app_session_expired",
          "The most recent student app submission window just ended and may be extended.",
          "warning",
          session.id,
        ),
      );
    }
  }

  for (const session of studentAppClassSessions) {
    if (session.status === "active" && !isEnded(session)) {
      const startsAt = sessionStartsAt(session);
      if (startsAt && asTimestamp(startsAt) > nowMs) {
        warnings.push(issue("student_app_session_not_started", "A student app session is active but starts in the future.", "warning", session.id));
      }
    }
  }

  if (hasOpenStudentAppSession && eduClassLocked) {
    conflicts.push(
      issue(
        "student_app_session_open_while_edu_class_locked",
        "Student app submissions look open, but the EDU class is locked.",
        "conflict",
        activeStudentAppSessions[0]?.id,
      ),
    );
  }

  if (activeStudentAppSessions.length > 1) {
    conflicts.push(issue("multiple_open_student_app_sessions", "Multiple student app submission windows are open at the same time.", "conflict"));
  }

  if (queryWantsStudentApp && !hasOpenStudentAppSession) {
    warnings.push(
      issue(
        "query_student_app_without_open_session",
        "The student-app query can open the coding workspace even though no active submission window is open.",
        "warning",
      ),
    );
  }

  if (hasActiveClassSession && hasStudentAppDeployment && !hasOpenStudentAppSession) {
    warnings.push(
      issue("active_class_without_student_app_window", "A class or lesson session is active, but student app submissions are closed.", "warning"),
    );
  }

  if (hasOpenStudentAppSession && !hasActiveClassSession) {
    warnings.push(
      issue("student_app_window_without_active_class", "Student app submissions are open without an active class or lesson session.", "warning"),
    );
  }

  if (galleryMaybeAvailable && !hasOpenStudentAppSession) {
    warnings.push(
      issue(
        "gallery_open_while_submissions_closed",
        "Published student apps may remain visible while new submissions are closed.",
        "warning",
      ),
    );
  }

  if (galleryMaybeAvailable && eduClassLocked) {
    warnings.push(issue("gallery_open_while_edu_class_locked", "Published app gallery state is separate from EDU class lock state.", "warning"));
  }

  if (activeCoursewareSessions.length > 0 && (hasStudentAppDeployment || hasOpenStudentAppSession)) {
    warnings.push(
      issue(
        "courseware_session_parallel_to_student_app_flow",
        "Courseware session state exists in parallel with the student app deployment/session flow.",
        "warning",
        activeCoursewareSessions[0]?.id,
      ),
    );
  }

  if (hasAccessProof === false && (queryWantsStudentApp || hasOpenStudentAppSession)) {
    blockingReasons.push(issue("share_access_missing", "Student access proof is missing for a student app workspace.", "blocking"));
  }

  const submissionsOpen = hasOpenStudentAppSession && !eduClassLocked;
  const uploadsOpen = submissionsOpen;
  const studentWorkspaceAvailable = hasShareCode && (hasOpenStudentAppSession || hasLessonActivity || queryWantsStudentApp);
  const hasConflict = conflicts.length > 0;
  const teacherPrimaryStatus = pickTeacherStatus({
    hasConflict,
    hasShareCode,
    eduClassLocked,
    hasOpenStudentAppSession,
    sessionExpired,
    canExtendStudentAppSession,
    hasStudentAppDeployment,
  });
  const studentPrimaryStatus = hasConflict
    ? "conflict"
    : pickStudentStatus({ hasShareCode, eduClassLocked, hasOpenStudentAppSession, sessionExpired, hasStudentAppDeployment });

  let recommendedTeacherAction: LessonRunState["recommendedTeacherAction"] = "read_only";
  if (hasConflict) recommendedTeacherAction = "resolve_conflict";
  else if (!hasShareCode) recommendedTeacherAction = "create_share_code";
  else if (hasOpenStudentAppSession) recommendedTeacherAction = "end_lesson";
  else if (hasStudentAppDeployment && !canExtendStudentAppSession) recommendedTeacherAction = "start_lesson";
  else if (canExtendStudentAppSession) recommendedTeacherAction = "extend_lesson";
  else if (!hasLessonActivity) recommendedTeacherAction = "choose_activity";

  return {
    boardReady,
    hasShareCode,
    hasStudentAppDeployment,
    hasOpenStudentAppSession,
    hasActiveClassSession,
    hasLessonActivity,
    eduClassLocked,
    sessionExpired,
    submissionsOpen,
    uploadsOpen,
    studentWorkspaceAvailable,
    galleryMaybeAvailable,
    teacherPrimaryStatus,
    studentPrimaryStatus,
    recommendedTeacherAction,
    blockingReasons,
    warnings,
    conflicts,
    activeStudentAppSessionIds: activeStudentAppSessions.map((session) => session.id),
    expiredStudentAppSessionIds: expiredStudentAppSessions.map((session) => session.id),
    activeClassSessionIds: activeClassSessions.map((session) => session.id),
    publishedDeploymentIds: publishedDeployments.map((deployment) => deployment.id),
  };
}
