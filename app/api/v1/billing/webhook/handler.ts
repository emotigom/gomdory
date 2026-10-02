import { NextRequest } from "next/server";

import { requireStripeBillingConfig } from "@/lib/billing/config";
import {
  buildEntitlementUpdateFromSubscription,
  verifyStripeSignature,
  type StripeWebhookEvent,
} from "@/lib/billing/stripeWebhook";
import { retrieveSubscription, type StripeSubscription } from "@/lib/billing/stripeClient";
import {
  findUserIdBySubscription,
  getBillingEventReservationMode,
  getBillingEventStatus,
  recordBillingEvent,
  type SupabaseAdmin,
} from "@/lib/billing/webhookHelpers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRuntimeEnv } from "@/lib/server/runtimeEnv";

function markEvent(
  admin: SupabaseAdmin,
  id: string,
  status: "processed" | "ignored" | "failed",
  meta?: Record<string, unknown>,
) {
  return admin
    .from("billing_events")
    .update({ status, processed_at: new Date().toISOString(), ...(meta ? { meta } : {}) })
    .eq("id", id);
}

async function upsertEntitlement(admin: SupabaseAdmin, userId: string, payload: Record<string, unknown>) {
  const { error } = await admin.from("user_entitlements").upsert({ user_id: userId, ...payload });
  if (error) {
    throw error;
  }
}

const SUBSCRIPTION_EVENT_TYPES = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function subscriptionIdFromEvent(event: StripeWebhookEvent): string {
  const candidate = (event.data.object as { id?: unknown } | null)?.id;
  if (typeof candidate !== "string" || !candidate.trim()) {
    throw new Error("invalid_subscription_id");
  }
  return candidate;
}

async function loadCurrentSubscription(
  event: StripeWebhookEvent,
  retrieveSubscriptionFn: typeof retrieveSubscription = retrieveSubscription,
): Promise<StripeSubscription> {
  return loadSubscriptionById(subscriptionIdFromEvent(event), retrieveSubscriptionFn);
}

async function loadSubscriptionById(
  subscriptionId: string,
  retrieveSubscriptionFn: typeof retrieveSubscription = retrieveSubscription,
): Promise<StripeSubscription> {
  try {
    const subscription = await retrieveSubscriptionFn(subscriptionId);
    if (!subscription || subscription.id !== subscriptionId) {
      throw new Error("subscription_id_mismatch");
    }
    return subscription;
  } catch {
    throw new Error("stripe_subscription_retrieve_failed");
  }
}

export async function handleCheckoutCompleted(
  admin: SupabaseAdmin,
  event: StripeWebhookEvent,
  retrieveSubscriptionFn: typeof retrieveSubscription = retrieveSubscription,
) {
  const session = event.data.object as {
    metadata?: Record<string, string>;
    customer?: string | null;
    subscription?: string | { id: string };
  };
  const userId = session.metadata?.userId?.trim();
  if (!userId) {
    await markEvent(admin, event.id, "ignored", { reason: "missing_user_id" });
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  if (!subscriptionId) {
    throw new Error("missing_checkout_subscription");
  }
  const subscription = await loadSubscriptionById(subscriptionId, retrieveSubscriptionFn);

  const update = buildEntitlementUpdateFromSubscription(subscription);

  await upsertEntitlement(admin, userId, update);
  await markEvent(admin, event.id, "processed");
}

export async function handleSubscriptionUpdated(
  admin: SupabaseAdmin,
  event: StripeWebhookEvent,
  deps?: {
    currentSubscription?: StripeSubscription;
    retrieveSubscriptionFn?: typeof retrieveSubscription;
  },
) {
  const subscription =
    deps?.currentSubscription ??
    (await loadCurrentSubscription(event, deps?.retrieveSubscriptionFn));
  const metadataUserId = subscription.metadata?.userId?.trim();
  const userId = metadataUserId || (await findUserIdBySubscription(admin, subscription.id, subscription.customer));
  if (!userId) {
    await markEvent(admin, event.id, "ignored", { reason: "user_not_found" });
    return;
  }

  const update = buildEntitlementUpdateFromSubscription(subscription);

  await upsertEntitlement(admin, userId, update);
  await markEvent(admin, event.id, "processed");
}

export async function handleWebhookPost(request: NextRequest) {
  let admin: SupabaseAdmin | null = null;
  let eventId: string | null = null;
  try {
    const raw = await request.text();
    const signature = request.headers.get("stripe-signature");
    const env = requireStripeBillingConfig(getRuntimeEnv() as Record<string, string | undefined>, {
      requireWebhook: true,
    });
    if (!env.enabled) {
      return new Response("billing_disabled", { status: 503 });
    }

    await verifyStripeSignature(raw, signature, env.webhookSecret);
    const event = JSON.parse(raw) as StripeWebhookEvent;
    admin = createSupabaseAdminClient();

    const existingStatus = await getBillingEventStatus(admin, event.id);
    const reservationMode = getBillingEventReservationMode(existingStatus);
    if (reservationMode === "terminal") {
      return new Response("ok", { status: 200 });
    }
    if (reservationMode === "retry") {
      eventId = event.id;
    }

    // Stripe does not guarantee event delivery order. Resolve the resource's
    // current state before reserving the event so a transient Stripe failure
    // remains retryable instead of becoming a duplicate on the next delivery.
    const currentSubscription = SUBSCRIPTION_EVENT_TYPES.has(event.type)
      ? await loadCurrentSubscription(event)
      : null;

    if (reservationMode === "new") {
      const { duplicate } = await recordBillingEvent(admin, event);
      if (duplicate) {
        return new Response("ok", { status: 200 });
      }
      eventId = event.id;
    }

    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(admin, event);
      return new Response("ok", { status: 200 });
    }

    if (currentSubscription) {
      await handleSubscriptionUpdated(admin, event, { currentSubscription });
      return new Response("ok", { status: 200 });
    }

    await markEvent(admin, event.id, "ignored", { reason: "unhandled_event" });
    return new Response("ok", { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "billing_disabled" || message.startsWith("missing_env")
        ? 503
        : message === "stripe_subscription_retrieve_failed"
          ? 502
          : 400;
    console.error("[billing:webhook] failed", error);
    if (admin && eventId) {
      try {
        await markEvent(admin, eventId, "failed", { reason: message });
      } catch (markError) {
        console.error("[billing:webhook] failed to mark event", markError);
      }
    }
    return new Response("invalid", { status });
  }
}
