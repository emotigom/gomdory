import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { handleFeatureFlagsGet } from "@/app/api/v1/ops/users/feature-flags/handler";
import { handleFeatureFlagsUpdate } from "@/app/api/v1/ops/users/feature-flags/update/handler";

function featureFlagsUpdateRequest(payload: Record<string, unknown>) {
  return {
    json: async () => payload,
  } as unknown as NextRequest;
}

function createFlagsUpdateAdminStub(onUpsert: (payload: Record<string, unknown>) => void) {
  return ({
    from: () => ({
      upsert: (payload: Record<string, unknown>) => {
        onUpsert(payload);
        return {
          select: () => ({
            single: async () => ({
              data: { ...payload, updated_at: null },
              error: null,
            }),
          }),
        };
      },
    }),
  }) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>;
}

test("ops feature flags GET returns 403 for non-admin", async () => {
  const response = await handleFeatureFlagsGet(
    new NextRequest(new Request("http://localhost/api/v1/ops/users/feature-flags")),
    undefined,
    { requestId: "test-request-id" },
    {
      requireOpsAdminFn: async () => {
        const error = new Error("forbidden");
        (error as Error & { code?: string }).code = "forbidden";
        throw error;
      },
    },
  );

  assert.equal(response.status, 403);
});

test("ops feature flags GET supports q and returns flagsByUserId", async () => {
  const response = await handleFeatureFlagsGet(
    new NextRequest(new Request("http://localhost/api/v1/ops/users/feature-flags?page=1&perPage=2&q=gom")),
    undefined,
    { requestId: "test-request-id" },
    {
      requireOpsAdminFn: async () => undefined,
      createAdminClientFn: () =>
        ({
          auth: {
            admin: {
              listUsers: async ({ page }: { page: number }) =>
                page === 1
                  ? {
                      data: {
                        users: [
                          { id: "u1", email: "gom@example.com", created_at: "2026-01-01T00:00:00.000Z" },
                          { id: "u2", email: "test@example.com", created_at: "2026-01-02T00:00:00.000Z" },
                        ],
                      },
                      error: null,
                    }
                  : { data: { users: [] }, error: null },
            },
          },
          from: () => ({
            select: () => ({
              in: () => ({
                returns: async () => ({
                  data: [
                    {
                      user_id: "u1",
                      webllm_enabled: true,
                      netsaver_enabled: false,
                      netsaver_mode: "lease_only",
                      netsaver_p2p_tier: null,
                      max_bytes: 10485760,
                      updated_at: null,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }) as ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
    },
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    users: Array<{ id: string; createdAt: string | null }>;
    flagsByUserId: Record<string, { webllmEnabled: boolean }>;
  };
  assert.equal(payload.users.length, 1);
  assert.equal(payload.users[0]?.id, "u1");
  assert.equal(payload.flagsByUserId.u1?.webllmEnabled, true);
  assert.equal(payload.users[0]?.createdAt, "2026-01-01T00:00:00.000Z");
});

test("ops feature flags update returns 403 for non-admin", async () => {
  const request = featureFlagsUpdateRequest({
    user_id: "u1",
    webllm_enabled: true,
    netsaver_enabled: false,
    netsaver_mode: "lease_only",
    netsaver_p2p_tier: null,
    max_bytes: 10485760,
  });

  const response = await handleFeatureFlagsUpdate(request, undefined, { requestId: "test-request-id" }, {
    requireOpsAdminFn: async () => {
      const error = new Error("forbidden");
      (error as Error & { code?: string }).code = "forbidden";
      throw error;
    },
  });

  assert.equal(response.status, 403);
});

test("ops feature flags update rejects camelCase payload variants", async () => {
  const request = featureFlagsUpdateRequest({
    userId: "u1",
    webllmEnabled: true,
    netsaverEnabled: false,
    netsaverMode: "leaseOnly",
    netsaverP2pTier: null,
    maxBytes: 10485760,
  });

  let upsertedPayload: Record<string, unknown> | null = null;
  const response = await handleFeatureFlagsUpdate(request, undefined, { requestId: "test-request-id" }, {
    requireOpsAdminFn: async () => undefined,
    createAdminClientFn: () => createFlagsUpdateAdminStub((payload) => {
      upsertedPayload = payload;
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(upsertedPayload, null);
});

test("ops feature flags update defaults netsaver tier to meta when enabled and tier is null", async () => {
  const request = featureFlagsUpdateRequest({
    user_id: "u1",
    webllm_enabled: true,
    netsaver_enabled: true,
    netsaver_mode: "lease_only",
    netsaver_p2p_tier: null,
    max_bytes: 10485760,
  });

  let upsertedPayload: Record<string, unknown> | null = null;
  const response = await handleFeatureFlagsUpdate(request, undefined, { requestId: "test-request-id" }, {
    requireOpsAdminFn: async () => undefined,
    createAdminClientFn: () => createFlagsUpdateAdminStub((payload) => {
      upsertedPayload = payload;
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(upsertedPayload?.netsaver_p2p_tier, "meta");
});
