import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { UserEntitlementRow } from "@/lib/billing/entitlements";
import { resolveEffectiveStorageQuota } from "@/lib/data/effectiveStorageQuota.server";
import { formatBytes } from "@/lib/format/bytes";
import { isStorageQuotaExceeded, isValidStorageQuotaInput } from "@/lib/storage/quota";
import { calculateUsagePercent, getUsageTier } from "@/lib/storage/usage";

function makeEntitlement(overrides: Partial<UserEntitlementRow> = {}): UserEntitlementRow {
  return {
    user_id: "user-1",
    plan: "free",
    trial_started_at: null,
    trial_ends_at: null,
    source: "system",
    provider: "none",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    pro_ends_at: null,
    billing_status: "free",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function createQuotaClient(rows: {
  quota?: { quota_bytes: number | string | null } | null;
  manualPlan?: { plan: "free" | "pro"; expires_at: string | null; note: string | null } | null;
  entitlement?: UserEntitlementRow | null;
}) {
  let writes = 0;
  const byTable: Record<string, unknown> = {
    storage_quota: rows.quota ?? null,
    user_plans: rows.manualPlan ?? null,
    user_entitlements: rows.entitlement ?? null,
  };

  return {
    client: {
      from(table: string) {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: byTable[table] ?? null, error: null }),
            }),
          }),
          insert: () => {
            writes += 1;
            throw new Error("quota resolver must not write");
          },
        };
      },
    },
    getWrites: () => writes,
  };
}

test("formatBytes renders expected units", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1024), "1.00 KB");
  assert.equal(formatBytes(1024 * 1024), "1.00 MB");
});

test("calculateUsagePercent handles ratios", () => {
  assert.equal(calculateUsagePercent(0, 1024), 0);
  assert.equal(calculateUsagePercent(512, 1024), 50);
  assert.equal(calculateUsagePercent(987, 1000), 98.7);
  assert.equal(calculateUsagePercent(1, 0), 100);
});

test("getUsageTier respects 70/90 thresholds", () => {
  assert.equal(getUsageTier(69.9), "ok");
  assert.equal(getUsageTier(70), "warn");
  assert.equal(getUsageTier(89.9), "warn");
  assert.equal(getUsageTier(90), "danger");
});

test("effective quota preserves an explicit zero override and blocks positive uploads", async () => {
  const stub = createQuotaClient({
    quota: { quota_bytes: 0 },
    entitlement: makeEntitlement({ plan: "pro", source: "manual", billing_status: "active" }),
  });

  const resolved = await resolveEffectiveStorageQuota("user-1", {
    supabaseClient: stub.client as never,
    now: new Date("2025-01-02T00:00:00Z"),
    env: { FREE_STORAGE_LIMIT_BYTES: "1024", PRO_STORAGE_LIMIT_BYTES: "2048" },
  });

  assert.equal(resolved.quotaBytes, 0);
  assert.equal(resolved.source, "override");
  assert.equal(resolved.plan.plan, "free");
  assert.equal(isStorageQuotaExceeded({ usedBytes: 0, attemptBytes: 1, quotaBytes: resolved.quotaBytes }), true);
  assert.equal(stub.getWrites(), 0);
});

