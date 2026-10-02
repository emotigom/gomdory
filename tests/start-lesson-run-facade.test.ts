import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { startLessonRun, LESSON_RUN_START_FACADE_FLAG } from "@/lib/lesson-run/startLessonRun";
import type { LessonRunDiagnosticsSnapshot } from "@/lib/lesson-run/loadLessonRunDiagnostics";

const now = new Date("2026-07-08T03:00:00.000Z");

const boardRow = {
  id: "board-1",
  title: "Board",
  share_code: "CLASS20",
  active_session_id: null,
  class_state: "idle",
  share_write_enabled: false,
  class_id: "class-1",
  deleted_at: null,
};

const deploymentRow = {
  id: "deployment-1",
  status: "published",
  title: "Demo app",
  published_at: "2026-07-08T01:00:00.000Z",
  archived_at: null,
  deleted_at: null,
  created_at: "2026-07-08T01:00:00.000Z",
};

const openSession = {
  id: "open-session-1",
  status: "active",
  starts_at: "2026-07-08T01:00:00.000Z",
  ends_at: "2026-07-08T07:00:00.000Z",
  ended_at: null,
  created_at: "2026-07-08T01:00:00.000Z",
};

const expiredSession = {
  id: "expired-session-1",
  status: "active",
  starts_at: "2026-07-07T01:00:00.000Z",
  ends_at: "2026-07-07T07:00:00.000Z",
  ended_at: null,
  created_at: "2026-07-07T01:00:00.000Z",
};

function snapshot(overrides: Partial<LessonRunDiagnosticsSnapshot> = {}): LessonRunDiagnosticsSnapshot {
  return {
    board: boardRow,
    eduClass: {
      board_id: "board-1",
      share_code: "CLASS20",
      locked_at: null,
      lock_reason: null,
    },
    studentAppClassSessions: [],
    classSessions: [],
    studentAppDeployments: [deploymentRow],
    lessonActivityRuns: [],
    coursewareSessions: [],
    loadWarnings: [],
    sourceTables: [],
    ...overrides,
  };
}

type QueryState = {
  board?: typeof boardRow | null;
  role?: string | null;
  roleError?: unknown;
  openSessions?: typeof openSession[];
  insertedRows?: unknown[];
  insertedId?: string;
  adminRpcCalls?: string[];
  serverRpcCalls?: string[];
};

class FakeQuery {
  constructor(
    private readonly table: string,
    private readonly state: QueryState,
    private readonly mode: "select" | "insert" = "select",
  ) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  is() {
    return this;
  }

