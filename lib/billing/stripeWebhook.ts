import "server-only";

import type { UserEntitlementRow } from "@/lib/billing/entitlements";
import type { StripeSubscription } from "@/lib/billing/stripeClient";

type StripeSignatureParts = {
  timestamp: string;
  signatures: string[];
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: { object: unknown };
};

export type StripeBillingStatus = UserEntitlementRow["billing_status"];

export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

type StripeSignatureVerificationOptions = {
  toleranceSeconds?: number;
  /** Current Unix time in seconds, or a provider returning it. */
  now?: number | (() => number);
};

function parseSignatureHeader(header: string | null): StripeSignatureParts {
  if (!header) {
    throw new Error("missing_signature");
  }

  const parts = header.split(",").map((part) => part.trim());
  let timestamp = "";
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") {
      timestamp = value ?? "";
    } else if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    throw new Error("invalid_signature_header");
  }

  return { timestamp, signatures };
}

async function hmacSha256(secret: string, payload: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return new Uint8Array(signature);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signStripePayload(secret: string, payload: string): Promise<string> {
  return toHex(await hmacSha256(secret, payload));
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  options: StripeSignatureVerificationOptions = {},
): Promise<{ timestamp: number }> {
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  if (!/^\d+$/.test(timestamp)) {
    throw new Error("invalid_timestamp");
  }

  const parsedTs = Number(timestamp);
  if (!Number.isSafeInteger(parsedTs) || parsedTs <= 0) {
    throw new Error("invalid_timestamp");
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await signStripePayload(webhookSecret, signedPayload);

  const valid = signatures.some((sig) => timingSafeEqualHex(sig, expected));
  if (!valid) {
    throw new Error("signature_mismatch");
  }

  const toleranceSeconds = options.toleranceSeconds ?? STRIPE_SIGNATURE_TOLERANCE_SECONDS;
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds <= 0) {
    throw new Error("invalid_tolerance");
  }

  const suppliedNow = typeof options.now === "function" ? options.now() : options.now;
  const now = suppliedNow ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(now)) {
    throw new Error("invalid_current_timestamp");
  }

  if (Math.abs(now - parsedTs) > toleranceSeconds) {
    throw new Error("timestamp_outside_tolerance");
  }

  return { timestamp: parsedTs };
}

export function mapStripeSubscriptionStatus(status: string): StripeBillingStatus {
  switch (status) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return "free";
  }
}

function validFuturePeriodEnd(currentPeriodEnd: number | null | undefined, nowSeconds: number): number | null {
  if (
    typeof currentPeriodEnd !== "number" ||
    !Number.isSafeInteger(currentPeriodEnd) ||
    !Number.isFinite(nowSeconds) ||
    currentPeriodEnd <= nowSeconds ||
    !Number.isFinite(new Date(currentPeriodEnd * 1000).getTime())
  ) {
    return null;
  }

  return currentPeriodEnd;
}

export function isStripeSubscriptionProvisionable(
  status: string,
  currentPeriodEnd?: number | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  return (
    (status === "active" || status === "trialing") &&
    validFuturePeriodEnd(currentPeriodEnd, nowSeconds) !== null
  );
}

export function buildPendingCheckoutEntitlement(input: {
  subscriptionId: string | null;
  customerId: string | null;
}): Partial<UserEntitlementRow> {
  return {
    plan: "free",
    provider: "stripe",
    billing_status: "free",
    stripe_subscription_id: input.subscriptionId,
    stripe_customer_id: input.customerId,
    pro_ends_at: null,
    source: "stripe_pending",
  };
}

export function buildEntitlementUpdateFromSubscription(
  subscription: StripeSubscription,
  now = new Date(),
): Partial<UserEntitlementRow> {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const currentPeriodEnd = validFuturePeriodEnd(subscription.current_period_end, nowSeconds);
  const provisionable = isStripeSubscriptionProvisionable(
    subscription.status,
    subscription.current_period_end,
    nowSeconds,
  );
  const missingProvisioningWindow =
    (subscription.status === "active" || subscription.status === "trialing") && !provisionable;
  const billingStatus = missingProvisioningWindow
    ? "free"
    : mapStripeSubscriptionStatus(subscription.status);
  const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null;

  return {
    plan: provisionable ? "pro" : "free",
    provider: "stripe",
    billing_status: billingStatus,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: String(subscription.customer),
    pro_ends_at: periodEnd,
    source: missingProvisioningWindow ? "stripe_pending" : "stripe",
  };
}
