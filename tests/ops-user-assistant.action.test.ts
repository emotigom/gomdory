import assert from "node:assert/strict";
import test from "node:test";

import {
  executeOpsResetUiPrefsWithConfirm,
  previewOpsResetUiPrefs,
} from "@/app/dashboard/ops/users/actions";

test("ops user assistant preview returns run_id and execute writes audit", async () => {
  const runId = "run-ui-assistant-1";
  const auditActions: string[] = [];

  const adminClientMock = {
    from(table: string) {
      if (table === "user_ui_prefs") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        class_prefs: {
                          teacherUiPrefs: { theme: "dark" },
                          teacherUiCustomPresetsV2: [{ id: "p1" }, { id: "p2" }],
                        },
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
          async upsert() {
            return { error: null };
          },
        };
      }
      if (table === "ops_user_assistant_runs") {
        return {
          insert() {
            return {
              async select() {
                return { data: [{ id: runId }], error: null };
              },
            };
          },
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        id: runId,
                        would_payload: { targetUserId: "user-100" },
                        status: "previewed",
                        created_at: new Date().toISOString(),
                        note: "ops_user_ui_prefs_clear_preview",
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
          update() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async select() {
                        return { data: [{ id: runId }], error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };

  const deps = {
    requestHeaders: new Headers({ "x-request-id": "req-ui-assistant-1" }),
    requireUserFn: async () => ({ user: { id: "ops-1", email: "ops@gomdory.com" } }) as never,
    isOpsAdminFn: () => true,
    createSupabaseAdminClientFn: () => adminClientMock as never,
    logAuditFn: async ({ action }: { action: string }) => {
      auditActions.push(action);
    },
  };

  const previewState = await previewOpsResetUiPrefs({ userId: "user-100" }, deps);
  assert.equal(previewState.ok, true);
  assert.equal(previewState.confirmToken, runId);
  assert.equal(previewState.wouldClear?.presetCount, 2);

  const executeState = await executeOpsResetUiPrefsWithConfirm({ confirmToken: runId }, deps);
  assert.equal(executeState.ok, true);
  assert.deepEqual(auditActions, ["ops_user_ui_prefs_clear_previewed", "ops_user_ui_prefs_clear_executed"]);
});

test("ops user assistant execute is idempotent for already-used run_id", async () => {
  const runId = "run-ui-assistant-used";
  const auditActions: string[] = [];

  const adminClientMock = {
    from(table: string) {
      if (table === "ops_user_assistant_runs") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        id: runId,
                        would_payload: { targetUserId: "user-200" },
                        status: "executed",
                        created_at: new Date().toISOString(),
                        note: "ops_user_ui_prefs_clear_preview",
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
          update() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async select() {
                        return { data: [], error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "user_ui_prefs") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: { class_prefs: {} }, error: null };
                  },
                };
              },
            };
          },
          async upsert() {
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };

  const executeState = await executeOpsResetUiPrefsWithConfirm(
    { confirmToken: runId },
    {
      requestHeaders: new Headers({ "x-request-id": "req-ui-assistant-2" }),
      requireUserFn: async () => ({ user: { id: "ops-1", email: "ops@gomdory.com" } }) as never,
      isOpsAdminFn: () => true,
      createSupabaseAdminClientFn: () => adminClientMock as never,
      logAuditFn: async ({ action }: { action: string }) => {
        auditActions.push(action);
      },
    },
  );

  assert.equal(executeState.ok, false);
  assert.match(executeState.message, /이미 실행된 요청/);
  assert.deepEqual(auditActions, []);
});

test("ops user assistant execute blocks expired run_id", async () => {
  const runId = "run-ui-assistant-expired";

  const adminClientMock = {
    from(table: string) {
      if (table === "ops_user_assistant_runs") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        id: runId,
                        would_payload: { targetUserId: "user-300" },
                        status: "previewed",
                        created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
                        note: "ops_user_ui_prefs_clear_preview",
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
          update() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async select() {
                        return { data: [{ id: runId }], error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "user_ui_prefs") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: { class_prefs: {} }, error: null };
                  },
                };
              },
            };
          },
          async upsert() {
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };

  const executeState = await executeOpsResetUiPrefsWithConfirm(
    { confirmToken: runId },
    {
      requestHeaders: new Headers({ "x-request-id": "req-ui-assistant-3" }),
      requireUserFn: async () => ({ user: { id: "ops-1", email: "ops@gomdory.com" } }) as never,
      isOpsAdminFn: () => true,
      createSupabaseAdminClientFn: () => adminClientMock as never,
      logAuditFn: async () => undefined,
    },
  );

  assert.equal(executeState.ok, false);
  assert.match(executeState.message, /만료/);
});
