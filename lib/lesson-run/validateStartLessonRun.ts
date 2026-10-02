import {
  isValidLessonRunDuration,
  normalizeLessonRunGalleryMode,
  resolveLessonRunPreset,
} from "@/lib/lesson-run/lessonRunPresets";
import type {
  LessonRunIssue,
  LessonRunIssueCode,
  LessonRunTeacherAction,
  StartLessonRunIdempotencyDisposition,
  StartLessonRunNormalizedInput,
  ValidateStartLessonRunInput,
  ValidateStartLessonRunResult,
} from "@/lib/lesson-run/types";

const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

function issue(code: LessonRunIssueCode, message: string, severity: LessonRunIssue["severity"], refId?: string): LessonRunIssue {
  return { code, message, severity, ...(refId ? { refId } : {}) };
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function addMinutesIso(value: string, minutes: number): string {
  const startMs = new Date(value).getTime();
  return new Date(startMs + minutes * 60 * 1000).toISOString();
}

function firstString(...values: Array<string | null | undefined>): string | null {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
}

function normalizeRequestId(value: string | null | undefined): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : undefined;
}

function isSafeRequestId(value: string): boolean {
  return value.length <= MAX_REQUEST_ID_LENGTH && SAFE_REQUEST_ID_PATTERN.test(value);
}

function isTeacherRoleAllowed(input: ValidateStartLessonRunInput): boolean {
  const role = input.teacher?.role?.toLowerCase().trim() ?? "";
  const roleAllowed = role === "owner" || role === "editor" || role === "admin";
  const canEdit = input.teacher?.canEditBoard;
  const canStart = input.teacher?.canStartLessonRun;
  if (canEdit === false || canStart === false) return false;
  return roleAllowed || canEdit === true || canStart === true;
}

function hasUsableActivity(input: ValidateStartLessonRunInput): boolean {
  if (input.lessonRunState.hasStudentAppDeployment || input.lessonRunState.hasLessonActivity) return true;
  if (input.lessonActivity?.active) return true;
  return (input.studentAppDeployments ?? []).some((deployment) => {
    const deletedAt = firstString(deployment.deletedAt, deployment.deleted_at);
    const archivedAt = firstString(deployment.archivedAt, deployment.archived_at);
    return !deletedAt && !archivedAt && deployment.status !== "blocked" && deployment.status !== "archived";
  });
}

function fail(args: {
  code: LessonRunIssueCode;
  message: string;
  action: LessonRunTeacherAction;
  status: number;
  conflicts?: LessonRunIssue[];
  warnings?: LessonRunIssue[];
  refId?: string;
  idempotencyDisposition?: StartLessonRunIdempotencyDisposition;
  reusableSessionId?: string;
  idempotencyWarning?: string;
}): ValidateStartLessonRunResult {
  return {
    ok: false,
    normalizedInput: null,
    blockingReasons: [issue(args.code, args.message, "blocking", args.refId)],
    warnings: args.warnings ?? [],
    conflicts: args.conflicts ?? [],
    teacherMessage: args.message,
    recommendedTeacherAction: args.action,
    httpStatusCandidate: args.status,
    ...(args.idempotencyDisposition ? { idempotencyDisposition: args.idempotencyDisposition } : {}),
    ...(args.reusableSessionId ? { reusableSessionId: args.reusableSessionId } : {}),
    ...(args.idempotencyWarning ? { idempotencyWarning: args.idempotencyWarning } : {}),
  };
}

