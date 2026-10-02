export const dynamic = "force-dynamic";

import Link from "next/link";
import { headers } from "next/headers";

import OpsAccessDenied from "./OpsAccessDenied";
import OpsShellLayout from "./_components/OpsShellLayout";
import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { findOpsModuleByHref } from "@/lib/ops/adminModules";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser("/dashboard/ops");
  if (!isOpsAdmin(user.email)) {
    return <OpsAccessDenied email={user.email} requestedPath="/dashboard/ops" />;
  }

  const headerList = await headers();
  const currentPath = headerList.get("x-pathname") ?? "/dashboard/ops";
  const activeModule = findOpsModuleByHref(currentPath);

  return (
    <div className="min-h-screen bg-slate-50" data-dashboard-ops-scope>
      <header className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-500">운영자 전용</p>
            <p className="text-sm font-bold text-slate-900">{activeModule?.title ?? "Ops Dashboard"}</p>
          </div>
          <form action="/dashboard/ops/users" className="flex items-center gap-2">
            <input
              name="q"
              placeholder="전역 검색: 사용자 이메일"
              className="dashboard-ops-input w-64 max-w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button className="dashboard-ops-control rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              검색
            </button>
          </form>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard" className="dashboard-ops-control rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700">
              대시보드
            </Link>
          </div>
        </div>
      </header>
      <OpsShellLayout currentPath={currentPath} currentUserEmail={user.email}>
        {children}
      </OpsShellLayout>
    </div>
  );
}
