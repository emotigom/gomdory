export const dynamic = "force-dynamic";

import Link from "next/link";

import OpsDetailPanel from "./_components/OpsDetailPanel";
import { OPS_ADMIN_MODULES } from "@/lib/ops/adminModules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function getSnapshot() {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [reports, pendingOwnership, uiErrors] = await Promise.all([
    admin.from("reports").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin.from("ownership_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("ops_events").select("id", { count: "exact", head: true }).eq("kind", "ui_error").gte("ts", since),
  ]);

  return {
    reports24h: reports.count ?? 0,
    pendingOwnership: pendingOwnership.count ?? 0,
    uiErrors24h: uiErrors.count ?? 0,
  };
}

export default async function OpsDashboardPage() {
  const snapshot = await getSnapshot();

  return (
    <main className="space-y-4">
      <OpsDetailPanel title="운영자 빠른 실행">
        <div className="grid gap-3 md:grid-cols-3">
          <Link href="/dashboard/ops/reports" className="dashboard-ops-card block rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">최근 24시간 신고</p>
            <p className="text-2xl font-bold text-slate-900">{snapshot.reports24h}</p>
            <p className="mt-1 text-xs text-slate-600">즉시 모더레이션</p>
          </Link>
          <Link href="/dashboard/ops/content?status=hidden" className="dashboard-ops-card block rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">UI 에러(24h)</p>
            <p className="text-2xl font-bold text-slate-900">{snapshot.uiErrors24h}</p>
            <p className="mt-1 text-xs text-slate-600">문제 재현 추적</p>
          </Link>
          <Link href="/dashboard/ops/system-jobs" className="dashboard-ops-card block rounded-xl border border-slate-200 p-3">
            <p className="text-xs text-slate-500">소유권 요청 대기</p>
            <p className="text-2xl font-bold text-slate-900">{snapshot.pendingOwnership}</p>
            <p className="mt-1 text-xs text-slate-600">승인 작업 처리</p>
          </Link>
        </div>
      </OpsDetailPanel>

      <OpsDetailPanel title="모듈 레지스트리">
        <div className="grid gap-3 md:grid-cols-2">
          {OPS_ADMIN_MODULES.map((module) => (
            <Link key={module.key} href={module.href} className="dashboard-ops-card block rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{module.title}</p>
              <p className="text-xs text-slate-600">{module.description}</p>
            </Link>
          ))}
        </div>
      </OpsDetailPanel>
    </main>
  );
}
