export const dynamic = "force-dynamic";

import OpsAccessDenied from "../OpsAccessDenied";
import WorkQueueClient from "./workQueueClient";

import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { routes } from "@/lib/standards/routes";

export default async function OpsWorkQueuePage() {
  const { user } = await requireUser(routes.page.dashboard.opsWorkQueue());
  if (!isOpsAdmin(user.email)) {
    return <OpsAccessDenied email={user.email} requestedPath={routes.page.dashboard.opsWorkQueue()} />;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8" data-page-marker="ops-work-queue">
      <header>
        <p className="text-sm text-slate-500">운영 · 작업 큐</p>
        <h1 className="text-2xl font-semibold">Broken Links Work Queue</h1>
        <p className="text-sm text-slate-500">선택한 pair를 기반으로 작업 큐를 미리보기/다운로드합니다.</p>
      </header>
      <WorkQueueClient apiBaseUrl={routes.api.ops.notFoundWorkQueue()} />
    </main>
  );
}
