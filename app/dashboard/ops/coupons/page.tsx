export const dynamic = "force-dynamic";

import OpsAccessDenied from "../OpsAccessDenied";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import CouponsClient from "./CouponsClient";

export default async function OpsCouponsPage() {
  const { user } = await requireUser("/dashboard/ops/coupons");
  if (!isOpsAdmin(user.email)) {
    return <OpsAccessDenied email={user.email} requestedPath="/dashboard/ops/coupons" />;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-6" data-page-marker="ops-coupons">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">Ops · Coupons</p>
          <h1 className="text-2xl font-bold text-slate-900">쿠폰 발행 & 관리</h1>
        </div>
        <p className="text-sm font-semibold text-slate-600">{user.email}</p>
      </header>

      <CouponsClient />
    </main>
  );
}
