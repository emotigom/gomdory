import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveLessonRunState } from "@/lib/lesson-run/resolveLessonRunState";
import { validateStartLessonRun } from "@/lib/lesson-run/validateStartLessonRun";
import { toLessonRunInput, toStartLessonRunPreviewInput } from "@/lib/lesson-run/toLessonRunInput";
import type { LessonRunDiagnosticsSnapshot } from "@/lib/lesson-run/loadLessonRunDiagnostics";

const loaderSource = readFileSync("lib/lesson-run/loadLessonRunDiagnostics.ts", "utf8");
const adapterSource = readFileSync("lib/lesson-run/toLessonRunInput.ts", "utf8");
const presetSource = readFileSync("lib/lesson-run/lessonRunPresets.ts", "utf8");
const startFacadeSource = readFileSync("lib/lesson-run/startLessonRun.ts", "utf8");
const startRouteSource = readFileSync("app/api/v1/lesson-run/start/route.ts", "utf8");
const pageSource = readFileSync("app/dashboard/boards/[boardId]/lesson-run-diagnostics/page.tsx", "utf8");
const editPageSource = readFileSync("app/dashboard/boards/[boardId]/edit/page.tsx", "utf8");
const clientSource = readFileSync(
  "app/dashboard/boards/[boardId]/lesson-run-diagnostics/LessonRunDiagnosticsClient.tsx",
  "utf8",
);
const teacherCanonicalSource = readFileSync("app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx", "utf8");
const studentBoardSource = readFileSync("app/s/[code]/_components/StudentBoardMinimal.tsx", "utf8");
const studentSubmitSource = readFileSync("app/s/[code]/_components/StudentAppSubmitPanel.tsx", "utf8");
const studentRouteSource = readFileSync("app/s/[code]/page.tsx", "utf8");

function emptySnapshot(overrides: Partial<LessonRunDiagnosticsSnapshot> = {}): LessonRunDiagnosticsSnapshot {
  return {
    board: null,
    eduClass: null,
    studentAppClassSessions: [],
    classSessions: [],
    studentAppDeployments: [],
    lessonActivityRuns: [],
    coursewareSessions: [],
    loadWarnings: [],
    sourceTables: [],
    ...overrides,
  };
}

