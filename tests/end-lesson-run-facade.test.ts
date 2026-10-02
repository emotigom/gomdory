import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { endLessonRun } from "@/lib/lesson-run/endLessonRun";
import { LESSON_RUN_START_FACADE_FLAG } from "@/lib/lesson-run/startLessonRun";
import type { LessonRunDiagnosticsSnapshot } from "@/lib/lesson-run/loadLessonRunDiagnostics";

const now = new Date("2026-07-08T03:00:00.000Z");
const board = { id: "board-1", title: "Board", share_code: "CLASS20", active_session_id: null, class_state: "idle", share_write_enabled: false, class_id: "class-1", deleted_at: null };
const openSession = { id: "open-session-1", status: "active", starts_at: "2026-07-08T01:00:00.000Z", ends_at: "2026-07-08T07:00:00.000Z", ended_at: null, created_at: "2026-07-08T01:00:00.000Z" };
const deployment = { id: "deployment-1", status: "published", title: "App", published_at: "2026-07-08T01:00:00.000Z", archived_at: null, deleted_at: null, created_at: "2026-07-08T01:00:00.000Z" };

function snapshot(sessions: typeof openSession[] = []): LessonRunDiagnosticsSnapshot {
  return {
    board,
    eduClass: { board_id: "board-1", share_code: "CLASS20", locked_at: null, lock_reason: null },
    studentAppClassSessions: sessions,
    classSessions: [], studentAppDeployments: [deployment], lessonActivityRuns: [], coursewareSessions: [], loadWarnings: [], sourceTables: [],
  };
}

type State = { role?: string | null; roleError?: unknown; sessions?: typeof openSession[]; writes: unknown[]; serverRpcCalls: string[]; adminRpcCalls: string[] };

class Query {
  constructor(private readonly table: string, private readonly state: State, private readonly updatePayload: unknown = null) {}
  select() {
    if (this.updatePayload) {
      const active = (this.state.sessions ?? []).filter((row) => row.status === "active" && !row.ended_at);
      const updatedAt = (this.updatePayload as { updated_at: string }).updated_at;
      this.state.sessions = (this.state.sessions ?? []).map((row) => active.some((candidate) => candidate.id === row.id)
        ? { ...row, status: "ended", ended_at: updatedAt }
        : row);
      return Promise.resolve({ data: active.map(({ id }) => ({ id })), error: null });
    }
    return this;
  }
  eq() { return this; }
  is() { return this; }
  in() { return this; }
  maybeSingle() { return Promise.resolve({ data: this.table === "boards" ? { id: "board-1" } : null, error: null }); }
  update(payload: unknown) { this.state.writes.push(payload); return new Query(this.table, this.state, payload); }
  then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
    const data = this.table === "student_app_class_sessions"
      ? (this.state.sessions ?? []).filter((row) => row.status === "active" && !row.ended_at).map(({ id }) => ({ id }))
      : [];
    return Promise.resolve({ data, error: null }).then(resolve, reject);
  }
}

function admin(state: State) {
  return { from: (table: string) => new Query(table, state), rpc(name: string) { state.adminRpcCalls.push(name); return Promise.resolve({ data: state.role, error: state.roleError ?? null }); } };
}
function server(state: State) {
  return { rpc(name: string) { state.serverRpcCalls.push(name); return Promise.resolve({ data: state.role, error: state.roleError ?? null }); } };
}

async function run(overrides: Partial<State> & { env?: Record<string, string | undefined>; unauthenticated?: boolean } = {}) {
  const state: State = { role: "owner", sessions: [openSession], writes: [], serverRpcCalls: [], adminRpcCalls: [], ...overrides };
  let diagnosticCalls = 0;
  const result = await endLessonRun({ boardId: "board-1" }, {
    requireUserApiFn: overrides.unauthenticated ? async () => { throw new Error("unauthorized"); } : async () => ({ user: { id: "teacher-1" } }) as never,
    createSupabaseAdminClientFn: () => admin(state) as never,
    createSupabaseServerClientFn: () => server(state) as never,
    loadLessonRunDiagnosticsFn: async () => { diagnosticCalls += 1; return snapshot(state.sessions); },
    env: overrides.env ?? { [LESSON_RUN_START_FACADE_FLAG]: "true" }, now,
  });
  return { result, state, diagnosticCalls };
}

