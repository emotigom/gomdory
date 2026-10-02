import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LESSON_RUN_PRESETS, resolveLessonRunPreset } from "@/lib/lesson-run/lessonRunPresets";
import { resolveLessonRunState } from "@/lib/lesson-run/resolveLessonRunState";
import type { ResolveLessonRunStateInput, ValidateStartLessonRunInput } from "@/lib/lesson-run/types";
import { validateStartLessonRun } from "@/lib/lesson-run/validateStartLessonRun";

const now = "2026-07-08T03:00:00.000Z";

const board = {
  id: "board-1",
  share_code: "CLASS20",
  deleted_at: null,
};

const eduClass = {
  board_id: "board-1",
  share_code: "CLASS20",
  locked_at: null,
};

const deployment = {
  id: "deployment-1",
  status: "published",
  title: "Demo app",
  published_at: "2026-07-08T01:00:00.000Z",
  archived_at: null,
  deleted_at: null,
};

const openStudentAppSession = {
  id: "student-app-session-1",
  status: "active",
  starts_at: "2026-07-08T01:00:00.000Z",
  ends_at: "2026-07-08T07:00:00.000Z",
  ended_at: null,
};

const expiredOldStudentAppSession = {
  id: "student-app-session-expired-old",
  status: "active",
  starts_at: "2026-07-07T01:00:00.000Z",
  ends_at: "2026-07-07T07:00:00.000Z",
  ended_at: null,
};

const expiredRecentStudentAppSession = {
  id: "student-app-session-expired-recent",
  status: "active",
  starts_at: "2026-07-08T01:00:00.000Z",
  ends_at: "2026-07-08T02:45:00.000Z",
  ended_at: null,
};

function makeState(overrides: Partial<ResolveLessonRunStateInput> = {}) {
  return resolveLessonRunState({
    now,
    board,
    eduClass,
    studentAppDeployments: [deployment],
    studentAppClassSessions: [],
    classSessions: [],
    ...overrides,
  });
}

function validate(overrides: Partial<ValidateStartLessonRunInput> = {}) {
  const lessonRunState = overrides.lessonRunState ?? makeState();
  return validateStartLessonRun({
    now,
    lessonRunState,
    board,
    eduClass,
    studentAppDeployments: [deployment],
    studentAppClassSessions: [],
    requestedPreset: "45m",
    teacher: { role: "owner" },
    ...overrides,
  });
}

test("preset helper maps supported lesson run presets", () => {
  assert.deepEqual(Object.keys(LESSON_RUN_PRESETS), ["45m", "90m", "practice", "presentation", "submissions_only", "gallery_view"]);
  assert.equal(resolveLessonRunPreset("45m")?.durationMinutes, 45);
  assert.equal(resolveLessonRunPreset("90m")?.durationMinutes, 90);
  assert.equal(resolveLessonRunPreset("practice")?.submissionsOpen, true);
  assert.equal(resolveLessonRunPreset("presentation")?.uploadsOpen, false);
  assert.equal(resolveLessonRunPreset("submissions_only")?.autoLock, true);
  assert.equal(resolveLessonRunPreset("gallery_view")?.galleryMode, "gallery");
});

test("ready_to_start with valid preset returns ok normalized input", () => {
  const result = validate({ idempotencyKey: "idem-1", clientRequestId: "client-1" });

  assert.equal(result.ok, true);
  assert.equal(result.recommendedTeacherAction, "start_lesson");
  assert.equal(result.httpStatusCandidate, 200);
  assert.equal(result.normalizedInput?.preset.id, "45m");
  assert.equal(result.normalizedInput?.durationMinutes, 45);
  assert.equal(result.normalizedInput?.submissionsOpen, true);
  assert.equal(result.normalizedInput?.uploadsOpen, true);
  assert.equal(result.normalizedInput?.startsAt, now);
  assert.equal(result.normalizedInput?.endsAt, "2026-07-08T03:45:00.000Z");
  assert.equal(result.normalizedInput?.idempotencyKey, "idem-1");
  assert.equal(result.normalizedInput?.clientRequestId, "client-1");
  assert.equal(result.idempotencyDisposition, "new_start_allowed");
});

