import assert from "node:assert/strict";
import test from "node:test";

import { handleCreatePreset } from "@/app/api/v1/me/ui-prefs/presets/handlers";

test("ui prefs presets write returns 429 when rate limited", async () => {
  process.env.NEXT_PUBLIC_DASHBOARD_CUSTOM_PAGES_V2 = "1";

  const request = new Request("http://localhost/api/v1/me/ui-prefs/presets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "test-preset", prefs: {} }),
  });

  const response = await handleCreatePreset(request, {
    requireUserApiFn: async () => ({ user: { id: "user-1" } }) as never,
    createSupabaseAdminClientFn: (() => ({ rpc: async () => ({ data: 1, error: null }) })) as never,
    checkRateLimitFn: (async () => ({ ok: false, retryAfterSeconds: 10 })) as never,
    getRateLimitSubjectFn: (async () => "subject-1") as never,
    loadUiClassPrefsFn: (async () => ({ ok: true, classPrefs: {} })) as never,
    saveUiClassPrefsFn: (async () => ({ error: null })) as never,
  });

  const payload = (await response.json()) as { error?: { code?: string } };
  assert.equal(response.status, 429);
  assert.equal(payload.error?.code, "RATE_LIMITED");
});

test("ui prefs presets write records structured audit action", async () => {
  process.env.NEXT_PUBLIC_DASHBOARD_CUSTOM_PAGES_V2 = "1";

  const request = new Request("http://localhost/api/v1/me/ui-prefs/presets", {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "rid-1" },
    body: JSON.stringify({ name: "내 프리셋", prefs: { backgroundColor: "#000000" } }),
  });

  let auditAction: string | null = null;

  const response = await handleCreatePreset(request, {
    requireUserApiFn: async () => ({ user: { id: "user-1" } }) as never,
    createSupabaseAdminClientFn: (() => ({ rpc: async () => ({ data: 1, error: null }) })) as never,
    checkRateLimitFn: (async () => ({ ok: true })) as never,
    getRateLimitSubjectFn: (async () => "subject-1") as never,
    loadUiClassPrefsFn: (async () => ({ ok: true, classPrefs: {} })) as never,
    saveUiClassPrefsFn: (async () => ({ error: null })) as never,
    recordAuditLogFn: async ({ action }) => {
      auditAction = action;
    },
  });

  assert.equal(response.status, 200);
  assert.equal(auditAction, "ui_prefs_preset_created");
});
