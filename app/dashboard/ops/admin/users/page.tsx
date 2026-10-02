export const dynamic = "force-dynamic";

import Link from "next/link";
import OpsAccessDenied from "../../OpsAccessDenied";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import UsersClient from "../../users/UsersClient";

export default async function OpsAdminUsersPage() {
  const { user } = await requireUser("/dashboard/ops/admin/users");
  if (!isOpsAdmin(user.email)) {
    return <OpsAccessDenied email={user.email} requestedPath="/dashboard/ops/admin/users" />;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-6" data-page-marker="ops-users">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">Ops · Users</p>
          <h1 className="text-2xl font-bold text-slate-900">사용자 관리</h1>
          <p className="mt-1 text-sm text-slate-600">사용자별 Edu Feature Flags를 운영 화면에서 안전하게 관리합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-slate-600">{user.email}</p>
          <Link
            href="/dashboard/ops"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            Ops 홈
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            대시보드
          </Link>
        </div>
      </header>

      <UsersClient currentUserId={user.id} />
    </main>
  );
}
