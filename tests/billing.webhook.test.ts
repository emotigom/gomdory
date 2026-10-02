import assert from "node:assert/strict";
import test from "node:test";

import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
} from "@/app/api/v1/billing/webhook/handler";
import {
  buildEntitlementUpdateFromSubscription,
  buildPendingCheckoutEntitlement,
  isStripeSubscriptionProvisionable,
  mapStripeSubscriptionStatus,
  signStripePayload,
  STRIPE_SIGNATURE_TOLERANCE_SECONDS,
  verifyStripeSignature,
} from "@/lib/billing/stripeWebhook";
import {
  buildCheckoutForm,
  buildStripeRequestHeaders,
  STRIPE_API_VERSION,
} from "@/lib/billing/stripeClient";
import {
  findUserIdBySubscription,
  getBillingEventReservationMode,
  getBillingEventStatus,
  recordBillingEvent,
} from "@/lib/billing/webhookHelpers";

function createAdminStub() {
  const billingEvents = new Map<string, unknown>();
  const entitlements = new Map<string, any>();

  return {
    from(table: string) {
      if (table === "billing_events") {
        return {
          insert: async (payload: any) => {
            if (billingEvents.has(payload.id)) {
              return { data: null, error: { code: "23505", message: "duplicate" } };
            }
            const inserted = { status: "received", ...payload };
            billingEvents.set(payload.id, inserted);
            return { data: inserted, error: null };
          },
          update: (payload: any) => ({
            eq: async (_field: string, id: string) => {
              const existing = billingEvents.get(id) ?? {};
              billingEvents.set(id, { ...existing, ...payload });
              return { data: { ...existing, ...payload }, error: null };
            },
          }),
          select: () => ({
            eq: (_field: string, id: string) => ({
              maybeSingle: async () => ({ data: billingEvents.get(id) ?? null, error: null }),
            }),
          }),
        };
      }

      if (table === "user_entitlements") {
        return {
          upsert: async (payload: any) => {
            const existing = entitlements.get(payload.user_id) ?? {};
            entitlements.set(payload.user_id, { ...existing, ...payload });
            return { data: payload, error: null };
          },
          select: () => ({
            eq: (_field: string, value: string) => ({
              maybeSingle: async () => {
                const row =
                  Array.from(entitlements.values()).find((record) => record[_field] === value) ?? null;
                return { data: row, error: null };
              },
            }),
          }),
        };
      }

      throw new Error(`Unsupported table ${table}`);
    },
    __entitlements: entitlements,
    __billingEvents: billingEvents,
  };
}

test("verifyStripeSignature accepts valid signature", async () => {
  const secret = "whsec_test";
  const payload = '{"id":"evt_test"}';
  const timestamp = 1700000000;
  const signature = await signStripePayload(secret, `${timestamp}.${payload}`);
  const header = `t=${timestamp},v1=${signature}`;

  const result = await verifyStripeSignature(payload, header, secret, { now: timestamp });
  assert.equal(result.timestamp, timestamp);
});

test("verifyStripeSignature rejects timestamps outside the default five-minute window", async () => {
  const secret = "whsec_test";
  const payload = '{"id":"evt_stale"}';
  const now = 1_800_000_000;
  const timestamp = now - STRIPE_SIGNATURE_TOLERANCE_SECONDS - 1;
  const signature = await signStripePayload(secret, `${timestamp}.${payload}`);

  await assert.rejects(
    verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, { now }),
    /timestamp_outside_tolerance/,
  );
});

test("verifyStripeSignature accepts a timestamp on the tolerance boundary", async () => {
  const secret = "whsec_test";
  const payload = '{"id":"evt_boundary"}';
  const now = 1_800_000_000;
  const timestamp = now - STRIPE_SIGNATURE_TOLERANCE_SECONDS;
  const signature = await signStripePayload(secret, `${timestamp}.${payload}`);

  const result = await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, { now });
  assert.equal(result.timestamp, timestamp);
});

