import assert from "node:assert/strict";
import test from "node:test";

import { POST as reportTemplate } from "@/app/api/v1/templates/[id]/report/route";
import { makeMockUser } from "@/tests/helpers/mockUser";

test("template is auto-hidden after 3 reports", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const admin = {
    from: (table: string) => {
      if (table === "templates") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  template_id: "00000000-0000-4000-8000-000000000001",
                  owner_user_id: "owner-1",
                  visibility: "public",
                  moderation: {},
                  stats: {},
                  status: "active",
                  report_count: 2,
                },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updates.push(payload);
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === "template_reports") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { report_id: "report-1" }, error: null }),
            }),
          }),
          select: () => ({
            eq: async () => ({ count: 3, error: null }),
          }),
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  };

  const request = new Request("http://localhost/api/v1/templates/00000000-0000-4000-8000-000000000001/report", {
    method: "POST",
    body: JSON.stringify({ reason: "spam" }),
  });

  const response = await reportTemplate(
    request,
    { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) },
    {
      requireUserApiFn: async () => ({ user: makeMockUser({ id: "user-1" }) }),
      createSupabaseAdminClientFn: () => admin as never,
      checkRateLimitFn: async () => ({ ok: true }),
      autoHideThreshold: 3,
    },
  );

  assert.equal(response.status, 200);
  assert.ok(updates.some((payload) => payload.status === "hidden"));
});
