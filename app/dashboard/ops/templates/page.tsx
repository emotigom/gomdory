export const dynamic = "force-dynamic";

import OpsAccessDenied from "../OpsAccessDenied";

import { OpsTemplatesClient } from "./OpsTemplatesClient";
import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function OpsTemplatesPage() {
  const { user } = await requireUser("/dashboard/ops/templates");
  if (!isOpsAdmin(user.email)) {
    return <OpsAccessDenied email={user.email} requestedPath="/dashboard/ops/templates" />;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("templates")
    .select("template_id, title, visibility, pro_only, picks_rank, stats, moderation")
    .order("created_at", { ascending: false })
    .limit(100);

  const templates =
    data?.map((row) => {
      const moderation = (row.moderation as Record<string, unknown> | null | undefined) ?? {};
      const stats = (row.stats as Record<string, unknown> | null | undefined) ?? {};
      return {
        id: row.template_id as string,
        title: row.title as string,
        visibility: (row.visibility as "public" | "unlisted" | "hidden") ?? "public",
        proOnly: Boolean(row.pro_only),
        picksRank: (row.picks_rank as number | null) ?? null,
        reports: Number(moderation.reportCount ?? stats.reports ?? 0),
      };
    }) ?? [];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8" data-page-marker="dashboard-ops-templates">
      <header className="space-y-2">
        <p className="text-xs font-semibold text-slate-500">Ops · Templates</p>
        <h1 className="text-2xl font-bold text-slate-900">템플릿 상태 관리</h1>
        <p className="text-sm text-slate-600">신고 누적 여부를 확인하고 가시성·Pro 설정을 조정합니다.</p>
      </header>

      <OpsTemplatesClient templates={templates} />
    </main>
  );
}
