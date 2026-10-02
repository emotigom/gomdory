import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveLessonRunState } from "@/lib/lesson-run/resolveLessonRunState";
import type { ResolveLessonRunStateInput } from "@/lib/lesson-run/types";

const now = "2026-07-08T03:00:00.000Z";

const board = {
  id: "board-1",
  share_code: "CLASS20",
};

const deployment = {
  id: "deployment-1",
  status: "stored",
  title: "Demo app",
};

const openStudentAppSession = {
  id: "student-app-session-1",
  status: "active",
  starts_at: "2026-07-08T01:00:00.000Z",
  ends_at: "2026-07-08T07:00:00.000Z",
  ended_at: null,
};

const expiredStudentAppSession = {
  id: "student-app-session-expired",
  status: "active",
  starts_at: "2026-07-07T01:00:00.000Z",
  ends_at: "2026-07-07T07:00:00.000Z",
  ended_at: null,
};

const recentlyExpiredStudentAppSession = {
  id: "student-app-session-recently-expired",
  status: "active",
  starts_at: "2026-07-08T01:00:00.000Z",
  ends_at: "2026-07-08T02:45:00.000Z",
  ended_at: null,
};

function resolve(overrides: Partial<ResolveLessonRunStateInput> = {}) {
  return resolveLessonRunState({
    now,
    board,
    studentAppClassSessions: [],
    classSessions: [],
    studentAppDeployments: [],
    ...overrides,
  });
}

test("share code only reports board-only readiness without opening submissions", () => {
  const state = resolve();

  assert.equal(state.hasShareCode, true);
  assert.equal(state.hasStudentAppDeployment, false);
  assert.equal(state.hasOpenStudentAppSession, false);
  assert.equal(state.teacherPrimaryStatus, "board_only");
  assert.equal(state.submissionsOpen, false);
  assert.equal(state.recommendedTeacherAction, "choose_activity");
});

test("deployment without an open session recommends starting the lesson window", () => {
  const state = resolve({ studentAppDeployments: [deployment] });

  assert.equal(state.hasStudentAppDeployment, true);
  assert.equal(state.teacherPrimaryStatus, "ready_to_start");
  assert.equal(state.recommendedTeacherAction, "start_lesson");
  assert.ok(state.warnings.some((warning) => warning.code === "no_open_student_app_session"));
});

test("open non-expired student app session opens submissions and uploads", () => {
  const state = resolve({
    studentAppDeployments: [deployment],
    studentAppClassSessions: [openStudentAppSession],
  });

  assert.equal(state.hasOpenStudentAppSession, true);
  assert.equal(state.sessionExpired, false);
  assert.equal(state.submissionsOpen, true);
  assert.equal(state.uploadsOpen, true);
  assert.equal(state.studentPrimaryStatus, "student_app_open");
  assert.deepEqual(state.activeStudentAppSessionIds, ["student-app-session-1"]);
});

test("old expired student app session starts a fresh lesson window instead of extension", () => {
  const state = resolve({
    studentAppDeployments: [deployment],
    studentAppClassSessions: [expiredStudentAppSession],
  });

  assert.equal(state.sessionExpired, true);
  assert.equal(state.teacherPrimaryStatus, "ready_to_start");
  assert.equal(state.studentPrimaryStatus, "submissions_locked");
  assert.equal(state.recommendedTeacherAction, "start_lesson");
  assert.deepEqual(state.expiredStudentAppSessionIds, ["student-app-session-expired"]);
  assert.ok(state.warnings.some((warning) => warning.code === "no_open_student_app_session"));
  assert.equal(state.warnings.some((warning) => warning.code === "student_app_session_expired"), false);
});

test("recently expired student app session can still recommend extension", () => {
  const state = resolve({
    studentAppDeployments: [deployment],
    studentAppClassSessions: [recentlyExpiredStudentAppSession],
  });

  assert.equal(state.sessionExpired, true);
  assert.equal(state.teacherPrimaryStatus, "expired");
  assert.equal(state.studentPrimaryStatus, "submissions_locked");
  assert.equal(state.recommendedTeacherAction, "extend_lesson");
  assert.deepEqual(state.expiredStudentAppSessionIds, ["student-app-session-recently-expired"]);
  assert.ok(state.warnings.some((warning) => warning.code === "student_app_session_expired"));
  assert.equal(state.warnings.some((warning) => warning.code === "no_open_student_app_session"), false);
});

test("edu class lock plus open student app session is a conflict", () => {
  const state = resolve({
    eduClass: { board_id: "board-1", locked_at: "2026-07-08T02:30:00.000Z" },
    studentAppDeployments: [deployment],
    studentAppClassSessions: [openStudentAppSession],
  });

  assert.equal(state.eduClassLocked, true);
  assert.equal(state.submissionsOpen, false);
  assert.equal(state.teacherPrimaryStatus, "conflict");
  assert.equal(state.recommendedTeacherAction, "resolve_conflict");
  assert.ok(state.conflicts.some((conflict) => conflict.code === "student_app_session_open_while_edu_class_locked"));
});

