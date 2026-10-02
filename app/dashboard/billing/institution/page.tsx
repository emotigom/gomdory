export const dynamic = "force-dynamic";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";

import InstitutionPageClient from "./InstitutionPageClient";

export default async function InstitutionBillingPage() {
  const { user } = await requireUser("/dashboard/billing/institution");
  const opsAdmin = isOpsAdmin(user.email);

  return (
    <main
      className="hud-page-shell mx-auto min-h-[calc(100vh-72px)] w-full max-w-7xl px-4 pb-16 pt-6 text-[var(--theme-text)] sm:px-6 sm:pt-9 lg:px-8"
      data-dashboard-billing-scope
      data-page-marker="dashboard-billing-institution"
      data-dashboard-institution-workshop="adoption-desk"
      data-dashboard-workshop-version="2"
      data-hud-theme-surface="institution-adoption-desk"
    >
      <InstitutionPageClient opsAdmin={opsAdmin} />
    </main>
  );
}
