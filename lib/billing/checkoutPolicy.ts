export type BillingInterval = "month" | "year";

type StripePriceConfig = {
  priceMonthly?: string;
  priceYearly?: string;
};

const DASHBOARD_ROOT = "/dashboard";

export function resolveStripePriceId(
  interval: BillingInterval,
  config: StripePriceConfig,
): string | null {
  const priceId = interval === "year" ? config.priceYearly : config.priceMonthly;
  return priceId?.trim() || null;
}

export function resolveCheckoutSuccessUrl(
  returnTo: string | undefined,
  configuredSuccessUrl: string,
): string {
  if (!returnTo) {
    return configuredSuccessUrl;
  }

  try {
    const configured = new URL(configuredSuccessUrl);
    const candidate = new URL(returnTo, configured);
    const isDashboardPath =
      candidate.pathname === DASHBOARD_ROOT || candidate.pathname.startsWith(`${DASHBOARD_ROOT}/`);

    if (
      candidate.origin !== configured.origin ||
      candidate.username !== "" ||
      candidate.password !== "" ||
      !isDashboardPath
    ) {
      return configuredSuccessUrl;
    }

    return candidate.toString();
  } catch {
    return configuredSuccessUrl;
  }
}