test("diagnostics page gates board access and resolves LessonRunState through the adapter", () => {
  assert.match(pageSource, /requireUser\(/);
  assert.match(pageSource, /getBoard\(boardId, \{ userId: user\.id \}\)/);
  assert.match(pageSource, /canEditBoard\(role\)/);
  assert.match(pageSource, /toLessonRunInput\(snapshot, now\)/);
  assert.match(pageSource, /resolveLessonRunState\(input\)/);
  assert.match(pageSource, /toStartLessonRunPreviewInput\(/);
  assert.match(pageSource, /dryRunInput=\{dryRunInput\}/);
  assert.match(pageSource, /canStartLessonRun: canEditBoard\(role\)/);
});

test("diagnostics entry is a role-gated read-only link from board settings", () => {
  assert.match(editPageSource, /rpc\("board_role", \{ bid: board\.id \}\)/);
  assert.match(editPageSource, /canEditBoard\(normalizeBoardRole\(roleResult\)\)/);
  assert.match(editPageSource, /const diagnosticsHref = `\/dashboard\/boards\/\$\{board\.id\}\/lesson-run-diagnostics`/);
  assert.match(editPageSource, /href=\{diagnosticsHref\}/);
  assert.match(editPageSource, />\s*수업 상태 진단\s*<\/Link>/);

  for (const forbidden of ["Start", "Lock", "End", "Publish", "Delete", "Save", "Import", "Upload"]) {
    assert.equal(editPageSource.includes(`${forbidden} diagnostics`), false, `diagnostics entry has action text ${forbidden}`);
  }
});

test("diagnostics entry is not added to student routes or protected active runtimes", () => {
  for (const [label, source] of [
    ["teacher canonical", teacherCanonicalSource],
    ["student board", studentBoardSource],
    ["student submit panel", studentSubmitSource],
    ["student route", studentRouteSource],
  ] as const) {
    assert.equal(source.includes("/lesson-run-diagnostics"), false, `${label} should not link diagnostics`);
    assert.equal(source.includes("수업 상태 진단"), false, `${label} should not expose diagnostics text`);
  }
});

test("diagnostics loader is read-only select work", () => {
  assert.match(loaderSource, /\.from\("boards"\)\s*\.select\(/);
  assert.match(loaderSource, /\.from\("edu_classes"\)\.select\(/);
  assert.match(loaderSource, /\.from\("student_app_class_sessions"\)/);
  assert.match(loaderSource, /\.from\("class_sessions"\)/);
  assert.match(loaderSource, /\.from\("student_app_deployments"\)/);
  assert.match(loaderSource, /\.from\("lesson_activity_runs"\)/);

  for (const forbidden of [".insert(", ".update(", ".delete(", ".upsert(", ".rpc(", "fetch(", "aws4fetch", "studentAppR2Storage"]) {
    assert.equal(loaderSource.includes(forbidden), false, `loader contains forbidden token ${forbidden}`);
  }
});

test("adapter safely handles missing rows and keeps Date.now out of resolver input mapping", () => {
  const { input, diagnosticsWarnings } = toLessonRunInput(emptySnapshot(), "2026-07-08T03:00:00.000Z");
  const state = resolveLessonRunState(input);

  assert.equal(input.board, null);
  assert.equal(input.eduClass, null);
  assert.equal(state.boardReady, false);
  assert.equal(state.hasShareCode, false);
  assert.ok(diagnosticsWarnings.some((warning) => warning.includes("boards row")));
  assert.equal(adapterSource.includes("Date.now("), false);
});

test("adapter builds diagnostics dry-run validator input without requiring edu class", () => {
  const { input } = toLessonRunInput(
    emptySnapshot({
      board: {
        id: "board-preview",
        title: "Preview board",
        share_code: "PREVIEW",
        active_session_id: null,
        class_state: "idle",
        share_write_enabled: true,
        deleted_at: null,
      },
      eduClass: null,
      studentAppDeployments: [
        {
          id: "deployment-preview",
          status: "published",
          title: "Preview app",
          published_at: "2026-07-08T01:00:00.000Z",
          archived_at: null,
          deleted_at: null,
          created_at: "2026-07-08T01:00:00.000Z",
        },
      ],
    }),
    "2026-07-08T03:00:00.000Z",
  );
  const state = resolveLessonRunState(input);
  const dryRunInput = toStartLessonRunPreviewInput({
    lessonRunInput: input,
    lessonRunState: state,
    now: "2026-07-08T03:00:00.000Z",
    requestedPreset: "45m",
    teacher: {
      role: "owner",
      canEditBoard: true,
      canStartLessonRun: true,
    },
  });
  const result = validateStartLessonRun(dryRunInput);

  assert.equal(dryRunInput.eduClass, null);
  assert.equal(result.ok, true);
  assert.equal(result.normalizedInput?.preset.id, "45m");
  assert.notEqual(result.httpStatusCandidate, 500);
});

test("adapter passes arrays through so resolver can report conflicts", () => {
  const { input } = toLessonRunInput(
    emptySnapshot({
      board: {
        id: "board-1",
        title: "Board",
        share_code: "CLASS20",
        active_session_id: null,
        class_state: "live",
        share_write_enabled: true,
        deleted_at: null,
      },
      studentAppClassSessions: [
        {
          id: "session-1",
          status: "active",
          starts_at: "2026-07-08T01:00:00.000Z",
          ends_at: "2026-07-08T07:00:00.000Z",
          ended_at: null,
          created_at: "2026-07-08T01:00:00.000Z",
        },
        {
          id: "session-2",
          status: "active",
          starts_at: "2026-07-08T01:00:00.000Z",
          ends_at: "2026-07-08T08:00:00.000Z",
          ended_at: null,
          created_at: "2026-07-08T01:01:00.000Z",
        },
      ],
    }),
    "2026-07-08T03:00:00.000Z",
  );

  const state = resolveLessonRunState(input);
  assert.deepEqual(state.activeStudentAppSessionIds, ["session-1", "session-2"]);
  assert.ok(state.conflicts.some((conflict) => conflict.code === "multiple_open_student_app_sessions"));
});

test("primary board diagnostics fixture resolves closed student workspace as startable", () => {
  const { input, diagnosticsWarnings } = toLessonRunInput(
    emptySnapshot({
      board: {
        id: "board-fixture-primary",
        title: "Primary fixture board",
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
      studentAppClassSessions: [
        {
          id: "session-fixture-expired",
          status: "active",
          starts_at: "2026-07-07T01:00:00.000Z",
          ends_at: "2026-07-07T07:00:00.000Z",
          ended_at: null,
          created_at: "2026-07-07T01:00:00.000Z",
        },
      ],
      classSessions: [],
      studentAppDeployments: [
        {
          id: "deployment-fixture-published",
          status: "published",
          title: "Fixture published app",
          published_at: "2026-07-07T09:00:00.000Z",
          archived_at: null,
          deleted_at: null,
          created_at: "2026-07-07T08:30:00.000Z",
        },
      ],
    }),
    "2026-07-08T03:00:00.000Z",
  );
  const state = resolveLessonRunState(input);

  assert.deepEqual(diagnosticsWarnings, []);
  assert.equal(state.hasShareCode, true);
  assert.equal(state.hasStudentAppDeployment, true);
  assert.equal(state.hasOpenStudentAppSession, false);
  assert.equal(state.submissionsOpen, false);
  assert.equal(state.uploadsOpen, false);
  assert.equal(state.galleryMaybeAvailable, true);
  assert.deepEqual(state.conflicts, []);
  assert.equal(state.recommendedTeacherAction, "start_lesson");
  assert.equal(state.studentPrimaryStatus, "submissions_locked");
});

test("diagnostics display separates edu class load warnings from deployment warnings", () => {
  assert.match(clientSource, /edu_class_unavailable/);
  assert.match(clientSource, /This does not mean the student app deployment is missing/);
  assert.doesNotMatch(clientSource, /diagnosticsWarnings\.map\(\(message\) => \(\{ code: "no_deployment"/);
});

test("diagnostics UI is scoped and has no lesson mutation action buttons", () => {
  assert.match(clientSource, /data-lesson-run-diagnostics-scope/);
  assert.match(clientSource, /lesson-run-diagnostics-card/);
  assert.match(clientSource, /Copy diagnostics/);
  assert.match(clientSource, /Refresh/);
  assert.match(clientSource, /수업 시작 미리보기/);
  assert.match(clientSource, /아직 실제 수업은 열리지 않습니다/);
  assert.match(clientSource, /validateStartLessonRun\(/);
  assert.match(clientSource, /selectedPresetId/);

  for (const forbidden of [
    ">Start",
    ">Lock",
    ">End",
    ">Archive",
    ">Publish",
    ">Unpublish",
    ">Delete",
    ">Save",
    ">Commit",
    "startLesson",
    "lockSubmissions",
    "archiveClass",
    "publishDeployment",
    "deleteLesson",
    "saveLesson",
    "commitLesson",
    "form action",
    "use server",
  ]) {
    assert.equal(clientSource.includes(forbidden), false, `client contains forbidden action text ${forbidden}`);
  }
});

test("diagnostics dry-run preview displays validator output fields and presets", () => {
  for (const required of [
    "selected preset",
    "duration",
    "submissionsOpen",
    "uploadsOpen",
    "galleryMode",
    "autoLock",
    "blockingReasons",
    "warnings",
    "conflicts",
    "teacherMessage",
    "recommendedTeacherAction",
    "httpStatusCandidate",
    "Idempotency / reuse preview",
    "idempotencyDisposition",
    "reusableSessionId",
    "idempotencyWarning",
    "duplicate/double-click defense",
    "recent expired guidance",
    "multiple open sessions conflict",
    "새 수업창을 열 수 있습니다.",
    "이미 열린 수업창이 있어 새로 만들지 않고 기존 창을 이어서 사용해야 합니다.",
    "방금 종료된 수업창이 있어 연장/재시작 판단이 필요합니다.",
    "여러 열린 수업창이 있어 먼저 상태를 정리해야 합니다.",
    "요청 식별값이 올바르지 않아 시작할 수 없습니다.",
  ]) {
    assert.match(clientSource, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(clientSource, /LESSON_RUN_PRESETS/);
  assert.match(clientSource, /teacherLabel/);
  for (const required of [
    "45분 수업",
    "90분 블록 수업",
    "연습 모드",
    "발표 모드",
    "제출만 열기",
    "갤러리 보기",
  ]) {
    assert.match(presetSource, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Phase 20L keeps diagnostics UI read-only while start API stays server-flagged", () => {
  assert.doesNotMatch(pageSource, /"use server"|'use server'|export async function .*Action|redirect\(/);
  assert.doesNotMatch(clientSource, /"use server"|'use server'|action=\{|onSubmit=\{|fetch\(/);
  assert.match(startRouteSource, /export async function POST/);
  assert.match(startFacadeSource, /import "server-only"/);
  assert.match(startFacadeSource, /LESSON_RUN_START_FACADE_ENABLED/);
  assert.match(startFacadeSource, /=== "true"/);
  assert.doesNotMatch(startFacadeSource + startRouteSource, /NEXT_PUBLIC_/);
});

test("validateStartLessonRun is connected only as diagnostics preview in this phase", () => {
  assert.match(clientSource, /validateStartLessonRun\(\{\s*\.\.\.dryRunInput,\s*requestedPreset: selectedPresetId,/s);
  assert.doesNotMatch(pageSource, /validateStartLessonRun\(/);
  assert.equal(teacherCanonicalSource.includes("validateStartLessonRun"), false);
  assert.equal(studentBoardSource.includes("validateStartLessonRun"), false);
  assert.equal(studentSubmitSource.includes("validateStartLessonRun"), false);
  assert.equal(studentRouteSource.includes("validateStartLessonRun"), false);
});

test("copy diagnostics redacts secret-looking fields", () => {
  assert.match(clientSource, /SECRET_FIELD_PATTERN/);
  assert.match(clientSource, /removeSecretLookingFields/);
  assert.match(clientSource, /token\|secret\|password\|authorization\|cookie\|r2_prefix\|access\|key/);
  assert.doesNotMatch(clientSource, /clipboard\.writeText\(JSON\.stringify\(snapshot\)/);
});

test("copy diagnostics includes idempotency preview but not request id source values", () => {
  assert.match(clientSource, /dryRunPreview:\s*\{/);
  assert.match(clientSource, /idempotencyDisposition: dryRunResult\.idempotencyDisposition/);
  assert.match(clientSource, /reusableSessionId: dryRunResult\.reusableSessionId \? shortenIdentifier/);
  assert.match(clientSource, /idempotencyWarning: dryRunResult\.idempotencyWarning/);
  assert.equal(clientSource.includes("idempotencyKey"), false, "copy payload should not include idempotencyKey source values");
  assert.equal(clientSource.includes("clientRequestId"), false, "copy payload should not include clientRequestId source values");
});
