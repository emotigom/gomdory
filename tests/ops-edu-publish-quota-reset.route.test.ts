import assert from "node:assert/strict";
import test from "node:test";

import { handleOpsAdminEduPublishQuotaReset } from "@/app/api/v1/ops/admin/edu/publish-quota/reset/handler";

test("ops edu publish quota reset supports requestId targeting", async () => {
  let updatedQuotaKey: string | null = null;

  const response = await handleOpsAdminEduPublishQuotaReset(
    {
      json: async () => ({ requestId: "rid-1" }),
    } as never,
    undefined,
    { requestId: "ops-1", startedAt: Date.now() },
    {
      requireOpsAdminFn: async () => undefined,
      createAdminClientFn: () =>
        ({
          from: (table: string) => {
            assert.equal(table, "edu_projects");
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        publish_quota_key: "guest:jt1001:p2:nick:minsu",
                        last_published_at: "2026-01-01T10:00:00+09:00",
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
              update: () => ({
                eq: () => ({
                  eq: (_: string, value: string) => {
                    updatedQuotaKey = value;
                    return {
                      gte: () => ({
                        lte: async () => ({ count: 2, error: null }),
                      }),
                    };
                  },
                }),
              }),
            };
          },
        }) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
    },
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { resetCount: number; by: string };
  assert.equal(payload.resetCount, 2);
  assert.equal(payload.by, "requestId");
  assert.equal(updatedQuotaKey, "guest:jt1001:p2:nick:minsu");
});

test("ops edu publish quota reset supports jt+nickname+day targeting", async () => {
  let updatedKeys: string[] = [];

  const response = await handleOpsAdminEduPublishQuotaReset(
    {
      json: async () => ({ jt: "JT1001", nickname: "민수", day: "2026-01-01" }),
    } as never,
    undefined,
    { requestId: "ops-2", startedAt: Date.now() },
    {
      requireOpsAdminFn: async () => undefined,
      createAdminClientFn: () =>
        ({
          from: () => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    gte: () => ({
                      lte: async () => ({
                        data: [{ publish_quota_key: "q1" }, { publish_quota_key: "q2" }],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
            update: () => ({
              eq: () => ({
                in: (_: string, values: string[]) => {
                  updatedKeys = values;
                  return {
                    gte: () => ({
                      lte: async () => ({ count: 2, error: null }),
                    }),
                  };
                },
              }),
            }),
          }),
        }) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
    },
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { resetCount: number; by: string };
  assert.equal(payload.by, "jt+nickname");
  assert.equal(payload.resetCount, 2);
  assert.deepEqual(updatedKeys, ["q1", "q2"]);
});