  gt() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    if (this.table === "student_app_class_sessions") {
      return Promise.resolve({ data: this.state.openSessions ?? [], error: null });
    }
    return Promise.resolve({ data: [], error: null });
  }

  maybeSingle() {
    if (this.table === "boards") {
      return Promise.resolve({ data: this.state.board ?? null, error: null });
    }
    if (this.table === "student_app_class_sessions" && this.mode === "insert") {
      return Promise.resolve({
        data: {
          id: this.state.insertedId ?? "created-session-1",
          status: "active",
          starts_at: "2026-07-08T03:00:00.000Z",
          ends_at: "2026-07-08T03:45:00.000Z",
          ended_at: null,
        },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  }

  insert(payload: unknown) {
    this.state.insertedRows?.push(payload);
    return new FakeQuery(this.table, this.state, "insert");
  }
}

function fakeAdminSupabase(state: QueryState) {
  return {
    from(table: string) {
      return new FakeQuery(table, state);
    },
    rpc(name: string) {
      state.adminRpcCalls?.push(name);
      return Promise.resolve({ data: state.role === undefined ? "owner" : state.role, error: state.roleError ?? null });
    },
  };
}

function fakeServerSupabase(state: QueryState) {
  return {
    rpc(name: string) {
      assert.equal(name, "board_role");
      state.serverRpcCalls?.push(name);
      return Promise.resolve({ data: state.role === undefined ? "owner" : state.role, error: state.roleError ?? null });
    },
  };
}

async function run(overrides: {
  env?: Record<string, string | undefined>;
  snapshot?: LessonRunDiagnosticsSnapshot;
  state?: QueryState;
  idempotencyKey?: string | null;
} = {}) {
  const queryState: QueryState = {
    board: boardRow,
    role: "owner",
    openSessions: [],
    insertedRows: [],
    adminRpcCalls: [],
    serverRpcCalls: [],
    ...overrides.state,
  };
  const result = await startLessonRun(
    {
      boardId: "board-1",
      requestedPreset: "45m",
      idempotencyKey: overrides.idempotencyKey ?? null,
    },
    {
      requireUserApiFn: async () => ({ user: { id: "teacher-1" } }) as never,
      createSupabaseAdminClientFn: () => fakeAdminSupabase(queryState) as never,
      createSupabaseServerClientFn: () => fakeServerSupabase(queryState) as never,
      loadLessonRunDiagnosticsFn: async () => overrides.snapshot ?? snapshot(),
      env: overrides.env ?? {},
      now,
    },
  );
  return { result, queryState };
}

test("board role uses the request-scoped server client, never the admin client", async () => {
  const { result, queryState } = await run();

  assert.equal(result.disposition, "feature_disabled");
  assert.deepEqual(queryState.serverRpcCalls, ["board_role"]);
  assert.deepEqual(queryState.adminRpcCalls, []);
});

test("owner and editor roles pass authorization before diagnostics and writes", async () => {
  for (const role of ["owner", "editor"]) {
    let diagnosticsCalls = 0;
    const queryState: QueryState = { board: boardRow, role, openSessions: [], insertedRows: [], adminRpcCalls: [], serverRpcCalls: [] };
    const result = await startLessonRun(
      { boardId: "board-1", requestedPreset: "45m" },
      {
        requireUserApiFn: async () => ({ user: { id: "teacher-1" } }) as never,
        createSupabaseAdminClientFn: () => fakeAdminSupabase(queryState) as never,
        createSupabaseServerClientFn: () => fakeServerSupabase(queryState) as never,
        loadLessonRunDiagnosticsFn: async () => {
          diagnosticsCalls += 1;
          return snapshot();
        },
        env: { [LESSON_RUN_START_FACADE_FLAG]: "true" },
        now,
      },
    );

    assert.equal(result.disposition, "created_session", role);
    assert.equal(diagnosticsCalls, 2, role);
    assert.equal(queryState.insertedRows?.length, 1, role);
  }
});

test("viewer and null roles are denied before diagnostics, open-session checks, or writes", async () => {
  for (const role of ["viewer", null]) {
    let diagnosticsCalls = 0;
    const queryState: QueryState = { board: boardRow, role, openSessions: [], insertedRows: [], adminRpcCalls: [], serverRpcCalls: [] };
    const result = await startLessonRun(
      { boardId: "board-1", requestedPreset: "45m" },
      {
        requireUserApiFn: async () => ({ user: { id: "teacher-1" } }) as never,
        createSupabaseAdminClientFn: () => fakeAdminSupabase(queryState) as never,
        createSupabaseServerClientFn: () => fakeServerSupabase(queryState) as never,
        loadLessonRunDiagnosticsFn: async () => {
          diagnosticsCalls += 1;
          return snapshot();
        },
        env: { [LESSON_RUN_START_FACADE_FLAG]: "true" },
        now,
      },
    );

    assert.equal(result.disposition, "permission_denied", String(role));
    assert.equal(result.httpStatus, 403, String(role));
    assert.equal(diagnosticsCalls, 0, String(role));
    assert.deepEqual(queryState.insertedRows, [], String(role));
  }
});

test("board role RPC failures are denied before diagnostics or writes", async () => {
  let diagnosticsCalls = 0;
  const queryState: QueryState = {
    board: boardRow,
    role: "owner",
    roleError: { message: "rpc failed" },
    openSessions: [],
    insertedRows: [],
    adminRpcCalls: [],
    serverRpcCalls: [],
  };
  const result = await startLessonRun(
    { boardId: "board-1", requestedPreset: "45m" },
    {
      requireUserApiFn: async () => ({ user: { id: "teacher-1" } }) as never,
      createSupabaseAdminClientFn: () => fakeAdminSupabase(queryState) as never,
      createSupabaseServerClientFn: () => fakeServerSupabase(queryState) as never,
      loadLessonRunDiagnosticsFn: async () => {
        diagnosticsCalls += 1;
        return snapshot();
      },
      env: { [LESSON_RUN_START_FACADE_FLAG]: "true" },
      now,
    },
  );

  assert.equal(result.disposition, "permission_denied");
  assert.equal(result.httpStatus, 403);
  assert.equal(diagnosticsCalls, 0);
  assert.deepEqual(queryState.insertedRows, []);
});

test("feature flag off returns disabled response and performs no write", async () => {
  const { result, queryState } = await run();

  assert.equal(result.ok, false);
  assert.equal(result.disposition, "feature_disabled");
  assert.equal(result.httpStatus, 200);
  assert.deepEqual(queryState.insertedRows, []);
});

test("validator fail returns safely without write", async () => {
  const { result, queryState } = await run({
    env: { [LESSON_RUN_START_FACADE_FLAG]: "true" },
    snapshot: snapshot({ board: { ...boardRow, share_code: null }, eduClass: { board_id: "board-1", share_code: null, locked_at: null, lock_reason: null } }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.disposition, "validation_failed");
  assert.equal(result.validation?.blockingReasons[0]?.code, "no_share_code");
  assert.deepEqual(queryState.insertedRows, []);
});

test("ready_to_start with valid preset and flag on inserts exactly one session payload", async () => {
  const { result, queryState } = await run({ env: { [LESSON_RUN_START_FACADE_FLAG]: "true" } });

  assert.equal(result.ok, true);
  assert.equal(result.disposition, "created_session");
  assert.equal(result.sessionId, "created-session-1");
  assert.equal(queryState.insertedRows?.length, 1);
  assert.deepEqual(queryState.insertedRows?.[0], {
    board_id: "board-1",
    class_id: "class-1",
    started_by: "teacher-1",
    status: "active",
    starts_at: "2026-07-08T03:00:00.000Z",
    ends_at: "2026-07-08T03:45:00.000Z",
    updated_at: "2026-07-08T03:00:00.000Z",
  });
});

test("open session already exists returns reuse response and performs no insert", async () => {
  const { result, queryState } = await run({
    env: { [LESSON_RUN_START_FACADE_FLAG]: "true" },
    snapshot: snapshot({ studentAppClassSessions: [openSession] }),
    idempotencyKey: "retry-1",
  });

  assert.equal(result.disposition, "reuse_open_session");
  assert.equal(result.sessionId, "open-session-1");
  assert.deepEqual(queryState.insertedRows, []);
});

test("multiple open sessions return conflict and perform no insert", async () => {
  const { result, queryState } = await run({
    env: { [LESSON_RUN_START_FACADE_FLAG]: "true" },
    snapshot: snapshot({ studentAppClassSessions: [openSession, { ...openSession, id: "open-session-2" }] }),
  });

  assert.equal(result.disposition, "conflict_multiple_open_sessions");
  assert.deepEqual(queryState.insertedRows, []);
});

test("no deployment, viewer role, locked class, and invalid idempotency key do not write", async () => {
  const cases = [
    { expected: "no_deployment", snapshot: snapshot({ studentAppDeployments: [] }) },
    { expected: "permission_denied", state: { role: "viewer" } },
    { expected: "class_locked", snapshot: snapshot({ eduClass: { board_id: "board-1", share_code: "CLASS20", locked_at: "2026-07-08T01:00:00.000Z", lock_reason: null } }) },
    { expected: "invalid_idempotency_key", idempotencyKey: "bad key" },
  ] as const;

  for (const item of cases) {
    const { result, queryState } = await run({
      env: { [LESSON_RUN_START_FACADE_FLAG]: "true" },
      snapshot: "snapshot" in item ? item.snapshot : undefined,
      state: "state" in item ? item.state : undefined,
      idempotencyKey: "idempotencyKey" in item ? item.idempotencyKey : null,
    });
    assert.equal(result.validation?.blockingReasons[0]?.code ?? result.disposition, item.expected);
    assert.deepEqual(queryState.insertedRows, []);
  }
});

test("old expired sessions only allow a new start", async () => {
  const { result, queryState } = await run({
    env: { [LESSON_RUN_START_FACADE_FLAG]: "true" },
    snapshot: snapshot({ studentAppClassSessions: [expiredSession] }),
  });

  assert.equal(result.disposition, "created_session");
  assert.equal(queryState.insertedRows?.length, 1);
});

test("insert response reloads resolver state shape", async () => {
  let calls = 0;
  const queryState: QueryState = { board: boardRow, role: "owner", openSessions: [], insertedRows: [] };
  const result = await startLessonRun(
    { boardId: "board-1", requestedPreset: "45m" },
    {
      requireUserApiFn: async () => ({ user: { id: "teacher-1" } }) as never,
      createSupabaseAdminClientFn: () => fakeAdminSupabase(queryState) as never,
      createSupabaseServerClientFn: () => fakeServerSupabase(queryState) as never,
      loadLessonRunDiagnosticsFn: async () => {
        calls += 1;
        return calls === 1 ? snapshot() : snapshot({ studentAppClassSessions: [openSession] });
      },
      env: { [LESSON_RUN_START_FACADE_FLAG]: "true" },
      now,
    },
  );

  assert.equal(calls, 2);
  assert.equal(result.lessonRunState?.hasOpenStudentAppSession, true);
  assert.equal(result.lessonRunState?.studentPrimaryStatus, "student_app_open");
});

test("protected runtime mutation guard", () => {
  const source = readFileSync("lib/lesson-run/startLessonRun.ts", "utf8");

  for (const forbidden of [
    ".update(",
    ".delete(",
    ".upsert(",
    "student_app_submissions",
    "student_app_submission_files",
    "studentAppR2Storage",
    "publishStudentAppDeployment",
    "edu_classes.locked_at",
  ]) {
    assert.equal(source.includes(forbidden), false, `facade should not touch ${forbidden}`);
  }
});

test("publish gallery upload submission and class lock paths remain untouched by facade", () => {
  const helperSource = readFileSync("lib/lesson-run/startLessonRun.ts", "utf8");
  const routeSource = readFileSync("app/api/v1/lesson-run/start/route.ts", "utf8");
  const combined = helperSource + routeSource;

  for (const protectedToken of [
    "app/s/[code]",
    "TeacherBoardCanonicalClient",
    "StudentBoardMinimal",
    "StudentAppSubmitPanel",
    "gallery/list",
    "student-apps/submit",
    "dashboard/student-apps/publish",
    "quota",
    "R2",
  ]) {
    assert.equal(combined.includes(protectedToken), false, `new facade should not reference ${protectedToken}`);
  }
});
