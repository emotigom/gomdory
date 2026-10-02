import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as usageGet } from "@/app/api/v1/storage/usage/route";
import { routes } from "@/lib/standards/routes";
import { MemoryRateLimitStore } from "@/lib/security/rateLimit";

test("storage usage API returns ok payload with top boards", async () => {
  const response = await usageGet(
    new NextRequest(new Request(new URL(routes.api.storage.usage(), "http://localhost"))),
    undefined,
    {
      requireUserApiFn: async () => ({
        user: { id: "user-1", app_metadata: {}, user_metadata: {} },
      }),
      validateSupabaseEnvFn: () => ({
        ok: true,
        supabaseUrl: "https://example.com",
        supabaseAnonKey: "anon",
        serviceRoleKey: "service",
      }),
      fetchStorageUsageDailyFn: async () => [
        {
          day: "2024-02-14",
          r2Bytes: 1024,
          dbBytes: 0,
          filesCount: 2,
          optimizedBytesSaved: 512,
        },
        {
          day: "2024-02-15",
          r2Bytes: 2048,
          dbBytes: 0,
          filesCount: 3,
          optimizedBytesSaved: 640,
        },
      ],
      refreshStorageUsageDailyFn: async () => ({
        day: "2024-02-15",
        r2Bytes: 2048,
        dbBytes: 0,
        filesCount: 3,
        optimizedBytesSaved: 640,
      }),
      fetchStorageQuotaBytesFn: async () => 10_000,
      rateLimitStore: new MemoryRateLimitStore(),
      nowFn: () => new Date("2024-02-15T00:00:00Z"),
      timeoutMs: 5000,
    },
  );

  const body = (await response.json()) as {
    ok?: boolean;
    quotaBytes?: number;
    latest?: { day?: string; r2Bytes?: number; filesCount?: number };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.quotaBytes, 10_000);
  assert.equal(body.latest?.day, "2024-02-15");
  assert.equal(body.latest?.r2Bytes, 2048);
  assert.equal(body.latest?.filesCount, 3);
});

test("storage usage API returns ok:false fallback on query failure", async () => {
  const response = await usageGet(
    new NextRequest(new Request(new URL(routes.api.storage.usage(), "http://localhost"))),
    undefined,
    {
      requireUserApiFn: async () => ({
        user: { id: "user-2", app_metadata: {}, user_metadata: {} },
      }),
      validateSupabaseEnvFn: () => ({
        ok: true,
        supabaseUrl: "https://example.com",
        supabaseAnonKey: "anon",
        serviceRoleKey: "service",
      }),
      fetchStorageUsageDailyFn: async () => {
        throw new Error("db down");
      },
      refreshStorageUsageDailyFn: async () => ({
        day: "2024-02-15",
        r2Bytes: 0,
        dbBytes: 0,
        filesCount: 0,
        optimizedBytesSaved: 0,
      }),
      fetchStorageQuotaBytesFn: async () => 10_000,
      rateLimitStore: new MemoryRateLimitStore(),
      nowFn: () => new Date("2024-02-15T00:00:00Z"),
      timeoutMs: 5000,
    },
  );

  const body = (await response.json()) as { ok?: boolean; error?: { code?: string } };

  assert.equal(response.status, 200);
  assert.equal(body.ok, false);
  assert.equal(body.error?.code, "storage_usage_failed");
});
