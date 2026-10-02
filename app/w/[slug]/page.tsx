import { notFound } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasUnsafeSnapshotContent } from "@/lib/website-studio/websiteStudioPublish";

export default async function WebsitePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("website_studio_published_snapshots")
    .select("full_document,status,title")
    .eq("slug", slug)
    .maybeSingle();

  const published = data as { full_document: string; status: string; title: string } | null;
  if (!published || published.status !== "published" || hasUnsafeSnapshotContent(published.full_document)) notFound();

  return <main className="mx-auto max-w-5xl p-4"><iframe title={published.title} sandbox="allow-same-origin" className="h-[75vh] w-full rounded border" srcDoc={published.full_document} /><p className="mt-3 text-center text-xs text-slate-500">곰도리 웹사이트 스튜디오로 만든 작품</p></main>;
}
