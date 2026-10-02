import assert from "node:assert/strict";
import test from "node:test";

import {
  executeReportsBacklogBulkResolveAction,
  previewReportsBacklogAction,
} from "@/app/dashboard/ops/system-jobs/actions";

test("reports backlog assistant dry-run returns run_id and execute writes audit log", async () => {
  const sampleRows = [
    {
      id: "report-1",
      target_type: "post",
      target_id: "post-101",
      reason: "spam",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "report-2",
      target_type: "comment",
      target_id: "comment-501",
      reason: "abuse",
      created_at: "2026-01-01T01:00:00.000Z",
    },
  ];

  const auditActions: string[] = [];
  const runId = "run-preview-001";

  const adminClientMock = {
    from(table: string) {
      if (table === "community_reports") {
        return {
          select() {
            return {
              eq() {
                return {
                  gte() {
                    return {
                      order() {
                        return {
                          async limit() {
                            return { data: sampleRows, error: null };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          update() {
            return {
              in() {
                return {
                  async eq() {
                    return { error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "ops_reports_backlog_runs") {
        return {
          insert() {
            return {
              select() {
                return {
                  async single() {
                    return { data: { id: runId }, error: null };
                  },
                };
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
                        preview_payload: { reportIds: sampleRows.map((row) => row.id) },
                        status: "previewed",
                        created_at: new Date().toISOString(),
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
    requestHeaders: new Headers({ "x-request-id": "req-backlog-001" }),
    requireUserFn: async () => ({ user: { id: "ops-1", email: "ops@gomdory.com" } }) as never,
    isOpsAdminFn: () => true,
    createSupabaseAdminClientFn: () => adminClientMock as never,
    logAuditFn: async ({ action }) => {
      auditActions.push(action);
    },
  };

  const previewState = await previewReportsBacklogAction(deps);
  assert.equal(previewState.ok, true);
  assert.equal(previewState.wouldCount, 2);
  assert.equal(previewState.previewItems?.length, 2);
  assert.equal(previewState.confirmToken, runId);

  const executeState = await executeReportsBacklogBulkResolveAction(previewState.confirmToken ?? "", deps);
  assert.equal(executeState.ok, true);
  assert.equal(executeState.executedCount, 2);
  assert.deepEqual(auditActions, ["ops_reports_backlog_assistant_preview", "ops_reports_backlog_assistant_execute"]);
});

test("reports backlog assistant execute blocks expired or already executed run_id", async () => {
  const runId = "run-preview-expired";
  const auditActions: string[] = [];

  const adminClientMock = {
    from(table: string) {
      if (table === "ops_reports_backlog_runs") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        id: runId,
                        preview_payload: { reportIds: ["report-1"] },
                        status: "executed",
                        created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
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
      if (table === "community_reports") {
        return {
          update() {
            return {
              in() {
                return {
                  async eq() {
                    return { error: null };
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
    requestHeaders: new Headers({ "x-request-id": "req-backlog-002" }),
    requireUserFn: async () => ({ user: { id: "ops-1", email: "ops@gomdory.com" } }) as never,
    isOpsAdminFn: () => true,
    createSupabaseAdminClientFn: () => adminClientMock as never,
    logAuditFn: async ({ action }) => {
      auditActions.push(action);
    },
  };

  const executeState = await executeReportsBacklogBulkResolveAction(runId, deps);
  assert.equal(executeState.ok, false);
  assert.match(executeState.message, /만료|미리보기/);
  assert.deepEqual(auditActions, ["ops_reports_backlog_assistant_execute"]);
});
