import assert from "node:assert/strict";
import test from "node:test";

import { handleHomeHubV2ViewedPost } from "@/app/api/v1/dashboard/home-hub-v2/viewed/handler";

test("home hub v2 viewed returns 429 and skips audit when rate limited", async () => {
  let auditCalls = 0;

  const request = new Request("http://localhost/api/v1/dashboard/home-hub-v2/viewed", {
    method: "POST",
    headers: {
      "x-request-id": "req-rate-limited",
    },
  });

  const response = await handleHomeHubV2ViewedPost(request, {
    getRateLimitSubjectFn: async () => "subject-1",
    createSupabaseAdminClientFn: () => ({}) as never,
    checkRateLimitFn: async () => ({ ok: false, retryAfterSeconds: 42 }),
    logAuditFn: () => {
      auditCalls += 1;
      return Promise.resolve();
    },
  });

  const body = (await response.json()) as {
    ok: boolean;
    error?: { code?: string };
    request_id?: string | null;
  };

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "42");
  assert.equal(body.ok, false);
  assert.equal(body.error?.code, "RATE_LIMITED");
  assert.equal(body.request_id, "req-rate-limited");
  assert.equal(auditCalls, 0);
});

test("home hub v2 viewed writes dashboard_home_hub_v2_viewed audit action on success", async () => {
  const actions: string[] = [];

  const request = new Request("http://localhost/api/v1/dashboard/home-hub-v2/viewed", {
    method: "POST",
    headers: {
      "x-request-id": "req-ok",
    },
  });

  const response = await handleHomeHubV2ViewedPost(request, {
    getRateLimitSubjectFn: async () => "subject-2",
    createSupabaseAdminClientFn: () => ({}) as never,
    checkRateLimitFn: async () => ({ ok: true }),
    logAuditFn: ({ action }) => {
      actions.push(action);
      return Promise.resolve();
    },
  });

  const body = (await response.json()) as { ok: boolean; request_id?: string | null };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.request_id, "req-ok");
  assert.deepEqual(actions, ["dashboard_home_hub_v2_viewed"]);
});