test("feature flag off follows the start facade disabled policy without a write", async () => {
  const { result, state } = await run({ env: {} });
  assert.equal(result.disposition, "feature_disabled");
  assert.equal(result.httpStatus, 200);
  assert.deepEqual(state.writes, []);
});

test("authentication is required", async () => {
  const { result, state } = await run({ unauthenticated: true });
  assert.equal(result.disposition, "auth_required");
  assert.equal(result.httpStatus, 401);
  assert.deepEqual(state.writes, []);
});

test("owner and editor may end the current submission window", async () => {
  for (const role of ["owner", "editor"]) {
    const { result, state } = await run({ role });
    assert.equal(result.disposition, "ended_session", role);
    assert.deepEqual(result.endedSessionIds, ["open-session-1"], role);
    assert.equal(state.writes.length, 1, role);
  }
});

test("viewer, null role, and role RPC errors are denied without writes", async () => {
  for (const options of [{ role: "viewer" }, { role: null }, { role: "owner", roleError: { message: "failed" } }]) {
    const { result, state, diagnosticCalls } = await run(options);
    assert.equal(result.disposition, "permission_denied");
    assert.equal(result.httpStatus, 403);
    assert.equal(diagnosticCalls, 0);
    assert.deepEqual(state.writes, []);
  }
});

test("board_role uses only the request-scoped server client", async () => {
  const { state } = await run();
  assert.deepEqual(state.serverRpcCalls, ["board_role"]);
  assert.deepEqual(state.adminRpcCalls, []);
});

test("an already closed board returns idempotently without an update", async () => {
  const { result, state } = await run({ sessions: [] });
  assert.equal(result.disposition, "already_closed");
  assert.equal(result.message, "이미 제출 시간이 닫혀 있습니다.");
  assert.deepEqual(state.writes, []);
});

test("all anomalous active rows are ended, while other board rows are not targeted", async () => {
  const { result, state } = await run({ sessions: [openSession, { ...openSession, id: "open-session-2" }] });
  assert.equal(result.disposition, "ended_session");
  assert.deepEqual(result.endedSessionIds, ["open-session-1", "open-session-2"]);
  assert.equal(state.writes.length, 1);
  assert.deepEqual(state.writes[0], { status: "ended", ended_at: now.toISOString(), updated_at: now.toISOString() });
});

test("the refreshed state reflects a closed student workspace and repeated calls do not write", async () => {
  const first = await run();
  assert.equal(first.result.lessonRunState?.hasOpenStudentAppSession, false);
  assert.equal(first.result.lessonRunState?.submissionsOpen, false);
  assert.equal(first.result.lessonRunState?.uploadsOpen, false);
  assert.equal(first.result.lessonRunState?.studentWorkspaceAvailable, false);
  assert.equal(first.result.lessonRunState?.recommendedTeacherAction, "start_lesson");

  const second = await endLessonRun({ boardId: "board-1" }, {
    requireUserApiFn: async () => ({ user: { id: "teacher-1" } }) as never,
    createSupabaseAdminClientFn: () => admin(first.state) as never,
    createSupabaseServerClientFn: () => server(first.state) as never,
    loadLessonRunDiagnosticsFn: async () => snapshot(first.state.sessions),
    env: { [LESSON_RUN_START_FACADE_FLAG]: "true" }, now,
  });
  assert.equal(second.disposition, "already_closed");
  assert.equal(first.state.writes.length, 1);
});

test("route delegates to the facade and contains no direct database access or test-only dependencies", () => {
  const source = readFileSync("app/api/v1/lesson-run/end/route.ts", "utf8");
  assert.match(source, /endLessonRun\(/);
  assert.doesNotMatch(source, /createSupabase|\.from\(/);
  assert.doesNotMatch(source, /Deps|endLessonRunFn/);
});
