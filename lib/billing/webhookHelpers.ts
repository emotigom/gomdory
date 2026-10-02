import type { StripeWebhookEvent } from "@/lib/billing/stripeWebhook";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

export type BillingEventStatus = "received" | "processed" | "ignored" | "failed";
export type BillingEventReservationMode = "new" | "retry" | "terminal";

export function getBillingEventReservationMode(
  status: BillingEventStatus | null,
): BillingEventReservationMode {
  if (status === "processed" || status === "ignored") {
    return "terminal";
  }
  if (status === "received" || status === "failed") {
    return "retry";
  }
  return "new";
}

export async function getBillingEventStatus(
  admin: SupabaseAdmin,
  eventId: string,
): Promise<BillingEventStatus | null> {
  const { data, error } = await admin
    .from("billing_events")
    .select("id, status")
    .eq("id", eventId)
    .maybeSingle<{ id: string; status: BillingEventStatus }>();

  if (error) {
    throw error;
  }

  return data?.status ?? null;
}

export async function recordBillingEvent(admin: SupabaseAdmin, event: StripeWebhookEvent) {
  const { error } = await admin.from("billing_events").insert({
    id: event.id,
    provider: "stripe",
    type: event.type,
    meta: event,
  });

  if (error) {
    if (error.code === "23505") {
      return { duplicate: true as const };
    }
    throw error;
  }

  return { duplicate: false as const };
}

export async function findUserIdBySubscription(
  admin: SupabaseAdmin,
  subscriptionId: string,
  customerId?: string | null,
) {
  const selectColumns =
    "user_id, plan, trial_started_at, trial_ends_at, source, provider, stripe_customer_id, stripe_subscription_id, pro_ends_at, billing_status, created_at, updated_at";
  const bySub = await admin
    .from("user_entitlements")
    .select(selectColumns)
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle<{ user_id: string }>();
  if (!bySub.error && bySub.data) {
    return bySub.data.user_id;
  }

  if (customerId) {
    const byCustomer = await admin
      .from("user_entitlements")
      .select(selectColumns)
      .eq("stripe_customer_id", customerId)
      .maybeSingle<{ user_id: string }>();
    if (!byCustomer.error && byCustomer.data) {
      return byCustomer.data.user_id;
    }
  }

  return null;
}
