import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { handlePost as checkout } from "@/app/api/v1/billing/checkout/handler";
import { GET as licenseList } from "@/app/api/v1/billing/license/list/route";
import { GET as getPlan } from "@/app/api/v1/billing/plan/route";
import { POST as startTrial } from "@/app/api/v1/billing/start-trial/route";
import { POST as upgradeRequest } from "@/app/api/v1/billing/upgrade-request/route";
import { routes } from "@/lib/standards/routes";
import { resolveCheckoutSuccessUrl, resolveStripePriceId } from "@/lib/billing/checkoutPolicy";
import { getStripeBillingConfig } from "@/lib/billing/config";
import type { UserPlan } from "@/lib/types/billing";

test("plan endpoint returns plan payload", async () => {
  const response = await getPlan(new Request(new URL(routes.api.billing.plan(), "http://localhost")), {}, {
    requireUserApiFn: async () => ({ user: { id: "user-42" } }),
    getUserPlanFn: async () => ({ plan: "pro", isPro: true } as UserPlan),
  });

  const payload = (await response.json()) as { ok?: boolean; plan?: UserPlan; requestId?: string };
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.plan?.plan, "pro");
  assert.ok(payload.requestId);
  assert.equal(response.headers.get("x-request-id"), payload.requestId);
});

test("start trial endpoint preserves requestId-bearing success payloads on canonical plumbing", async () => {
  const response = await startTrial(
    new Request(new URL(routes.api.billing.startTrial(), "http://localhost"), {
      method: "POST",
      headers: { "x-request-id": "req-start-trial-1" },
    }),
    {},
    {
      requireUserApiFn: async () => ({ user: { id: "user-77" } }),
      startTrialForUserFn: async () => ({ started: true, plan: "pro" } as never),
    },
  );

  const payload = (await response.json()) as {
    ok?: boolean;
    started?: boolean;
    plan?: string;
    requestId?: string;
  };
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.started, true);
  assert.equal(payload.plan, "pro");
  assert.equal(payload.requestId, "req-start-trial-1");
  assert.equal(response.headers.get("x-request-id"), "req-start-trial-1");
});

test("license list endpoint keeps legacy body shape while adding canonical request headers", async () => {
  let createdByUserIdFilter: string | null = null;
  const response = await licenseList(
    new Request(new URL(routes.api.billing.licenseList(), "http://localhost"), {
      headers: { "x-request-id": "req-license-list-1" },
    }),
    {},
    {
      requireUserApiFn: async () => ({ user: { id: "user-99", email: "teacher@example.com" } }),
      isOpsAdminFn: () => false,
      createSupabaseAdminClientFn: () => {
        const queryResult = {
          data: [
            {
              id: "lic-1",
              display_hint: "학교",
              uses: 1,
              max_uses: 10,
              expires_at: null,
              issued_to: "teacher@example.com",
              created_at: "2026-03-20T00:00:00.000Z",
              seats: 30,
              plan: "school",
              created_by_user_id: "user-99",
            },
          ],
          error: null,
        };
        const query = {
          eq: (column: string, value: string) => {
            if (column === "created_by_user_id") {
              createdByUserIdFilter = value;
              queryResult.data[0].created_by_user_id = value;
            }
            return query;
          },
          then: (resolve: (value: typeof queryResult) => unknown) => resolve(queryResult),
        };

        return ({
          from: () => ({
            select: () => ({
              order: () => ({
                limit: () => query,
              }),
            }),
          }),
        }) as never;
      },
    },
  );

  const payload = (await response.json()) as {
    ok?: boolean;
    requestId?: string;
    licenses?: Array<{ id?: string; createdByUserId?: string }>;
  };
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.requestId, undefined);
  assert.equal(payload.licenses?.[0]?.id, "lic-1");
  assert.equal(payload.licenses?.[0]?.createdByUserId, "user-99");
  assert.equal(createdByUserIdFilter, "user-99");
  assert.equal(response.headers.get("x-request-id"), "req-license-list-1");
});

test("upgrade request endpoint stores request", async () => {
  const response = await upgradeRequest(
    new Request(new URL(routes.api.billing.upgradeRequest(), "http://localhost"), {
      method: "POST",
      body: JSON.stringify({
        orgName: "학교",
        contactEmail: "ops@example.com",
        seats: 10,
        message: "테스트 요청",
      }),
    }),
    {},
    {
      requireUserApiFn: async () => ({ user: { id: "user-99" } }),
      createSupabaseAdminClientFn: () =>
        ({
          from: () => ({
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { request_id: "req-1" }, error: null }),
              }),
            }),
          }),
        }) as never,
      checkRateLimitFn: async () => ({ ok: true }),
    },
  );

  const payload = (await response.json()) as { ok?: boolean; requestId?: string };
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.requestId, "req-1");
});

test("checkout price selection never falls back to the other billing interval", () => {
  assert.equal(resolveStripePriceId("month", { priceYearly: "price_year" }), null);
  assert.equal(resolveStripePriceId("year", { priceMonthly: "price_month" }), null);
  assert.equal(resolveStripePriceId("month", { priceMonthly: "price_month" }), "price_month");
  assert.equal(resolveStripePriceId("year", { priceYearly: "price_year" }), "price_year");

  const legacyOnly = getStripeBillingConfig({
    NEXT_PUBLIC_BILLING_ENABLED: "1",
    NEXT_PUBLIC_BILLING_PROVIDER: "stripe",
    STRIPE_PRICE_ID_PRO: "price_ambiguous",
  });
  assert.equal(legacyOnly.priceMonthly, undefined);
  assert.equal(legacyOnly.priceYearly, undefined);
});

