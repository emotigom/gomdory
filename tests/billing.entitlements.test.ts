import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlanSummary,
  getEffectivePlan,
  isStripeEntitlementVerified,
  startTrialForUser,
  type UserEntitlementRow,
} from "@/lib/billing/entitlements";

test("getEffectivePlan treats active trial as pro", () => {
  const entitlement: UserEntitlementRow = {
    user_id: "user-1",
    plan: "free",
    trial_started_at: "2025-01-01T00:00:00Z",
    trial_ends_at: "2025-01-05T00:00:00Z",
    source: "trial",
    provider: "none",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    pro_ends_at: null,
    billing_status: "trial",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const effective = getEffectivePlan(entitlement, new Date("2025-01-02T00:00:00Z"));
  assert.equal(effective.plan, "pro");
  assert.equal(effective.isTrial, true);
  assert.equal(effective.expiresAt, entitlement.trial_ends_at);
});

test("getEffectivePlan treats active stripe subscription as pro", () => {
  const entitlement: UserEntitlementRow = {
    user_id: "user-stripe",
    plan: "free",
    trial_started_at: null,
    trial_ends_at: null,
    source: "system",
    provider: "stripe",
    stripe_customer_id: "cus_123",
    stripe_subscription_id: "sub_123",
    pro_ends_at: "2025-02-01T00:00:00Z",
    billing_status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const effective = getEffectivePlan(entitlement, new Date("2025-01-02T00:00:00Z"));
  assert.equal(effective.plan, "pro");
  assert.equal(effective.isTrial, false);
  assert.equal(effective.reason, "stripe");
  assert.equal(effective.expiresAt, entitlement.pro_ends_at);
  assert.equal(isStripeEntitlementVerified(entitlement, new Date("2025-01-02T00:00:00Z")), true);
});

test("Stripe rows require a real subscription id before Pro is verified", () => {
  const entitlement: UserEntitlementRow = {
    user_id: "user-stripe-partial",
    plan: "pro",
    trial_started_at: null,
    trial_ends_at: null,
    source: "stripe",
    provider: "stripe",
    stripe_customer_id: "cus_partial",
    stripe_subscription_id: null,
    pro_ends_at: "2025-02-01T00:00:00Z",
    billing_status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  assert.equal(getEffectivePlan(entitlement, new Date("2025-01-02T00:00:00Z")).plan, "free");
  assert.equal(isStripeEntitlementVerified(entitlement, new Date("2025-01-02T00:00:00Z")), false);

  const missingPeriod = { ...entitlement, stripe_subscription_id: "sub_partial", pro_ends_at: null };
  assert.equal(getEffectivePlan(missingPeriod, new Date("2025-01-02T00:00:00Z")).plan, "free");
  assert.equal(isStripeEntitlementVerified(missingPeriod, new Date("2025-01-02T00:00:00Z")), false);
});

test("Stripe rows fail closed when the subscription is inactive or unverified", () => {
  const base: UserEntitlementRow = {
    user_id: "user-stripe-closed",
    plan: "pro",
    trial_started_at: null,
    trial_ends_at: null,
    source: "stripe",
    provider: "stripe",
    stripe_customer_id: "cus_closed",
    stripe_subscription_id: "sub_closed",
    pro_ends_at: "2026-02-01T00:00:00Z",
    billing_status: "past_due",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  for (const billingStatus of ["free", "past_due", "canceled"] as const) {
    const entitlement = { ...base, billing_status: billingStatus };
    assert.equal(getEffectivePlan(entitlement, new Date("2025-01-02T00:00:00Z")).plan, "free", billingStatus);
    assert.equal(isStripeEntitlementVerified(entitlement, new Date("2025-01-02T00:00:00Z")), false, billingStatus);
  }
});

test("a raw manual Pro entitlement is ignored in favor of verified plan sources", () => {
  const entitlement: UserEntitlementRow = {
    user_id: "user-manual-pro",
    plan: "pro",
    trial_started_at: null,
    trial_ends_at: null,
    source: "manual",
    provider: "none",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    pro_ends_at: null,
    billing_status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  assert.equal(getEffectivePlan(entitlement).plan, "free");
  assert.equal(isStripeEntitlementVerified(entitlement), false);
});

test("an expired license entitlement is no longer Pro", () => {
  const entitlement: UserEntitlementRow = {
    user_id: "user-expired-license",
    plan: "pro",
    trial_started_at: null,
    trial_ends_at: null,
    source: "license",
    provider: "none",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    pro_ends_at: "2025-01-01T00:00:00Z",
    billing_status: "active",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  assert.equal(getEffectivePlan(entitlement, new Date("2025-01-02T00:00:00Z")).plan, "free");
});

test("buildPlanSummary uses underlying plan when trial expired", () => {
  const previousEnv = {
    FREE_STORAGE_LIMIT_BYTES: process.env.FREE_STORAGE_LIMIT_BYTES,
    PRO_STORAGE_LIMIT_BYTES: process.env.PRO_STORAGE_LIMIT_BYTES,
  };
  process.env.FREE_STORAGE_LIMIT_BYTES = "1024";
  process.env.PRO_STORAGE_LIMIT_BYTES = "2048";

  try {
    const entitlement: UserEntitlementRow = {
    user_id: "user-2",
    plan: "pro",
    trial_started_at: "2024-01-01T00:00:00Z",
    trial_ends_at: "2024-01-05T00:00:00Z",
    source: "license",
    provider: "none",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    pro_ends_at: null,
    billing_status: "active",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
    const summary = buildPlanSummary(entitlement, new Date("2025-01-01T00:00:00Z"));
    assert.equal(summary.plan, "pro");
    assert.equal(summary.limits.storageLimitBytes, 2048);
  } finally {
    if (previousEnv.FREE_STORAGE_LIMIT_BYTES === undefined) {
      delete process.env.FREE_STORAGE_LIMIT_BYTES;
    } else {
      process.env.FREE_STORAGE_LIMIT_BYTES = previousEnv.FREE_STORAGE_LIMIT_BYTES;
    }
    if (previousEnv.PRO_STORAGE_LIMIT_BYTES === undefined) {
      delete process.env.PRO_STORAGE_LIMIT_BYTES;
    } else {
      process.env.PRO_STORAGE_LIMIT_BYTES = previousEnv.PRO_STORAGE_LIMIT_BYTES;
    }
  }
});

test("startTrialForUser is idempotent", async () => {
  const admin = createAdminStub();
  const now = new Date("2025-01-01T00:00:00Z");

  const first = await startTrialForUser("user-3", { createAdminClient: () => admin, now });
  assert.equal(first.isTrial, true);
  assert.equal(first.plan, "pro");

  const second = await startTrialForUser("user-3", { createAdminClient: () => admin, now });
  assert.equal(second.plan, "pro");
  // @ts-expect-error alreadyStarted is an augmentation for this flow
  assert.equal(Boolean(second.alreadyStarted), true);
});

function createAdminStub(initial?: UserEntitlementRow) {
  const store = new Map<string, UserEntitlementRow>();
  if (initial) {
    store.set(initial.user_id, initial);
  }

  return {
    from(table: string) {
      if (table !== "user_entitlements") {
        throw new Error(`unsupported table ${table}`);
      }

      return {
        select: () => ({
          eq: (_field: string, userId: string) => ({
            maybeSingle: async () => ({ data: store.get(userId) ?? null, error: null }),
            single: async () => {
              const data = store.get(userId);
              return data ? { data, error: null } : { data: null as unknown as UserEntitlementRow, error: { message: "not found" } };
            },
          }),
        }),
        insert: (payload: Partial<UserEntitlementRow>) => ({
          select: () => ({
            single: async () => {
              const row: UserEntitlementRow = {
                user_id: payload.user_id ?? crypto.randomUUID(),
                plan: payload.plan ?? "free",
                trial_started_at: payload.trial_started_at ?? null,
                trial_ends_at: payload.trial_ends_at ?? null,
                source: payload.source ?? "system",
                provider: payload.provider ?? "none",
                stripe_customer_id: payload.stripe_customer_id ?? null,
                stripe_subscription_id: payload.stripe_subscription_id ?? null,
                pro_ends_at: payload.pro_ends_at ?? null,
                billing_status: payload.billing_status ?? "free",
                created_at: payload.created_at ?? new Date().toISOString(),
                updated_at: payload.updated_at ?? new Date().toISOString(),
              };
              store.set(row.user_id, row);
              return { data: row, error: null };
            },
          }),
        }),
        update: (payload: Partial<UserEntitlementRow>) => ({
          eq: (_field: string, userId: string) => ({
            select: () => ({
              single: async () => {
                const existing = store.get(userId);
                const next: UserEntitlementRow = {
                  user_id: userId,
                  plan: payload.plan ?? existing?.plan ?? "free",
                  trial_started_at: payload.trial_started_at ?? existing?.trial_started_at ?? null,
                  trial_ends_at: payload.trial_ends_at ?? existing?.trial_ends_at ?? null,
                  source: payload.source ?? existing?.source ?? "system",
                  provider: payload.provider ?? existing?.provider ?? "none",
                  stripe_customer_id: payload.stripe_customer_id ?? existing?.stripe_customer_id ?? null,
                  stripe_subscription_id: payload.stripe_subscription_id ?? existing?.stripe_subscription_id ?? null,
                  pro_ends_at: payload.pro_ends_at ?? existing?.pro_ends_at ?? null,
                  billing_status: payload.billing_status ?? existing?.billing_status ?? "free",
                  created_at: existing?.created_at ?? new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
              store.set(userId, next);
              return { data: next, error: null };
              },
            }),
          }),
        }),
        upsert: (payload: Partial<UserEntitlementRow>) => {
          const existing = store.get(payload.user_id ?? "");
          const next: UserEntitlementRow = {
            user_id: payload.user_id ?? crypto.randomUUID(),
            plan: payload.plan ?? existing?.plan ?? "free",
            trial_started_at: payload.trial_started_at ?? null,
            trial_ends_at: payload.trial_ends_at ?? null,
            source: payload.source ?? "system",
            provider: payload.provider ?? existing?.provider ?? "none",
            stripe_customer_id: payload.stripe_customer_id ?? existing?.stripe_customer_id ?? null,
            stripe_subscription_id: payload.stripe_subscription_id ?? existing?.stripe_subscription_id ?? null,
            pro_ends_at: payload.pro_ends_at ?? existing?.pro_ends_at ?? null,
            billing_status: payload.billing_status ?? existing?.billing_status ?? "free",
            created_at: existing?.created_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          store.set(next.user_id, next);
          return {
            error: null,
            select: () => ({
              single: async () => ({ data: next, error: null }),
            }),
          };
        },
      };
    },
  };
}
