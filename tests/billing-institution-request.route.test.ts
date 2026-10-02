import assert from "node:assert/strict";
import test from "node:test";

import { handlePost } from "@/app/api/v1/billing/institution/request/handler";

test("institution request sends admin email after insert", async () => {
  let called = false;
  const req = new Request("http://localhost/api/v1/billing/institution/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ org_name: "School", contact_name: "Kim", contact_email: "kim@example.com" }),
  });

  const res = await handlePost(req as never, null, { requestId: "ops-3" } as never, {
    requireUserApiFn: async () => ({ user: { id: "u1", email: "u1@example.com" } }) as never,
    createSupabaseServerClientFn: (() => ({
      from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "i1", status: "new", created_at: "now" }, error: null }) }) }) }),
    })) as never,
    logAuditFn: (async () => {}) as never,
    sendInstitutionRequestAdminEmailFn: async () => {
      called = true;
      return "sent";
    },
  });

  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(called, true);
  assert.equal(payload.meta.emailNotification, "sent");
});

test("institution request keeps success when admin email skipped", async () => {
  const req = new Request("http://localhost/api/v1/billing/institution/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ org_name: "School" }),
  });

  const res = await handlePost(req as never, null, { requestId: "ops-4" } as never, {
    requireUserApiFn: async () => ({ user: { id: "u1", email: "u1@example.com" } }) as never,
    createSupabaseServerClientFn: (() => ({
      from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "i2", status: "new", created_at: "now" }, error: null }) }) }) }),
    })) as never,
    logAuditFn: (async () => {}) as never,
    sendInstitutionRequestAdminEmailFn: async () => "skipped",
  });

  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.meta.emailNotification, "skipped");
});


test("institution request keeps success when admin email helper throws", async () => {
  const req = new Request("http://localhost/api/v1/billing/institution/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ org_name: "School" }),
  });

  const res = await handlePost(req as never, null, { requestId: "ops-throw-inst" } as never, {
    requireUserApiFn: async () => ({ user: { id: "u1", email: "u1@example.com" } }) as never,
    createSupabaseServerClientFn: (() => ({
      from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "i3", status: "new", created_at: "now" }, error: null }) }) }) }),
    })) as never,
    logAuditFn: (async () => {}) as never,
    sendInstitutionRequestAdminEmailFn: async () => {
      throw new Error("email helper boom");
    },
  });

  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.meta.emailNotification, "failed");
});
