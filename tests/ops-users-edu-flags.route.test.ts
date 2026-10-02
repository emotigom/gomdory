import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import {
  handleOpsUserEduFlagsGet,
  handleOpsUserEduFlagsPost,
} from "@/app/api/v1/ops/users/[userId]/edu-flags/handler";
import { handleOpsUsersSearch } from "@/app/api/v1/ops/users/handler";

function eduFlagsPostRequest(payload: Record<string, unknown>) {
  return {
    method: "POST",
    headers: new Headers(),
    json: async () => payload,
  } as unknown as NextRequest;
}

test("ops users search returns 400 without query", async () => {
  const response = await handleOpsUsersSearch(
    new NextRequest(new Request("http://localhost/api/v1/ops/users")),
    undefined,
    { requestId: "t1", startedAt: Date.now() },
    { requireOpsAdminFn: async () => undefined },
  );
  assert.equal(response.status, 400);
});

test("ops users search filters by email", async () => {
  const response = await handleOpsUsersSearch(
    new NextRequest(new Request("http://localhost/api/v1/ops/users?query=gom")),
    undefined,
    { requestId: "t2", startedAt: Date.now() },
    {
      requireOpsAdminFn: async () => undefined,
      createAdminClientFn: () =>
        ({
          auth: {
            admin: {
              listUsers: async () => ({
                data: {
                  users: [
                    { id: "u1", email: "gom@example.com", created_at: "2026-01-01T00:00:00.000Z" },
                    { id: "u2", email: "abc@example.com", created_at: "2026-01-01T00:00:00.000Z" },
                  ],
                },
                error: null,
              }),
            },
          },
        }) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
    },
  );
  assert.equal(response.status, 200);
  const payload = (await response.json()) as { users: Array<{ id: string }> };
  assert.equal(payload.users.length, 1);
  assert.equal(payload.users[0]?.id, "u1");
});

test("ops user edu flags GET returns defaults when no row", async () => {
  const response = await handleOpsUserEduFlagsGet(
    new NextRequest(new Request("http://localhost/api/v1/ops/users/u1/edu-flags")),
    { params: Promise.resolve({ userId: "u1" }) },
    { requestId: "t3", startedAt: Date.now() },
    {
      requireOpsAdminFn: async () => ({ user: { id: "admin-1", email: "ops@gomdory.com" } }),
      createAdminClientFn: () =>
        ({
          auth: {
            admin: {
              getUserById: async () => ({ data: { user: { email: "u1@example.com" } }, error: null }),
            },
          },
          rpc: async () => ({ data: 1, error: null }),
          from: () => ({
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            }),
          }),
        }) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
    },
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { gating: { reasons: string[]; effectiveWebllmEnabled: boolean } };
  assert.equal(payload.gating.reasons.includes("enabled"), true);
  assert.equal(payload.gating.effectiveWebllmEnabled, true);
});

test("ops user edu flags POST rejects payload without userId", async () => {
  const request = eduFlagsPostRequest({
    webllmEnabled: true,
    netsaverEnabled: false,
    netsaverMode: "lease_only",
    netsaverP2pTier: null,
    maxBytes: 10485760,
  });

  let upsertPayload: Record<string, unknown> | null = null;

  const response = await handleOpsUserEduFlagsPost(
    request,
    { params: Promise.resolve({ userId: "u1" }) },
    { requestId: "t4", startedAt: Date.now() },
    {
      requireOpsAdminFn: async () => ({ user: { id: "admin-1", email: "ops@gomdory.com" } }),
      createAdminClientFn: () =>
        ({
          auth: {
            admin: {
              getUserById: async () => ({ data: { user: { email: "u1@example.com" } }, error: null }),
            },
          },
          rpc: async () => ({ data: 1, error: null }),
          from: () => ({
            upsert: (payload: Record<string, unknown>) => {
              upsertPayload = payload;
              return {
                select: () => ({
                  single: async () => ({ data: { ...payload, updated_at: null }, error: null }),
                }),
              };
            },
          }),
        }) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
    },
  );

  assert.equal(response.status, 400);
  assert.equal(upsertPayload, null);
});