test("no share code blocks and recommends create_share_code", () => {
  const state = makeState({
    board: { ...board, share_code: null },
    eduClass: { ...eduClass, share_code: null },
  });
  const result = validate({
    lessonRunState: state,
    board: { ...board, share_code: null },
    eduClass: { ...eduClass, share_code: null },
  });

  assert.equal(result.ok, false);
  assert.equal(result.recommendedTeacherAction, "create_share_code");
  assert.equal(result.blockingReasons[0]?.code, "no_share_code");
});

test("no deployment or lesson activity blocks and recommends choose_activity", () => {
  const state = makeState({ studentAppDeployments: [] });
  const result = validate({
    lessonRunState: state,
    studentAppDeployments: [],
  });

  assert.equal(result.ok, false);
  assert.equal(result.recommendedTeacherAction, "choose_activity");
  assert.equal(result.blockingReasons[0]?.code, "no_deployment");
});

test("insufficient permission blocks with read_only and forbidden status", () => {
  const result = validate({ teacher: { role: "viewer" } });

  assert.equal(result.ok, false);
  assert.equal(result.recommendedTeacherAction, "read_only");
  assert.equal(result.httpStatusCandidate, 403);
  assert.equal(result.blockingReasons[0]?.code, "permission_denied");
});

test("active open session blocks start and points teacher to resume or extend", () => {
  const state = makeState({ studentAppClassSessions: [openStudentAppSession] });
  const result = validate({
    lessonRunState: state,
    studentAppClassSessions: [openStudentAppSession],
  });

  assert.equal(result.ok, false);
  assert.equal(result.blockingReasons[0]?.code, "active_student_app_session_already_open");
  assert.equal(result.recommendedTeacherAction, "resume_lesson");
  assert.equal(result.httpStatusCandidate, 409);
  assert.equal(result.idempotencyDisposition, "resume_existing_session");
  assert.equal(result.reusableSessionId, "student-app-session-1");
});

test("expired old session only with deployment still allows start_lesson", () => {
  const state = makeState({ studentAppClassSessions: [expiredOldStudentAppSession] });
  const result = validate({
    lessonRunState: state,
    studentAppClassSessions: [expiredOldStudentAppSession],
  });

  assert.equal(state.recommendedTeacherAction, "start_lesson");
  assert.equal(result.ok, true);
  assert.equal(result.normalizedInput?.preset.id, "45m");
  assert.equal(result.idempotencyDisposition, "new_start_allowed");
  assert.equal(result.warnings.some((warning) => warning.code === "no_open_student_app_session"), true);
  assert.equal(result.warnings.some((warning) => warning.code === "student_app_session_expired"), false);
});

test("same idempotency key with existing open session reuses the current session", () => {
  const state = makeState({ studentAppClassSessions: [openStudentAppSession] });
  const result = validate({
    lessonRunState: state,
    studentAppClassSessions: [openStudentAppSession],
    idempotencyKey: "lesson-start:board-1:teacher-1:click-1",
  });

  assert.equal(result.ok, false);
  assert.equal(result.blockingReasons[0]?.code, "active_student_app_session_already_open");
  assert.equal(result.recommendedTeacherAction, "resume_lesson");
  assert.equal(result.idempotencyDisposition, "reuse_open_session");
  assert.equal(result.reusableSessionId, "student-app-session-1");
  assert.match(result.idempotencyWarning ?? "", /재사용/);
});

test("missing idempotency key with existing open session prevents duplicate start", () => {
  const state = makeState({ studentAppClassSessions: [openStudentAppSession] });
  const result = validate({
    lessonRunState: state,
    studentAppClassSessions: [openStudentAppSession],
    idempotencyKey: "   ",
    clientRequestId: "",
  });

  assert.equal(result.ok, false);
  assert.equal(result.blockingReasons[0]?.code, "active_student_app_session_already_open");
  assert.equal(result.recommendedTeacherAction, "resume_lesson");
  assert.equal(result.idempotencyDisposition, "resume_existing_session");
  assert.equal(result.reusableSessionId, "student-app-session-1");
  assert.match(result.idempotencyWarning ?? "", /중복 클릭/);
});

