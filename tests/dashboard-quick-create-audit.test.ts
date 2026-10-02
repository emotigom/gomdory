import assert from "node:assert/strict";
import test from "node:test";

import { createBoardAction } from "@/app/dashboard/actions";

test("dashboard quick create success writes audit log and propagates request id", async () => {
  let auditAction = "";
  let auditRequestId = "";

  const formData = new FormData();
  formData.set("title", "빠른 보드");
  formData.set("boardViewType", "grid");
  formData.set("board-template", "blank");

  const state = await createBoardAction(
    { success: false },
    formData,
    {
      requestHeaders: new Headers({ "x-request-id": "req-quick-create-001" }),
      requireUserFn: async () => ({ user: { id: "teacher-1" } }) as never,
      getTeacherDefaultsFn: async () => ({
        defaultToolsEnabled: ["pen"],
        defaultMinimapMode: "auto",
      }) as never,
      createBoardFn: async () =>
        ({
          id: "board-1",
          title: "빠른 보드",
          description: null,
          board_view_type: "grid",
          visibility: "private",
          owner_id: "teacher-1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        }) as never,
      logAuditFn: async ({ action, ctx }) => {
        auditAction = action;
        auditRequestId = ctx?.requestId ?? "";
      },
    },
  );

  assert.equal(state.success, true);
  assert.equal(state.requestId, "req-quick-create-001");
  assert.equal(auditAction, "dashboard_quick_create_success");
  assert.equal(auditRequestId, "req-quick-create-001");
});
