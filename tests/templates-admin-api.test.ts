import assert from "node:assert/strict";
import test from "node:test";

import { PATCH as updateTemplate } from "@/app/api/v1/templates/[id]/admin/route";

test("admin template update requires ops owner", async () => {
  const previousOps = process.env.OPS_OWNER_EMAILS;
  process.env.OPS_OWNER_EMAILS = "owner@example.com";

  const response = await updateTemplate(
    new Request("http://localhost/api/v1/templates/template-1/admin", {
      method: "PATCH",
      body: JSON.stringify({ access: "pro" }),
    }),
    { params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", email: "free@example.com" } }),
    },
  );

  assert.equal(response.status, 403);
  process.env.OPS_OWNER_EMAILS = previousOps;
});

test("admin template update allows ops owners", async () => {
  const previousOps = process.env.OPS_OWNER_EMAILS;
  process.env.OPS_OWNER_EMAILS = "owner@example.com";

  const response = await updateTemplate(
    new Request("http://localhost/api/v1/templates/template-1/admin", {
      method: "PATCH",
      body: JSON.stringify({ pro_only: true, visibility: "public", picks_rank: 1 }),
    }),
    { params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-1", email: "owner@example.com" } }),
      createSupabaseAdminClientFn: () => ({
        from: () => ({
          update: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({
                  data: {
                    template_id: "t1",
                    title: "템플릿",
                    description: null,
                    tags: [],
                    cover_file_id: null,
                    stats: { clones: 0 },
                    created_at: new Date().toISOString(),
                    pro_only: true,
                    picks_rank: 1,
                    visibility: "public",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }) as never,
    },
  );

  const payload = (await response.json()) as { ok?: boolean; template?: { accessLevel?: string } };
  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);

  process.env.OPS_OWNER_EMAILS = previousOps;
});
