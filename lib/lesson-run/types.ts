export type LessonRunStatus =
  | "no_share_code"
  | "no_deployment"
  | "ready_to_start"
  | "open"
  | "open_but_locked"
  | "expired"
  | "locked"
  | "board_only"
  | "student_app_open"
  | "submissions_open"
  | "submissions_locked"
  | "conflict";

export type LessonRunTeacherAction =
  | "create_share_code"
  | "choose_activity"
  | "start_lesson"
  | "resume_lesson"
  | "extend_lesson"
  | "lock_submissions"
  | "end_lesson"
  | "review_submissions"
  | "resolve_conflict"
  | "read_only";

export type LessonRunIssueCode =
  | "auth_required"
  | "board_not_ready"
  | "board_not_found"
  | "permission_denied"
  | "invalid_preset"
  | "invalid_duration"
  | "invalid_idempotency_key"
  | "invalid_submission_policy"
  | "invalid_time_window"
  | "class_locked"
  | "active_student_app_session_already_open"
  | "active_conflicting_student_app_session"
  | "recommended_action_not_start_lesson"
  | "no_share_code"
  | "no_deployment"
  | "no_open_student_app_session"
  | "student_app_session_expired"
  | "student_app_session_not_started"
  | "student_app_session_open_while_edu_class_locked"
  | "multiple_open_student_app_sessions"
  | "query_student_app_without_open_session"
  | "active_class_without_student_app_window"
  | "student_app_window_without_active_class"
  | "gallery_open_while_submissions_closed"
  | "gallery_open_while_edu_class_locked"
  | "courseware_session_parallel_to_student_app_flow"
  | "share_access_missing";

export type LessonRunIssue = {
  code: LessonRunIssueCode;
  message: string;
  severity: "blocking" | "warning" | "conflict";
  refId?: string;
};

export type LessonRunBoardSnapshot = {
  id?: string | null;
  shareCode?: string | null;
  share_code?: string | null;
  activeSessionId?: string | null;
  active_session_id?: string | null;
  classState?: string | null;
  class_state?: string | null;
  shareWriteEnabled?: boolean | null;
  share_write_enabled?: boolean | null;
  deletedAt?: string | null;
  deleted_at?: string | null;
};

export type LessonRunEduClassSnapshot = {
  boardId?: string | null;
  board_id?: string | null;
  shareCode?: string | null;
  share_code?: string | null;
  lockedAt?: string | null;
  locked_at?: string | null;
  lockReason?: string | null;
  lock_reason?: string | null;
};

export type LessonRunStudentAppClassSessionSnapshot = {
  id: string;
  status?: string | null;
  startsAt?: string | null;
  starts_at?: string | null;
  endsAt?: string | null;
  ends_at?: string | null;
  expiresAt?: string | null;
  expires_at?: string | null;
  endedAt?: string | null;
  ended_at?: string | null;
};

export type LessonRunClassSessionSnapshot = {
  id: string;
  status?: string | null;
  startedAt?: string | null;
  started_at?: string | null;
  endedAt?: string | null;
  ended_at?: string | null;
  report?: unknown;
};

export type LessonRunStudentAppDeploymentSnapshot = {
  id: string;
  status?: string | null;
  title?: string | null;
  publishedAt?: string | null;
  published_at?: string | null;
  archivedAt?: string | null;
  archived_at?: string | null;
  deletedAt?: string | null;
  deleted_at?: string | null;
};

export type LessonRunActivitySnapshot = {
  active?: boolean | null;
  classSessionId?: string | null;
  class_session_id?: string | null;
  lessonTemplateId?: string | null;
  lesson_template_id?: string | null;
};

export type LessonRunCoursewareSessionSnapshot = {
  id: string;
  status?: string | null;
  expiresAt?: string | null;
  expires_at?: string | null;
  endedAt?: string | null;
  ended_at?: string | null;
};

export type LessonRunQuerySnapshot = {
  view?: string | null;
  mode?: string | null;
  lessonKit?: string | null;
  lesson_kit?: string | null;
};

export type LessonRunShareAccessSnapshot = {
  hasAccessProof?: boolean | null;
  has_access_proof?: boolean | null;
  source?: string | null;
};