test("recordBillingEvent leaves the existing status untouched for duplicates", async () => {
  const admin = createAdminStub();
  const event = { id: "evt_1", type: "test", data: { object: {} } };

  const first = await recordBillingEvent(admin as any, event);
  assert.equal(first.duplicate, false);
  admin.__billingEvents.set(event.id, {
    ...(admin.__billingEvents.get(event.id) as object),
    status: "processed",
    processed_at: "2026-08-22T00:00:00.000Z",
  });
  const second = await recordBillingEvent(admin as any, event);
  assert.equal(second.duplicate, true);
  assert.equal(await getBillingEventStatus(admin as any, event.id), "processed");
  assert.equal((admin.__billingEvents.get(event.id) as { status: string }).status, "processed");

  admin.__billingEvents.set(event.id, {
    ...(admin.__billingEvents.get(event.id) as object),
    status: "failed",
  });
  const third = await recordBillingEvent(admin as any, event);
  assert.equal(third.duplicate, true);
  assert.equal((admin.__billingEvents.get(event.id) as { status: string }).status, "failed");
  assert.equal(await getBillingEventStatus(admin as any, event.id), "failed");
});

test("billing event reservation retries failures but terminates completed duplicates", () => {
  assert.equal(getBillingEventReservationMode(null), "new");
  assert.equal(getBillingEventReservationMode("received"), "retry");
  assert.equal(getBillingEventReservationMode("failed"), "retry");
  assert.equal(getBillingEventReservationMode("processed"), "terminal");
  assert.equal(getBillingEventReservationMode("ignored"), "terminal");
});

test("subscription update syncs entitlement", async () => {
  const admin = createAdminStub();
  await admin.from("user_entitlements").upsert({
    user_id: "user-sub",
    stripe_subscription_id: "sub_123",
    stripe_customer_id: "cus_123",
    plan: "free",
    source: "system",
    billing_status: "free",
    provider: "none",
    trial_started_at: null,
    trial_ends_at: null,
    pro_ends_at: null,
  });

  const userId = await findUserIdBySubscription(admin as any, "sub_123", "cus_123");
  assert.equal(userId, "user-sub");

  const update = buildEntitlementUpdateFromSubscription({
    id: "sub_123",
    status: "active",
    current_period_end: 1_700_000_100,
    customer: "cus_123",
  }, new Date(1_700_000_000 * 1000));
  await admin.from("user_entitlements").upsert({ user_id: userId, ...update });
  const row = admin.__entitlements.get("user-sub");

  assert.equal(row.billing_status, "active");
  assert.equal(row.plan, "pro");
  assert.equal(row.provider, "stripe");
  assert.equal(row.pro_ends_at, new Date(1_700_000_100 * 1000).toISOString());
});

test("only active and trialing Stripe subscriptions can provision Pro", () => {
  const now = 1_800_000_000;
  const futurePeriodEnd = now + 3_600;

  assert.equal(isStripeSubscriptionProvisionable("active", futurePeriodEnd, now), true);
  assert.equal(isStripeSubscriptionProvisionable("trialing", futurePeriodEnd, now), true);
  assert.equal(isStripeSubscriptionProvisionable("active", undefined, now), false);
  assert.equal(isStripeSubscriptionProvisionable("trialing", now, now), false);

  for (const status of [
    "past_due",
    "canceled",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
    "unknown_future_status",
  ]) {
    const update = buildEntitlementUpdateFromSubscription({
      id: "sub_fail_closed",
      status,
      current_period_end: futurePeriodEnd,
      customer: "cus_fail_closed",
    }, new Date(now * 1000));

    assert.equal(isStripeSubscriptionProvisionable(status, futurePeriodEnd, now), false, status);
    assert.equal(update.plan, "free", status);
  }

  assert.equal(mapStripeSubscriptionStatus("unknown_future_status"), "free");
});

test("active Stripe status without a valid future period remains free and pending", () => {
  const now = new Date(1_800_000_000 * 1000);

  for (const currentPeriodEnd of [undefined, null, 1_800_000_000, Number.NaN]) {
    const update = buildEntitlementUpdateFromSubscription({
      id: "sub_unverified_window",
      status: "active",
      current_period_end: currentPeriodEnd,
      customer: "cus_unverified_window",
    }, now);

    assert.equal(update.plan, "free");
    assert.equal(update.billing_status, "free");
    assert.equal(update.source, "stripe_pending");
    assert.equal(update.pro_ends_at, null);
  }
});

test("checkout completion without a verified subscription remains pending and free", () => {
  const update = buildPendingCheckoutEntitlement({
    subscriptionId: "sub_pending",
    customerId: "cus_pending",
  });

  assert.equal(update.plan, "free");
  assert.equal(update.billing_status, "free");
  assert.equal(update.source, "stripe_pending");
  assert.equal(update.pro_ends_at, null);
});

