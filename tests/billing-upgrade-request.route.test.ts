import assert from "node:assert/strict";
import test from "node:test";

import { handlePost } from "@/app/api/v1/billing/upgrade-request/handler";

test("upgrade request sends admin email after insert", async () => {
  let called = false;
  const req = new Request("http://localhost/api/v1/billing/upgrade-request", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost" },
    body: JSON.stringify({ orgName: "Org", contactEmail: "test@example.com", message: "hello", intent: "demo" }),
  });

  const res = await handlePost(req as never, null, { requestId: "ops-1" } as never, {
    requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
    createSupabaseAdminClientFn: (() => ({
      from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { request_id: "r1" }, error: null }) }) }) }),
    })) as never,
    checkRateLimitFn: (async () => ({ ok: true })) as never,
    sendBillingUpgradeRequestAdminEmailFn: async () => {
      called = true;
      return "sent";
    },
  });

  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(called, true);
  assert.equal(payload.meta.emailNotification, "sent");
});

test("upgrade request keeps success when admin email fails", async () => {
  const req = new Request("http://localhost/api/v1/billing/upgrade-request", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost" },
    body: JSON.stringify({ orgName: "Org", contactEmail: "test@example.com", message: "hello" }),
  });

  const res = await handlePost(req as never, null, { requestId: "ops-2" } as never, {
    requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
    createSupabaseAdminClientFn: (() => ({
      from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { request_id: "r2" }, error: null }) }) }) }),
    })) as never,
    checkRateLimitFn: (async () => ({ ok: true })) as never,
    sendBillingUpgradeRequestAdminEmailFn: async () => "failed",
  });

  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.meta.emailNotification, "failed");
});


test("upgrade request keeps success when admin email helper throws", async () => {
  const req = new Request("http://localhost/api/v1/billing/upgrade-request", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost" },
    body: JSON.stringify({ orgName: "Org", contactEmail: "test@example.com", message: "hello" }),
  });

  const res = await handlePost(req as never, null, { requestId: "ops-throw-upgrade" } as never, {
    requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
    createSupabaseAdminClientFn: (() => ({
      from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { request_id: "r3" }, error: null }) }) }) }),
    })) as never,
    checkRateLimitFn: (async () => ({ ok: true })) as never,
    sendBillingUpgradeRequestAdminEmailFn: async () => {
      throw new Error("email helper boom");
    },
  });

  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.meta.emailNotification, "failed");
});