test("checkout returns a clear 503 when the selected interval has no price", async () => {
  let checkoutCalled = false;
  const response = await checkout(
    new Request("http://localhost/api/v1/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "year" }),
    }) as never,
    {},
    { requestId: "req-price-missing" } as never,
    {
      getRuntimeEnvFn: (() => ({})) as never,
      requireStripeBillingConfigFn: (() => ({
        provider: "stripe",
        enabled: true,
        secretKey: "sk_test",
        webhookSecret: "whsec_test",
        priceMonthly: "price_month",
        priceYearly: undefined,
        successUrl: "https://www.gomdory.com/dashboard/billing/success",
        cancelUrl: "https://www.gomdory.com/dashboard/billing",
        portalReturnUrl: "https://www.gomdory.com/dashboard/billing",
      })) as never,
      requireUserApiFn: async () => ({ user: { id: "user-1", email: "user@example.com" } }) as never,
      createCheckoutSessionFn: (async () => {
        checkoutCalled = true;
        return { url: "https://checkout.stripe.com/test" };
      }) as never,
      logAuditFn: (async () => {}) as never,
    },
  );

  const payload = (await response.json()) as { ok?: boolean; error?: { code?: string }; code?: string };
  assert.equal(response.status, 503);
  assert.equal(payload.error?.code ?? payload.code, "billing_price_unavailable");
  assert.equal(checkoutCalled, false);
});

test("checkout returnTo accepts only same-origin dashboard destinations", () => {
  const configured = "https://www.gomdory.com/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}";

  assert.equal(
    resolveCheckoutSuccessUrl("/dashboard/files?from=billing", configured),
    "https://www.gomdory.com/dashboard/files?from=billing",
  );
  assert.equal(
    resolveCheckoutSuccessUrl("https://www.gomdory.com/dashboard/templates", configured),
    "https://www.gomdory.com/dashboard/templates",
  );
  assert.equal(resolveCheckoutSuccessUrl("https://evil.example/dashboard", configured), configured);
  assert.equal(resolveCheckoutSuccessUrl("//evil.example/dashboard", configured), configured);
  assert.equal(resolveCheckoutSuccessUrl("https://user@www.gomdory.com/dashboard", configured), configured);
  assert.equal(resolveCheckoutSuccessUrl("/contact", configured), configured);
  assert.equal(resolveCheckoutSuccessUrl("/dashboard.evil", configured), configured);
});

test("checkout route does not pass an external returnTo to Stripe", async () => {
  const configured = "https://www.gomdory.com/dashboard/billing/success";
  let checkoutSuccessUrl = "";
  const response = await checkout(
    new Request("http://localhost/api/v1/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "month", returnTo: "https://evil.example/dashboard" }),
    }) as never,
    {},
    { requestId: "req-safe-return" } as never,
    {
      getRuntimeEnvFn: (() => ({})) as never,
      requireStripeBillingConfigFn: (() => ({
        provider: "stripe",
        enabled: true,
        secretKey: "sk_test",
        webhookSecret: "whsec_test",
        priceMonthly: "price_month",
        priceYearly: "price_year",
        successUrl: configured,
        cancelUrl: "https://www.gomdory.com/dashboard/billing",
        portalReturnUrl: "https://www.gomdory.com/dashboard/billing",
      })) as never,
      requireUserApiFn: async () => ({ user: { id: "user-1", email: "user@example.com" } }) as never,
      createCheckoutSessionFn: (async (params: { successUrl: string }) => {
        checkoutSuccessUrl = params.successUrl;
        return { url: "https://checkout.stripe.com/test" };
      }) as never,
      logAuditFn: (async () => {}) as never,
    },
  );

  const payload = (await response.json()) as { ok?: boolean; url?: string; requestId?: string };
  assert.equal(response.status, 200);
  assert.equal(checkoutSuccessUrl, configured);
  assert.equal(payload.url, "https://checkout.stripe.com/test");
  assert.equal(payload.requestId, "req-safe-return");
});

test("billing success page is wired to pending and verified entitlement states", () => {
  const pageSource = readFileSync("app/dashboard/billing/success/page.tsx", "utf8");
  const refresherSource = readFileSync("app/dashboard/billing/success/successRefresher.tsx", "utf8");

  assert.match(pageSource, /isStripeEntitlementVerified\(entitlement\)/);
  assert.match(pageSource, /data-billing-verification=\{verified \? "verified" : "pending"\}/);
  assert.match(pageSource, /verified \? styles\.receiptVerified : styles\.receiptPending/);
  assert.match(pageSource, /<BillingSuccessRefresher verified=\{verified\} \/>/);
  assert.match(refresherSource, /router\.refresh\(\)/);
  assert.match(refresherSource, /data-verified=\{verified \? "true" : "false"\}/);
  assert.doesNotMatch(pageSource, /Pro가 활성화되었습니다/);
});
