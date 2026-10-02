import type { Metadata } from "next";
import EduViewActions from "./_components/EduViewActions";
import PresentViewer from "./_components/PresentViewer";
import { readEduviewOrigin } from "@/lib/env/appConfig";
import { ensureEduGalleryEntryForSlug } from "@/lib/edu/gallerySync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type EduViewPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ present?: string }>;
};

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EduViewPage({ params, searchParams }: EduViewPageProps) {
  const { slug } = await params;
  const { present } = (await searchParams) ?? {};
  const isPresentMode = present === "1";
  const publicOrigin = readEduviewOrigin();
  const isDevFallback = process.env.NODE_ENV !== "production" && !process.env["NEXT_PUBLIC_EDUVIEW_ORIGIN"];
  const rawUrl = isDevFallback ? `/edu/raw/${slug}/` : `${publicOrigin}/v1/${slug}/`;
  const shareUrl = `https://www.gomdory.com/edu/view/${slug}/`;
  const supabase = createSupabaseAdminClient();
  try {
    await ensureEduGalleryEntryForSlug(slug);
  } catch {
    // ignore lazy sync errors
  }
  const { data: visibility } = await supabase
    .from("edu_project_visibility")
    .select("hidden, hidden_reason")
    .eq("slug", slug)
    .maybeSingle();
  const isHidden = Boolean(visibility?.hidden);

  if (isPresentMode) {
    return (
      <PresentViewer
        slug={slug}
        rawUrl={rawUrl}
        isHidden={isHidden}
        hiddenReason={visibility?.hidden_reason}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">Student Site</p>
        <h1 className="text-2xl font-semibold text-slate-900">Preview</h1>
        <p className="text-sm text-slate-600">
          This view keeps student content isolated from the main site while still letting you share the
          project safely.
        </p>
      </div>

      {isHidden ? (
        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          <p className="text-base font-semibold">숨김 처리됨</p>
          <p className="mt-2 text-xs text-rose-600">선생님 또는 운영진이 이 작품을 숨김 처리했어요.</p>
          {visibility?.hidden_reason ? (
            <p className="mt-3 text-xs text-rose-700">사유: {visibility.hidden_reason}</p>
          ) : null}
        </section>
      ) : (
        <>
          <EduViewActions shareUrl={shareUrl} rawUrl={rawUrl} slug={slug} />
          <iframe
            title={`Student site ${slug}`}
            src={rawUrl}
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            referrerPolicy="no-referrer"
            className="h-[75vh] w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
          />
        </>
      )}
    </div>
  );
}
