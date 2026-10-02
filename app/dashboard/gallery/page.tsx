export const dynamic = "force-dynamic";

import GalleryClient from "./GalleryClient";
import { requireUser } from "@/lib/auth/requireUser";

type SearchParams = Record<string, string | string[] | undefined>;

function parseFlag(searchParams: SearchParams | undefined, key: string): boolean {
  const raw = searchParams?.[key];
  if (Array.isArray(raw)) {
    return raw.includes("1") || raw.includes("true");
  }
  return raw === "1" || raw === "true";
}

export default async function DashboardGalleryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser("/dashboard/gallery");

  const resolvedSearchParams = (await searchParams) ?? {};
  const tvMode = parseFlag(resolvedSearchParams, "tv");
  const demoMode = parseFlag(resolvedSearchParams, "demo");

  return (
    <div
      data-dashboard-gallery-workshop="2"
      data-page-marker="dashboard-gallery"
      className="min-h-[calc(100vh-72px)] bg-[var(--theme-bg)] text-[var(--theme-text)]"
    >
      <GalleryClient tvMode={tvMode} demoMode={demoMode} />
    </div>
  );
}