test("recent expired session returns restart or extend guidance without treating all expired rows as blockers", () => {
  const state = makeState({ studentAppClassSessions: [expiredRecentStudentAppSession] });
  const result = validate({
    lessonRunState: state,
    studentAppClassSessions: [expiredRecentStudentAppSession],
  });

  assert.equal(state.recommendedTeacherAction, "extend_lesson");
  assert.equal(result.ok, false);
  assert.equal(result.blockingReasons[0]?.code, "student_app_session_expired");
  assert.equal(result.recommendedTeacherAction, "extend_lesson");
  assert.equal(result.idempotencyDisposition, "recent_expired_session");
  assert.equal(result.reusableSessionId, "student-app-session-expired-recent");
  assert.equal(result.warnings.some((warning) => warning.code === "student_app_session_expired"), true);
});

test("locked edu class blocks and recommends resolve_conflict", () => {
  const state = makeState({ eduClass: { ...eduClass, locked_at: "2026-07-08T02:00:00.000Z" } });
  const result = validate({
    lessonRunState: state,
    eduClass: { ...eduClass, locked_at: "2026-07-08T02:00:00.000Z" },
  });

  assert.equal(result.ok, false);
  assert.equal(result.recommendedTeacherAction, "resolve_conflict");
  assert.equal(result.blockingReasons[0]?.code, "class_locked");
});

test("multiple open sessions block and recommend resolve_conflict", () => {
  const secondOpenSession = { ...openStudentAppSession, id: "student-app-session-2", ends_at: "2026-07-08T08:00:00.000Z" };
  const state = makeState({ studentAppClassSessions: [openStudentAppSession, secondOpenSession] });
  const result = validate({
    lessonRunState: state,
    studentAppClassSessions: [openStudentAppSession, secondOpenSession],
  });

  assert.equal(result.ok, false);
  assert.equal(result.recommendedTeacherAction, "resolve_conflict");
  assert.equal(result.blockingReasons[0]?.code, "multiple_open_student_app_sessions");
  assert.equal(result.idempotencyDisposition, "conflict_multiple_open_sessions");
  assert.match(result.idempotencyWarning ?? "", /중복 시작/);
});

test("invalid idempotency key length or shape blocks before writes", () => {
  const tooLong = validate({ idempotencyKey: "a".repeat(129) });
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.blockingReasons[0]?.code, "invalid_idempotency_key");
  assert.equal(tooLong.idempotencyDisposition, "invalid_idempotency_key");
  assert.equal(tooLong.httpStatusCandidate, 400);

  const unsafeShape = validate({ clientRequestId: "client request with spaces" });
  assert.equal(unsafeShape.ok, false);
  assert.equal(unsafeShape.blockingReasons[0]?.code, "invalid_idempotency_key");
  assert.equal(unsafeShape.idempotencyDisposition, "invalid_idempotency_key");
});

test("invalid preset and duration block before writes", () => {
  const badPreset = validate({ requestedPreset: "45min" });
  assert.equal(badPreset.ok, false);
  assert.equal(badPreset.blockingReasons[0]?.code, "invalid_preset");
  assert.equal(badPreset.httpStatusCandidate, 400);

  const badDuration = validate({ durationMinutes: 4 });
  assert.equal(badDuration.ok, false);
  assert.equal(badDuration.blockingReasons[0]?.code, "invalid_duration");
  assert.equal(badDuration.httpStatusCandidate, 400);
});

test("invalid upload and submission option combination blocks", () => {
  const result = validate({ options: { submissionsOpen: false, uploadsOpen: true } });

  assert.equal(result.ok, false);
  assert.equal(result.blockingReasons[0]?.code, "invalid_submission_policy");
});

test("validator source stays pure, read-only, and time-injected", () => {
  const validatorSource = readFileSync("lib/lesson-run/validateStartLessonRun.ts", "utf8");
  const presetSource = readFileSync("lib/lesson-run/lessonRunPresets.ts", "utf8");
  const combinedSource = `${validatorSource}\n${presetSource}`;

  for (const forbidden of [
    "createSupabase",
    "@supabase",
    "fetch(",
    "Date.now(",
    "aws4fetch",
    "studentAppR2Storage",
    ".insert(",
    ".update(",
    ".delete(",
    ".upsert(",
    ".from(",
  ]) {
    assert.equal(combinedSource.includes(forbidden), false, `forbidden validator source token: ${forbidden}`);
  }
});
