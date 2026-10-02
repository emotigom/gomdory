export const dynamic = "force-dynamic";

import OpsAccessDenied from "../OpsAccessDenied";

import { HomepageStyleClient } from "./HomepageStyleClient";
import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { routes } from "@/lib/standards/routes";

export default async function OpsHomepageStylePage() {
  const { user } = await requireUser(routes.page.dashboard.opsHomepageStyle());
  if (!isOpsAdmin(user.email)) {
    return <OpsAccessDenied email={user.email} requestedPath={routes.page.dashboard.opsHomepageStyle()} />;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8" data-page-marker="dashboard-ops-homepage-style">
      <header className="space-y-2">
        <p className="text-xs font-semibold text-slate-500">Ops · 홈페이지 스타일</p>
        <h1 className="text-2xl font-bold text-slate-900">메인 페이지 스타일 시스템</h1>
        <p className="text-sm text-slate-600">
          GOMDORY / GKRRY 메인 페이지를 워드프레스 테마처럼 빠르게 변경할 수 있는 가벼운 편집기입니다.
        </p>
      </header>

      <HomepageStyleClient />
    </main>
  );
}
