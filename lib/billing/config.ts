import "server-only";

export type StripeBillingConfig = {
  provider: "stripe";
  enabled: boolean;
  secretKey?: string;
  webhookSecret?: string;
  priceMonthly?: string;
  priceYearly?: string;
  successUrl?: string;
  cancelUrl?: string;
  portalReturnUrl?: string;
};

export function getStripeBillingConfig(env: Record<string, string | undefined> = process.env): StripeBillingConfig {
  return {
    provider: "stripe",
    enabled: env.NEXT_PUBLIC_BILLING_ENABLED === "1" && env.NEXT_PUBLIC_BILLING_PROVIDER === "stripe",
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    priceMonthly: env.STRIPE_PRICE_ID_PRO_MONTHLY,
    priceYearly: env.STRIPE_PRICE_ID_PRO_YEARLY,
    successUrl: env.BILLING_SUCCESS_URL,
    cancelUrl: env.BILLING_CANCEL_URL,
    portalReturnUrl: env.BILLING_PORTAL_RETURN_URL,
  };
}

export function requireStripeBillingConfig(
  env: Record<string, string | undefined> = process.env,
  options?: { requireWebhook?: boolean },
): Required<StripeBillingConfig> {
  const config = getStripeBillingConfig(env);
  const required: Array<[string, unknown]> = [
    ["STRIPE_SECRET_KEY", config.secretKey],
    ["BILLING_SUCCESS_URL", config.successUrl],
    ["BILLING_CANCEL_URL", config.cancelUrl],
    ["BILLING_PORTAL_RETURN_URL", config.portalReturnUrl],
  ];
  if (options?.requireWebhook ?? true) {
    required.push(["STRIPE_WEBHOOK_SECRET", config.webhookSecret]);
  }
  const missing = required.filter(([, value]) => !value).map(([key]) => key);

  if (!config.enabled || missing.length > 0) {
    const message = !config.enabled ? "billing_disabled" : `missing_env_${missing.join("_")}`;
    throw new Error(message);
  }

  return config as Required<StripeBillingConfig>;
}
