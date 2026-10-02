import assert from "node:assert/strict";
import test from "node:test";

import { executeOpsResetUiPrefs } from "@/app/dashboard/ops/users/actions";

test("ops reset ui prefs action writes ui_prefs_reset_by_ops audit log", async () => {
  let auditAction = "";

  const state = await executeOpsResetUiPrefs(
    { userId: "user-123" },
    {
      requestHeaders: new Headers({ "x-request-id": "req-test-1" }),
      requireUserFn: async () => ({ user: { id: "ops-1", email: "ops@gomdory.com" } }) as never,
      isOpsAdminFn: () => true,
      createSupabaseAdminClientFn: () =>
        ({
          from: (table: string) => {
            if (table === "user_ui_prefs") {
              return {
                select: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        class_prefs: {
                          teacherUiPrefs: { theme: "dark" },
                          teacherUiCustomPresetsV2: [{ id: "p1" }],
                        },
                      },
                      error: null,
                    }),
                  }),
                }),
                upsert: async () => ({ error: null }),
              };
            }
            throw new Error(`unexpected table: ${table}`);
          },
        }) as never,
      logAuditFn: async ({ action }) => {
        auditAction = action;
      },
    },
  );

  assert.equal(state.ok, true);
  assert.equal(auditAction, "ui_prefs_reset_by_ops");
  assert.equal(state.requestId, "req-test-1");
});