function buildResult(input: ValidateStartLessonRunInput): ValidateStartLessonRunResult {
  const state = input.lessonRunState;
  const warnings = [...state.warnings];
  const conflicts = [...state.conflicts];
  const idempotencyKey = normalizeRequestId(input.idempotencyKey);
  const clientRequestId = normalizeRequestId(input.clientRequestId);
  const invalidRequestId =
    (idempotencyKey && !isSafeRequestId(idempotencyKey)) || (clientRequestId && !isSafeRequestId(clientRequestId));

  if (invalidRequestId) {
    return fail({
      code: "invalid_idempotency_key",
      message: "요청 식별자는 128자 이하의 영문, 숫자, 마침표, 밑줄, 콜론, 하이픈만 사용할 수 있습니다.",
      action: "read_only",
      status: 400,
      warnings,
      conflicts,
      idempotencyDisposition: "invalid_idempotency_key",
      idempotencyWarning: "idempotencyKey/clientRequestId는 비밀값이 아닌 불투명 식별자여야 하며 저장/노출 대상이 아닙니다.",
    });
  }

  if (!state.boardReady) {
    return fail({
      code: "board_not_ready",
      message: "보드 상태를 확인한 뒤 수업을 시작해주세요.",
      action: "read_only",
      status: 409,
      warnings,
      conflicts,
    });
  }

  if (!state.hasShareCode) {
    return fail({
      code: "no_share_code",
      message: "학생 입장 경로를 먼저 확인해주세요.",
      action: "create_share_code",
      status: 409,
      warnings,
      conflicts,
    });
  }

  if (!isTeacherRoleAllowed(input)) {
    return fail({
      code: "permission_denied",
      message: "이 보드에서 수업을 시작할 권한이 없습니다.",
      action: "read_only",
      status: 403,
      warnings,
      conflicts,
    });
  }

  if (!hasUsableActivity(input)) {
    return fail({
      code: "no_deployment",
      message: "학생에게 열 활동을 먼저 선택해주세요.",
      action: "choose_activity",
      status: 409,
      warnings,
      conflicts,
    });
  }

  const preset = resolveLessonRunPreset(input.requestedPreset);
  if (!preset) {
    return fail({
      code: "invalid_preset",
      message: "수업 시작 옵션을 다시 선택해주세요.",
      action: "choose_activity",
      status: 400,
      warnings,
      conflicts,
    });
  }

  const durationMinutes = input.durationMinutes ?? preset.durationMinutes;
  if (!isValidLessonRunDuration(durationMinutes)) {
    return fail({
      code: "invalid_duration",
      message: "수업 시간을 다시 선택해주세요.",
      action: "choose_activity",
      status: 400,
      warnings,
      conflicts,
    });
  }

  const submissionsOpen = input.options?.submissionsOpen ?? preset.submissionsOpen;
  const uploadsOpen = input.options?.uploadsOpen ?? preset.uploadsOpen;
  const galleryMode = normalizeLessonRunGalleryMode(input.options?.galleryMode) ?? preset.galleryMode;
  const autoLock = input.options?.autoLock ?? preset.autoLock;

  if (uploadsOpen && !submissionsOpen) {
    return fail({
      code: "invalid_submission_policy",
      message: "제출 설정을 다시 확인해주세요.",
      action: "choose_activity",
      status: 400,
      warnings,
      conflicts,
    });
  }

  if (state.eduClassLocked) {
    return fail({
      code: "class_locked",
      message: "제출이 잠겨 있어 수업을 시작할 수 없습니다. 잠금 상태를 먼저 확인해주세요.",
      action: "resolve_conflict",
      status: 409,
      warnings,
      conflicts,
    });
  }

  if (state.activeStudentAppSessionIds.length > 1) {
    return fail({
      code: "multiple_open_student_app_sessions",
      message: "열린 수업 시간이 여러 개입니다. 진단에서 상태를 확인해주세요.",
      action: "resolve_conflict",
      status: 409,
      warnings,
      conflicts,
      idempotencyDisposition: "conflict_multiple_open_sessions",
      idempotencyWarning: "중복 시작을 막기 위해 새 수업 시작은 허용하지 않고 충돌 해결을 먼저 요구합니다.",
    });
  }

  if (state.hasOpenStudentAppSession) {
    const reusableSessionId = state.activeStudentAppSessionIds[0];
    const disposition = idempotencyKey || clientRequestId ? "reuse_open_session" : "resume_existing_session";
    return fail({
      code: "active_student_app_session_already_open",
      message: "이미 열린 수업 시간이 있습니다. 현재 열린 수업으로 계속해주세요.",
      action: state.sessionExpired ? "extend_lesson" : "resume_lesson",
      status: 409,
      warnings,
      conflicts,
      refId: reusableSessionId,
      idempotencyDisposition: disposition,
      reusableSessionId,
      idempotencyWarning:
        disposition === "reuse_open_session"
          ? "같은 요청 재시도는 새 start가 아니라 현재 열린 수업 재사용으로 처리해야 합니다."
          : "짧은 시간 안의 중복 클릭으로 보고 새 start를 막고 현재 열린 수업 재개를 안내합니다.",
    });
  }

  if (state.sessionExpired && state.expiredStudentAppSessionIds.length > 0) {
    const recentExpiredWarning = warnings.find((warning) => warning.code === "student_app_session_expired");
    if (recentExpiredWarning) {
      return fail({
        code: "student_app_session_expired",
        message: "방금 종료된 수업 시간이 있습니다. 새로 시작할지 시간을 연장할지 먼저 확인해주세요.",
        action: "extend_lesson",
        status: 409,
        warnings,
        conflicts,
        refId: recentExpiredWarning.refId ?? state.expiredStudentAppSessionIds[0],
        idempotencyDisposition: "recent_expired_session",
        reusableSessionId: recentExpiredWarning.refId ?? state.expiredStudentAppSessionIds[0],
        idempotencyWarning: "최근 만료 세션은 자동 중복 방지 blocker는 아니지만 restart/extend 판단이 필요합니다.",
      });
    }
  }

  if (state.recommendedTeacherAction !== "start_lesson") {
    return fail({
      code: "recommended_action_not_start_lesson",
      message: "현재 상태에서는 바로 수업을 시작할 수 없습니다. 진단에서 다음 작업을 확인해주세요.",
      action: state.recommendedTeacherAction,
      status: 409,
      warnings,
      conflicts,
    });
  }

  const nowIso = toIso(input.now);
  const endsAt = addMinutesIso(nowIso, durationMinutes);
  if (new Date(endsAt).getTime() <= new Date(nowIso).getTime()) {
    return fail({
      code: "invalid_time_window",
      message: "수업 시간을 계산하지 못했습니다. 다시 시도해주세요.",
      action: "read_only",
      status: 500,
      warnings,
      conflicts,
    });
  }

  const normalizedInput: StartLessonRunNormalizedInput = {
    now: nowIso,
    preset,
    durationMinutes,
    startsAt: nowIso,
    endsAt,
    submissionsOpen,
    uploadsOpen,
    galleryMode,
    autoLock,
    teacherRole: input.teacher?.role?.toLowerCase().trim() ?? null,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(clientRequestId ? { clientRequestId } : {}),
  };

  return {
    ok: true,
    normalizedInput,
    blockingReasons: [],
    warnings,
    conflicts,
    teacherMessage: "수업을 시작할 준비가 되었습니다.",
    recommendedTeacherAction: "start_lesson",
    httpStatusCandidate: 200,
    idempotencyDisposition: "new_start_allowed",
  };
}

export function validateStartLessonRun(input: ValidateStartLessonRunInput): ValidateStartLessonRunResult {
  return buildResult(input);
}
