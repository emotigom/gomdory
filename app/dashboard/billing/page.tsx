export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/requireUser";
import { resolveEffectiveStorageQuota } from "@/lib/data/effectiveStorageQuota.server";
import { getStoragePlanLimits, getStorageUsageSnapshot } from "@/lib/data/storageUsage.server";
import { routes } from "@/lib/standards/routes";
import type { UserPlan } from "@/lib/types/billing";

import BillingPageClient from "./BillingPageClient";

export default async function BillingPage() {
  const { user } = await requireUser(routes.page.dashboard.billing());
  const [effectiveQuota, usage] = await Promise.all([
    resolveEffectiveStorageQuota(user.id),
    getStorageUsageSnapshot(user.id),
  ]);
  const plan = {
    plan: effectiveQuota.plan.plan,
    expiresAt: effectiveQuota.plan.expiresAt,
    isPro: effectiveQuota.plan.plan === "pro",
  } satisfies UserPlan;
  const planLimits = getStoragePlanLimits();
  const limits = plan.isPro
    ? { ...planLimits, proLimitBytes: effectiveQuota.quotaBytes }
    : { ...planLimits, freeLimitBytes: effectiveQuota.quotaBytes };
  const proEnabled = process.env.NEXT_PUBLIC_PRO_ENABLED === "1";

  return (
    <main
      className="mx-auto min-h-[calc(100vh-72px)] max-w-6xl bg-[var(--theme-bg)] px-4 pb-20 pt-6 text-[var(--theme-text)] sm:px-6 sm:pt-8 lg:px-10"
      data-dashboard-billing-scope
      data-page-marker="dashboard-billing"
    >
      <BillingPageClient
        plan={plan}
        usage={usage}
        limits={limits}
        proEnabled={proEnabled}
        userEmail={user.email ?? ""}
      />
    </main>
  );
}
