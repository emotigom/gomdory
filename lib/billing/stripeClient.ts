import "server-only";

type StripeRequestInit = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: URLSearchParams | string;
};

export type StripeCheckoutSessionParams = {
  mode: "subscription";
  priceId: string;
  customerEmail?: string | null;
  customerId?: string | null;
  metadata?: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
};

type StripeBillingPortalParams = {
  customerId: string;
  returnUrl: string;
};

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
};

const STRIPE_API_BASE = "https://api.stripe.com";

// Keep this aligned with StripeSubscription above. Newer Billing API versions
// move billing-period fields onto subscription items, while this GA version
// returns current_period_end on the subscription itself.
export const STRIPE_API_VERSION = "2024-10-28.acacia";

export function buildStripeRequestHeaders(
  secretKey: string,
  headers: Record<string, string> = {},
): Record<string, string> {
  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "gomdori/stripe-fetch",
    ...headers,
    "Stripe-Version": STRIPE_API_VERSION,
  };
}

function resolveStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("stripe_not_configured");
  }
  return key;
}

async function parseStripeResponse(response: Response) {
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    if (!response.ok) {
      const message = typeof json?.error?.message === "string" ? json.error.message : "stripe_request_failed";
      throw new Error(message);
    }
    return json;
  } catch (error) {
    if (error instanceof Error && error.message === "stripe_request_failed") {
      throw error;
    }
    if (!response.ok) {
      throw new Error("stripe_request_failed");
    }
    throw new Error("stripe_invalid_response");
  }
}

export async function stripeRequest(path: string, init?: StripeRequestInit) {
  const secretKey = resolveStripeSecretKey();
  const url =
    path.startsWith("http") || path.startsWith("https")
      ? path
      : `${STRIPE_API_BASE}${path.startsWith("/v1/") ? path : `/v1/${path.replace(/^\//, "")}`}`;

  const response = await fetch(url, {
    method: init?.method ?? "GET",
    headers: buildStripeRequestHeaders(secretKey, init?.headers),
    body: init?.body,
  });

  return parseStripeResponse(response);
}

export function buildCheckoutForm(params: StripeCheckoutSessionParams): URLSearchParams {
  const form = new URLSearchParams();
  form.append("mode", params.mode);
  form.append("success_url", params.successUrl);
  form.append("cancel_url", params.cancelUrl);
  form.append("line_items[0][price]", params.priceId);
  form.append("line_items[0][quantity]", "1");

  if (params.customerId) {
    form.append("customer", params.customerId);
  } else if (params.customerEmail) {
    form.append("customer_email", params.customerEmail);
  }

  const metadataEntries = Object.entries(params.metadata ?? {});
  for (const [key, value] of metadataEntries) {
    form.append(`metadata[${key}]`, value);
    form.append(`subscription_data[metadata][${key}]`, value);
  }

  return form;
}

export async function createCheckoutSession(params: StripeCheckoutSessionParams) {
  const body = buildCheckoutForm(params);
  return stripeRequest("/v1/checkout/sessions", { method: "POST", body });
}

export async function createBillingPortalSession(params: StripeBillingPortalParams) {
  const body = new URLSearchParams();
  body.append("customer", params.customerId);
  body.append("return_url", params.returnUrl);
  return stripeRequest("/v1/billing_portal/sessions", { method: "POST", body });
}

export async function retrieveSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest(`/v1/subscriptions/${subscriptionId}`);
}
