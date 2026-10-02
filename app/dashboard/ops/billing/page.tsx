export const dynamic = "force-dynamic";

import OpsAccessDenied from "../OpsAccessDenied";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import OpsBillingClient, { type UpgradeRequestItem } from "./OpsBillingClient";

export default async function OpsBillingPage() {
  const { user } = await requireUser("/dashboard/ops/billing");
  if (!isOpsAdmin(user.email)) {
    return <OpsAccessDenied email={user.email} requestedPath="/dashboard/ops/billing" />;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("upgrade_requests")
    .select("request_id, created_at, user_id, org_name, contact_email, seats, message, status, meta")
    .order("created_at", { ascending: false })
    .limit(200);

  const requests: UpgradeRequestItem[] =
    data?.map((row) => ({
      id: row.request_id,
      createdAt: row.created_at,
      userId: row.user_id,
      orgName: row.org_name,
      contactEmail: row.contact_email,
      seats: row.seats,
      message: row.message,
      status: row.status,
    })) ?? [];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-6" data-page-marker="ops-billing">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">Ops · Billing</p>
          <h1 className="text-2xl font-bold text-slate-900">업그레이드 요청 & 플랜</h1>
        </div>
        <p className="text-sm font-semibold text-slate-600">{user.email}</p>
      </header>

      <OpsBillingClient initialRequests={requests} />
    </main>
  );
}
