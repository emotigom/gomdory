import assert from "node:assert/strict";
import test from "node:test";

import { executeOpenReportsQuickAction } from "@/app/dashboard/ops/system-jobs/actions";

test("system-jobs alert quick action calls server audit and returns request id", async () => {
  let auditAction = "";
  let auditRequestId = "";

  const state = await executeOpenReportsQuickAction({
    requestHeaders: new Headers({ "x-request-id": "req-alert-001" }),
    requireUserFn: async () => ({ user: { id: "ops-1", email: "ops@gomdory.com" } }) as never,
    isOpsAdminFn: () => true,
    logAuditFn: async ({ action, ctx }) => {
      auditAction = action;
      auditRequestId = ctx?.requestId ?? "";
    },
  });

  assert.equal(state.ok, true);
  assert.equal(state.requestId, "req-alert-001");
  assert.equal(state.redirectTo, "/dashboard/ops/reports?status=open");
  assert.equal(auditAction, "ops_alert_open_reports_navigate");
  assert.equal(auditRequestId, "req-alert-001");
});
