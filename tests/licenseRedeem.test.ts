import assert from "node:assert/strict";
import test from "node:test";

import { createHash } from "node:crypto";

import { redeemLicenseCode, type UserEntitlementRow } from "@/lib/billing/entitlements";

type LicenseRow = {
  id: string;
  code_sha256: string;
  plan: "pro" | "free";
  expires_at: string | null;
  max_uses: number;
  uses: number;
  note: string | null;
};

function createStubAdmin(options: { license: LicenseRow; entitlement?: UserEntitlementRow; now?: Date }) {
  const licenses = new Map<string, LicenseRow>([[options.license.code_sha256, { ...options.license }]]);
  const entitlements = new Map<string, UserEntitlementRow>();
  if (options.entitlement) {
    entitlements.set(options.entitlement.user_id, options.entitlement);
  }

  return {
    from(table: string) {
      if (table === "license_keys") {
        return {
          select: () => ({
            eq: (_field: string, sha: string) => ({
              maybeSingle: async () => {
                const row = licenses.get(sha);
                return { data: row ? { ...row } : null, error: null };
              },
            }),
          }),
          update: (payload: Partial<LicenseRow>) => {
            const equalFilters = new Map<string, unknown>();
            const nullFilters = new Set<string>();
            const query = {
              eq(field: string, value: unknown) {
                equalFilters.set(field, value);
                return query;
              },
              is(field: string, value: unknown) {
                if (value === null) nullFilters.add(field);
                return query;
              },
              gt(field: string, value: string) {
                equalFilters.set(`gt:${field}`, value);
                return query;
              },
              select: () => ({
                maybeSingle: async () => {
                  const match = Array.from(licenses.values()).find((row) => {
                    const record = row as unknown as Record<string, unknown>;
                    return (
                      Array.from(equalFilters).every(([field, value]) => {
                        if (field.startsWith("gt:")) {
                          const actual = record[field.slice(3)];
                          return typeof actual === "string" && actual > String(value);
                        }
                        return record[field] === value;
                      }) &&
                      Array.from(nullFilters).every((field) => record[field] === null)
                    );
                  });

                  if (!match) return { data: null, error: null };
                  match.uses = payload.uses ?? match.uses;
                  return { data: { id: match.id, uses: match.uses }, error: null };
                },
              }),
            };
            return query;
          },
        };
      }

      if (table === "user_entitlements") {
        return {
          upsert: (payload: Partial<UserEntitlementRow>) => ({
            select: () => ({
              single: async () => {
                const row: UserEntitlementRow = {
                  user_id: payload.user_id ?? "user-1",
                  plan: payload.plan ?? "pro",
                  trial_started_at: null,
                  trial_ends_at: null,
                  source: payload.source ?? "license",
                  provider: payload.provider ?? "none",
                  stripe_customer_id: null,
                  stripe_subscription_id: null,
                  pro_ends_at: payload.pro_ends_at ?? null,
                  billing_status: payload.billing_status ?? "active",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                entitlements.set(row.user_id, row);
                return { data: row, error: null };
              },
            }),
          }),
        };
      }

      throw new Error(`unsupported table ${table}`);
    },
    getLicense(codeSha: string) {
      const row = licenses.get(codeSha);
      return row ? { ...row } : null;
    },
    getEntitlement(userId: string) {
      return entitlements.get(userId) ?? null;
    },
  };
}

test("redeemLicenseCode fails for expired code", async () => {
  const code = "GKD-XXXX-XXXX-XXXX";
  const hashed = createHash("sha256").update(code).digest("hex");
  const expired = new Date();
  expired.setDate(expired.getDate() - 1);
  const license: LicenseRow = {
    id: "lic-1",
    code_sha256: hashed,
    plan: "pro",
    expires_at: expired.toISOString(),
    max_uses: 1,
    uses: 0,
    note: null,
  };

  await assert.rejects(
    () => redeemLicenseCode("user-1", code, { createAdminClient: () => createStubAdmin({ license }) }),
    /expired/,
  );
});

test("redeemLicenseCode fails when max uses reached", async () => {
  const code = "GKD-YYYY-YYYY-YYYY";
  const hashed = createHash("sha256").update(code).digest("hex");
  const license: LicenseRow = {
    id: "lic-2",
    code_sha256: hashed,
    plan: "pro",
    expires_at: null,
    max_uses: 1,
    uses: 1,
    note: null,
  };

  await assert.rejects(
    () => redeemLicenseCode("user-1", code, { createAdminClient: () => createStubAdmin({ license }) }),
    /max_uses_reached/,
  );
});

test("concurrent redemptions cannot issue more entitlements than max uses", async () => {
  const code = "GKD-RACE-RACE-RACE";
  const hashed = createHash("sha256").update(code).digest("hex");
  const license: LicenseRow = {
    id: "lic-race",
    code_sha256: hashed,
    plan: "pro",
    expires_at: null,
    max_uses: 1,
    uses: 0,
    note: null,
  };
  const admin = createStubAdmin({ license });

  const results = await Promise.allSettled([
    redeemLicenseCode("user-race-a", code, { createAdminClient: () => admin }),
    redeemLicenseCode("user-race-b", code, { createAdminClient: () => admin }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(admin.getLicense(hashed)?.uses, 1);
  assert.equal(
    [admin.getEntitlement("user-race-a"), admin.getEntitlement("user-race-b")].filter(Boolean).length,
    1,
  );
});
