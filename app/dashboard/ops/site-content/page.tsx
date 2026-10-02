export const dynamic = "force-dynamic";

import OpsAccessDenied from "../OpsAccessDenied";
import SiteContentOpsClient from "./SiteContentOpsClient";
import { requireUser } from "@/lib/auth/requireUser";
import { isOpsAdmin } from "@/lib/auth/opsAdmin";
import { listSiteContent } from "@/lib/site-content/server";
import { parseSiteContentDeepLinkKey } from "@/lib/site-content/opsDeepLink";
import { routes } from "@/lib/standards/routes";

export default async function OpsSiteContentPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireUser(routes.page.dashboard.opsSiteContent());
  if (!isOpsAdmin(user.email)) {
    return <OpsAccessDenied email={user.email} requestedPath={routes.page.dashboard.opsSiteContent()} />;
  }

  const resolvedParams = (await searchParams) ?? {};
  const initialKey = parseSiteContentDeepLinkKey(typeof resolvedParams.key === "string" ? resolvedParams.key : null);
  const rows = await listSiteContent();

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ops · Site Content</p>
        <h1 className="text-2xl font-bold text-slate-900">Marketing 콘텐츠 편집</h1>
      </header>
      <SiteContentOpsClient initialContent={rows} initialKey={initialKey} />
    </main>
  );
}