test("missing quota rows use the verified effective plan without creating a 10 GB override", async () => {
  const freeStub = createQuotaClient({
    quota: null,
    entitlement: makeEntitlement({ plan: "pro", source: "manual", billing_status: "active" }),
  });
  const free = await resolveEffectiveStorageQuota("user-1", {
    supabaseClient: freeStub.client as never,
    now: new Date("2025-01-02T00:00:00Z"),
    env: { FREE_STORAGE_LIMIT_BYTES: "1024", PRO_STORAGE_LIMIT_BYTES: "2048" },
  });

  assert.equal(free.quotaBytes, 1024);
  assert.equal(free.source, "plan");
  assert.equal(free.plan.plan, "free");
  assert.equal(freeStub.getWrites(), 0);

  const licenseStub = createQuotaClient({
    quota: null,
    entitlement: makeEntitlement({
      plan: "pro",
      source: "license",
      billing_status: "active",
      pro_ends_at: "2025-02-01T00:00:00Z",
    }),
  });
  const license = await resolveEffectiveStorageQuota("user-1", {
    supabaseClient: licenseStub.client as never,
    now: new Date("2025-01-02T00:00:00Z"),
    env: { FREE_STORAGE_LIMIT_BYTES: "1024", PRO_STORAGE_LIMIT_BYTES: "2048" },
  });

  assert.equal(license.quotaBytes, 2048);
  assert.equal(license.plan.plan, "pro");
  assert.equal(licenseStub.getWrites(), 0);

  const manualStub = createQuotaClient({
    quota: null,
    manualPlan: { plan: "pro", expires_at: "2025-03-01T00:00:00Z", note: "school" },
  });
  const manual = await resolveEffectiveStorageQuota("user-1", {
    supabaseClient: manualStub.client as never,
    now: new Date("2025-01-02T00:00:00Z"),
    env: { FREE_STORAGE_LIMIT_BYTES: "1024", PRO_STORAGE_LIMIT_BYTES: "2048" },
  });

  assert.equal(manual.quotaBytes, 2048);
  assert.equal(manual.plan.plan, "pro");
  assert.equal(manual.plan.reason, "manual");
  assert.equal(manualStub.getWrites(), 0);
});

test("expired license entitlements fall back to the Free quota", async () => {
  const stub = createQuotaClient({
    quota: null,
    entitlement: makeEntitlement({
      plan: "pro",
      source: "license",
      billing_status: "active",
      pro_ends_at: "2025-01-01T00:00:00Z",
    }),
  });

  const resolved = await resolveEffectiveStorageQuota("user-1", {
    supabaseClient: stub.client as never,
    now: new Date("2025-01-02T00:00:00Z"),
    env: { FREE_STORAGE_LIMIT_BYTES: "1024", PRO_STORAGE_LIMIT_BYTES: "2048" },
  });

  assert.equal(resolved.plan.plan, "free");
  assert.equal(resolved.quotaBytes, 1024);
});

test("both quota admin endpoints accept zero through the shared validator", () => {
  assert.equal(isValidStorageQuotaInput(0), true);
  assert.equal(isValidStorageQuotaInput(-1), false);
  assert.equal(isValidStorageQuotaInput(1.5), false);

  for (const path of [
    "app/api/v1/storage/quota/route.ts",
    "app/api/v1/ops/admin/storage/quota/route.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /isValidStorageQuotaInput/);
    assert.doesNotMatch(source, /quotaBytes[^\n]*(?:<=\s*0|<\s*0)/);
  }

  const usageServer = readFileSync("lib/storage/usage.server.ts", "utf8");
  assert.match(usageServer, /resolveEffectiveStorageQuota/);
  assert.doesNotMatch(usageServer, /from\("storage_quota"\)[\s\S]{0,400}\.insert\(/);

  for (const path of [
    "app/api/v1/files/upload/prepare/route.ts",
    "app/api/v1/files/upload/commit/route.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /resolveEffectiveStorageQuota/);
    assert.match(source, /isStorageQuotaExceeded/);
    assert.doesNotMatch(source, /\.from\("user_entitlements"\)/);
    assert.doesNotMatch(source, /\.from\("storage_quota"\)/);
  }

  const uploadQuota = readFileSync("lib/storage/uploadQuota.server.ts", "utf8");
  assert.match(uploadQuota, /resolveEffectiveStorageQuota/);
  assert.match(uploadQuota, /isStorageQuotaExceeded/);

  for (const path of [
    "app/api/v1/boards/[boardId]/files/upload-plan/route.ts",
    "app/api/v1/boards/[boardId]/files/upload-url/route.ts",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /await assertStorageUploadAllowed\(user\.id, Number\(body\.bytes\)\)/);
    assert.match(source, /StorageUploadQuotaExceededError/);
    assert.match(source, /status: 409/);
  }

  const commitSource = readFileSync("app/api/v1/files/upload/commit/route.ts", "utf8");
  assert.match(commitSource, /isObjectKeyOwnedBy\(payload\.r2Key, ownerId\)/);
  assert.match(commitSource, /"INVALID_OBJECT_KEY"/);
});
