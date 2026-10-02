export const dynamic = "force-dynamic";

import OpsAccessDenied from "../OpsAccessDenied";
import OpsBannersClient from "./OpsBannersClient";
import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { routes } from "@/lib/standards/routes";

export default async function OpsBannersPage() {
  const { user } = await requireUser(routes.page.dashboard.opsBanners());
  if (!isOpsAdmin(user.email)) {
    return <OpsAccessDenied email={user.email} requestedPath={routes.page.dashboard.opsBanners()} />;
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("ops_banners" as never)
    .select("message, href, label, level, enabled, starts_at, ends_at" as never)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = (data ?? {}) as Record<string, unknown>;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ops · Banner</p>
        <h1 className="text-2xl font-bold text-slate-900">공지 바 설정</h1>
      </header>
      <OpsBannersClient
        initialBanner={{
          message: typeof row.message === "string" ? row.message : "",
          href: typeof row.href === "string" ? row.href : "",
          label: typeof row.label === "string" ? row.label : "",
          enabled: Boolean(row.enabled),
          level: typeof row.level === "string" ? row.level : "info",
          startsAt: typeof row.starts_at === "string" ? row.starts_at : "",
          endsAt: typeof row.ends_at === "string" ? row.ends_at : "",
        }}
      />
    </main>
  );
}
