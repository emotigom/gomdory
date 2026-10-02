"use client";

import Link from "next/link";
import { CANONICAL_BASE_URL } from "@/lib/http/siteConfig";
import WebsiteStudioQrCode from "@/app/dashboard/websites/_components/WebsiteStudioQrCode";

type PublishedSite = { id: string; title: string; slug: string; templateId: string; originDay: string | null; publishedAt: string | null; updatedAt: string; safetyStatus: "ready" | "needs-review" };

export default function ShowcaseClient({ boardId, publishedSites }: { boardId: string; publishedSites: PublishedSite[] }) {
  const urls = publishedSites.map((site) => `${CANONICAL_BASE_URL}/w/${site.slug}`);
  const copyAll = async () => navigator.clipboard.writeText(urls.join("\n"));
  const dayLabel = (originDay: string | null) => {
    const n = Number(originDay);
    if (!Number.isFinite(n) || n < 1) return "기타 웹사이트";
    return `Day ${Math.floor(n)}`;
  };

  return <main className="p-6 space-y-4" data-website-studio-showcase="board-published-sites"><div className="flex flex-wrap gap-2"><Link href={`/edu/lesson/teacher?boardId=${encodeURIComponent(boardId)}`} className="rounded border px-3 py-1.5 text-xs">교사 페이지로 돌아가기</Link><button type="button" onClick={copyAll} className="rounded border px-3 py-1.5 text-xs">작품 목록 복사</button><button type="button" onClick={() => window.print()} className="rounded border px-3 py-1.5 text-xs">인쇄용 보기</button></div>{publishedSites.length === 0 ? <section className="rounded-md border border-dashed p-4 text-sm text-slate-600"><p>아직 공개된 학생 웹사이트가 없습니다.</p><Link href={`/dashboard/websites/new?boardId=${encodeURIComponent(boardId)}&source=edu-course`} className="mt-2 inline-flex rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">웹사이트 스튜디오 열기</Link></section> : <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{publishedSites.map((site) => {const url = `${CANONICAL_BASE_URL}/w/${site.slug}`; return <article key={site.id} className="rounded-md border p-3 text-sm"><p className="font-semibold">{site.title}</p><p className="text-xs text-slate-500">{dayLabel(site.originDay)} · 템플릿 {site.templateId}</p><div className="mt-2"><WebsiteStudioQrCode url={url} label={`${site.slug} qr`} size={132} /></div><p className="mt-2 break-all text-xs text-slate-600">{url}</p><div className="mt-2 flex gap-2"><Link href={`/w/${site.slug}`} target="_blank" className="rounded border px-2 py-1 text-xs">열기</Link><button type="button" onClick={() => navigator.clipboard.writeText(url)} className="rounded border px-2 py-1 text-xs">링크 복사</button></div></article>;})}</section>}</main>;
}