export type ResolveLessonRunStateInput = {
  now: string | Date;
  board?: LessonRunBoardSnapshot | null;
  eduClass?: LessonRunEduClassSnapshot | null;
  studentAppClassSessions?: readonly LessonRunStudentAppClassSessionSnapshot[];
  classSessions?: readonly LessonRunClassSessionSnapshot[];
  studentAppDeployments?: readonly LessonRunStudentAppDeploymentSnapshot[];
  lessonActivity?: LessonRunActivitySnapshot | null;
  coursewareSessions?: readonly LessonRunCoursewareSessionSnapshot[];
  query?: LessonRunQuerySnapshot | null;
  shareAccess?: LessonRunShareAccessSnapshot | null;
};

export type LessonRunState = {
  boardReady: boolean;
  hasShareCode: boolean;
  hasStudentAppDeployment: boolean;
  hasOpenStudentAppSession: boolean;
  hasActiveClassSession: boolean;
  hasLessonActivity: boolean;
  eduClassLocked: boolean;
  sessionExpired: boolean;
  submissionsOpen: boolean;
  uploadsOpen: boolean;
  studentWorkspaceAvailable: boolean;
  galleryMaybeAvailable: boolean;
  teacherPrimaryStatus: LessonRunStatus;
  studentPrimaryStatus: LessonRunStatus;
  recommendedTeacherAction: LessonRunTeacherAction;
  blockingReasons: LessonRunIssue[];
  warnings: LessonRunIssue[];
  conflicts: LessonRunIssue[];
  activeStudentAppSessionIds: string[];
  expiredStudentAppSessionIds: string[];
  activeClassSessionIds: string[];
  publishedDeploymentIds: string[];
};

export type StartLessonRunPresetId =
  | "45m"
  | "90m"
  | "practice"
  | "presentation"
  | "submissions_only"
  | "gallery_view";

export type LessonRunGalleryMode = "off" | "presentation" | "gallery";

export type LessonRunPreset = {
  id: StartLessonRunPresetId;
  durationMinutes: number;
  submissionsOpen: boolean;
  uploadsOpen: boolean;
  galleryMode: LessonRunGalleryMode;
  autoLock: boolean;
  teacherLabel: string;
  studentLabel: string;
};

export type StartLessonRunTeacherSnapshot = {
  role?: "owner" | "editor" | "viewer" | "read_only" | "admin" | string | null;
  canEditBoard?: boolean | null;
  canStartLessonRun?: boolean | null;
};

export type StartLessonRunRequestedOptions = {
  submissionsOpen?: boolean | null;
  uploadsOpen?: boolean | null;
  galleryMode?: LessonRunGalleryMode | boolean | null;
  autoLock?: boolean | null;
};

export type StartLessonRunNormalizedInput = {
  now: string;
  preset: LessonRunPreset;
  durationMinutes: number;
  startsAt: string;
  endsAt: string;
  submissionsOpen: boolean;
  uploadsOpen: boolean;
  galleryMode: LessonRunGalleryMode;
  autoLock: boolean;
  teacherRole: string | null;
  idempotencyKey?: string;
  clientRequestId?: string;
};

export type StartLessonRunIdempotencyDisposition =
  | "new_start_allowed"
  | "reuse_open_session"
  | "resume_existing_session"
  | "recent_expired_session"
  | "conflict_multiple_open_sessions"
  | "invalid_idempotency_key";

export type ValidateStartLessonRunInput = {
  now: string | Date;
  lessonRunState: LessonRunState;
  board?: LessonRunBoardSnapshot | null;
  eduClass?: LessonRunEduClassSnapshot | null;
  studentAppDeployments?: readonly LessonRunStudentAppDeploymentSnapshot[];
  lessonActivity?: LessonRunActivitySnapshot | null;
  studentAppClassSessions?: readonly LessonRunStudentAppClassSessionSnapshot[];
  requestedPreset?: string | null;
  durationMinutes?: number | null;
  options?: StartLessonRunRequestedOptions | null;
  teacher?: StartLessonRunTeacherSnapshot | null;
  idempotencyKey?: string | null;
  clientRequestId?: string | null;
};

export type ValidateStartLessonRunResult = {
  ok: boolean;
  normalizedInput: StartLessonRunNormalizedInput | null;
  blockingReasons: LessonRunIssue[];
  warnings: LessonRunIssue[];
  conflicts: LessonRunIssue[];
  teacherMessage: string;
  recommendedTeacherAction: LessonRunTeacherAction;
  httpStatusCandidate: number;
  idempotencyDisposition?: StartLessonRunIdempotencyDisposition;
  reusableSessionId?: string;
  idempotencyWarning?: string;
};