test("multiple open student app sessions are detected as a conflict", () => {
  const state = resolve({
    studentAppDeployments: [deployment],
    studentAppClassSessions: [
      openStudentAppSession,
      { ...openStudentAppSession, id: "student-app-session-2", ends_at: "2026-07-08T08:00:00.000Z" },
    ],
  });

  assert.equal(state.teacherPrimaryStatus, "conflict");
  assert.ok(state.conflicts.some((conflict) => conflict.code === "multiple_open_student_app_sessions"));
});

test("student-app query without active session warns about route/state mismatch", () => {
  const state = resolve({
    studentAppDeployments: [deployment],
    query: { view: "student-app", lessonKit: "lesson_03_vibe_app_planning" },
  });

  assert.equal(state.studentWorkspaceAvailable, true);
  assert.equal(state.submissionsOpen, false);
  assert.ok(state.warnings.some((warning) => warning.code === "query_student_app_without_open_session"));
});

test("missing share code is a blocking reason and recommends share code creation", () => {
  const state = resolve({
    board: { id: "board-1", share_code: null },
    studentAppDeployments: [deployment],
  });

  assert.equal(state.hasShareCode, false);
  assert.equal(state.teacherPrimaryStatus, "no_share_code");
  assert.equal(state.recommendedTeacherAction, "create_share_code");
  assert.ok(state.blockingReasons.some((reason) => reason.code === "no_share_code"));
});

test("published gallery state remains separate from submission lock state", () => {
  const state = resolve({
    eduClass: { locked_at: "2026-07-08T02:30:00.000Z" },
    studentAppDeployments: [
      {
        ...deployment,
        id: "published-deployment-1",
        status: "published",
        published_at: "2026-07-08T02:00:00.000Z",
      },
    ],
  });

  assert.equal(state.galleryMaybeAvailable, true);
  assert.equal(state.submissionsOpen, false);
  assert.deepEqual(state.publishedDeploymentIds, ["published-deployment-1"]);
  assert.ok(state.warnings.some((warning) => warning.code === "gallery_open_while_submissions_closed"));
  assert.ok(state.warnings.some((warning) => warning.code === "gallery_open_while_edu_class_locked"));
});

test("courseware session parallel to student app flow is reported as a warning", () => {
  const state = resolve({
    studentAppDeployments: [deployment],
    studentAppClassSessions: [openStudentAppSession],
    coursewareSessions: [{ id: "courseware-session-1", status: "active", expires_at: null }],
  });

  assert.ok(state.warnings.some((warning) => warning.code === "courseware_session_parallel_to_student_app_flow"));
});

test("active class session without student app window is reported as a split state", () => {
  const state = resolve({
    studentAppDeployments: [deployment],
    classSessions: [{ id: "class-session-1", status: "running", ended_at: null }],
  });

  assert.equal(state.hasActiveClassSession, true);
  assert.ok(state.warnings.some((warning) => warning.code === "active_class_without_student_app_window"));
});

test("primary board fixture with published deployment and only old expired sessions recommends start lesson", () => {
  const state = resolve({
    board: {
      id: "board-fixture-primary",
      share_code: "FAKE20I",
      active_session_id: null,
      class_state: "idle",
      share_write_enabled: false,
      deleted_at: null,
    },
    eduClass: {
      board_id: "board-fixture-primary",
      share_code: "FAKE20I",
      locked_at: null,
      lock_reason: null,
    },
    studentAppDeployments: [
      {
        id: "deployment-fixture-published",
        status: "published",
        title: "Fixture app",
        published_at: "2026-07-07T09:00:00.000Z",
        archived_at: null,
        deleted_at: null,
      },
    ],
    studentAppClassSessions: [
      {
        id: "session-fixture-expired",
        status: "active",
        starts_at: "2026-07-07T01:00:00.000Z",
        ends_at: "2026-07-07T07:00:00.000Z",
        ended_at: null,
      },
    ],
    classSessions: [],
  });

  assert.equal(state.hasShareCode, true);
  assert.equal(state.hasStudentAppDeployment, true);
  assert.equal(state.hasOpenStudentAppSession, false);
  assert.equal(state.hasActiveClassSession, false);
  assert.equal(state.submissionsOpen, false);
  assert.equal(state.uploadsOpen, false);
  assert.equal(state.studentWorkspaceAvailable, false);
  assert.equal(state.galleryMaybeAvailable, true);
  assert.deepEqual(state.conflicts, []);
  assert.equal(state.recommendedTeacherAction, "start_lesson");
  assert.equal(state.studentPrimaryStatus, "submissions_locked");
  assert.deepEqual(state.expiredStudentAppSessionIds, ["session-fixture-expired"]);
});

test("resolver source stays read-only and time-injected", () => {
  const resolverSource = readFileSync("lib/lesson-run/resolveLessonRunState.ts", "utf8");
  const typeSource = readFileSync("lib/lesson-run/types.ts", "utf8");
  const combinedSource = `${resolverSource}\n${typeSource}`;

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
    assert.equal(combinedSource.includes(forbidden), false, `forbidden resolver source token: ${forbidden}`);
  }
});