test("checkout without a subscription id cannot overwrite an existing license", async () => {
  const admin = createAdminStub();
  await admin.from("user_entitlements").upsert({
    user_id: "user-license",
    plan: "pro",
    provider: "none",
    source: "license",
    billing_status: "active",
    pro_ends_at: "2030-01-01T00:00:00.000Z",
  });

  await assert.rejects(
    handleCheckoutCompleted(admin as never, {
      id: "evt_checkout_missing_subscription",
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user-license" },
          customer: "cus_license",
        },
      },
    }),
    /missing_checkout_subscription/,
  );

  const row = admin.__entitlements.get("user-license");
  assert.equal(row.plan, "pro");
  assert.equal(row.source, "license");
  assert.equal(row.provider, "none");
});

test("checkout subscription lookup failures leave existing trial state untouched", async () => {
  const admin = createAdminStub();
  await admin.from("user_entitlements").upsert({
    user_id: "user-trial",
    plan: "free",
    provider: "none",
    source: "trial",
    billing_status: "trial",
    trial_ends_at: "2030-01-01T00:00:00.000Z",
  });

  await assert.rejects(
    handleCheckoutCompleted(
      admin as never,
      {
        id: "evt_checkout_lookup_failure",
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { userId: "user-trial" },
            customer: "cus_trial",
            subscription: "sub_unavailable",
          },
        },
      },
      async () => {
        throw new Error("temporary_stripe_failure");
      },
    ),
    /stripe_subscription_retrieve_failed/,
  );

  const row = admin.__entitlements.get("user-trial");
  assert.equal(row.source, "trial");
  assert.equal(row.provider, "none");
  assert.equal(row.billing_status, "trial");
});

test("checkout copies the authenticated user marker onto the resulting subscription", () => {
  const form = buildCheckoutForm({
    mode: "subscription",
    priceId: "price_month",
    metadata: { userId: "user-123" },
    successUrl: "https://www.gomdory.com/dashboard/billing/success",
    cancelUrl: "https://www.gomdory.com/dashboard/billing",
  });

  assert.equal(form.get("metadata[userId]"), "user-123");
  assert.equal(form.get("subscription_data[metadata][userId]"), "user-123");
});

test("Stripe REST calls are pinned to the subscription shape used by the webhook", () => {
  const headers = buildStripeRequestHeaders("sk_test_secret", {
    "Stripe-Version": "2099-01-01.future",
  });

  assert.equal(STRIPE_API_VERSION, "2024-10-28.acacia");
  assert.equal(headers["Stripe-Version"], STRIPE_API_VERSION);
});

test("subscription events apply the current Stripe state instead of a stale event snapshot", async () => {
  const admin = createAdminStub();
  let retrievedSubscriptionId = "";
  await handleSubscriptionUpdated(admin as never, {
    id: "evt_subscription_created",
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: "sub_created",
        status: "canceled",
        current_period_end: 1,
        customer: "cus_created",
        metadata: { userId: "stale-user" },
      },
    },
  }, {
    retrieveSubscriptionFn: async (subscriptionId) => {
      retrievedSubscriptionId = subscriptionId;
      return {
        id: subscriptionId,
        status: "active",
        current_period_end: 1_900_000_000,
        customer: "cus_created",
        metadata: { userId: "user-created" },
      };
    },
  });

  const row = admin.__entitlements.get("user-created");
  assert.equal(retrievedSubscriptionId, "sub_created");
  assert.equal(row.plan, "pro");
  assert.equal(row.billing_status, "active");
  assert.equal(row.stripe_subscription_id, "sub_created");
  assert.equal(admin.__entitlements.has("stale-user"), false);
});

test("subscription retrieval failures abort entitlement writes", async () => {
  const admin = createAdminStub();

  await assert.rejects(
    handleSubscriptionUpdated(admin as never, {
      id: "evt_subscription_failed_lookup",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_unavailable" } },
    }, {
      retrieveSubscriptionFn: async () => {
        throw new Error("temporary_stripe_failure");
      },
    }),
    /stripe_subscription_retrieve_failed/,
  );

  assert.equal(admin.__entitlements.size, 0);
});
