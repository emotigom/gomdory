"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import WebsiteStudioPreviewFrame from "@/app/dashboard/websites/_components/WebsiteStudioPreviewFrame";
import WebsiteStudioShell from "@/app/dashboard/websites/_components/WebsiteStudioShell";
import { copyTextToClipboard, downloadTextFile, sanitizeExportFilename } from "@/lib/website-studio/websiteStudioExportClient";
import { getLocalWebsiteProject } from "@/lib/website-studio/websiteStudioLocalStore";
import { getWebsiteStudioReviewStatus, getWebsiteStudioSafetyReview } from "@/lib/website-studio/websiteStudioSafetyReview";

const LABELS = {
  ready: "공개 가능",
  blocked: "공개 불가",
  "needs-review": "확인 후 공개 가능",
  pass: "통과",
  warning: "확인 필요",
  blocker: "차단",
} as const;

const GROUP_LABELS: Record<string, string> = {
  requiredContent: "필수 내용",
  privacy: "개인정보와 안전",
  links: "링크와 태그",
  preview: "미리보기",
};
const websiteControlClass = "dashboard-websites-control rounded border border-slate-600 bg-slate-950/40 px-2 py-1 text-xs text-slate-100";
const websitePrimaryControlClass = "dashboard-websites-control rounded border border-cyan-300/50 bg-slate-950/40 px-3 py-1 text-sm text-cyan-50 disabled:opacity-60";
const websiteDangerLinkClass = "dashboard-websites-control dashboard-websites-danger-control mt-2 inline-block rounded border border-rose-300/50 px-3 py-1 text-sm text-rose-100";

export default function WebsiteStudioReviewClient({ siteId }: { siteId: string }) {
  const [hydrated, setHydrated] = useState(false);
  const [project, setProject] = useState<ReturnType<typeof getLocalWebsiteProject>>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ publicUrl: string; publishId: string; requestId?: string } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setProject(getLocalWebsiteProject(siteId));
  }, [siteId]);

  const review = useMemo(() => (project ? getWebsiteStudioSafetyReview(project) : null), [project]);
  const status = useMemo(() => (project ? getWebsiteStudioReviewStatus(project) : "blocked"), [project]);

  if (!hydrated) return <WebsiteStudioShell><p className="text-slate-200">초안 불러오는 중…</p></WebsiteStudioShell>;
  if (!project || !review) return <WebsiteStudioShell><p className="text-slate-200">초안을 찾을 수 없습니다.</p></WebsiteStudioShell>;

  const currentProject = project;
  const currentReview = review;

  const blockers = currentReview.checks.filter((c) => c.severity === "blocker" && !c.passed);
  const warnings = currentReview.checks.filter((c) => c.severity === "warning" && !c.passed);
  const passItems = currentReview.checks.filter((c) => c.passed);
  const privacyWarning = currentReview.checks.some((c) => c.id === "privacy" && !c.passed);
  const canPublish = blockers.length === 0 && (!privacyWarning || privacyConfirmed);
  const base = sanitizeExportFilename(currentProject.title, "gomdory-website");
  const statusLabel = status === "ready" ? "ready" : status === "blocked" ? "blocked" : "needs-review";
  const hasBoardHandoff = Boolean(project.originBoardId);
  const teacherGalleryHref = project.originBoardId ? `/edu/lesson/teacher?boardId=${encodeURIComponent(project.originBoardId)}` : null;

  const groupedChecks = Object.entries(GROUP_LABELS).map(([key, title]) => ({
    key,
    title,
    items: currentReview.checks.filter((c) => c.id === key),
  })).filter((g) => g.items.length > 0);

  async function onPublish() {
    if (!canPublish || publishing) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const response = await fetch("/api/website-studio/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          localSiteId: currentProject.id,
          title: currentProject.title,
          templateId: currentProject.templateId,
          snapshotVersion: 1,
          snapshot: { html: currentReview.snapshot.html, css: currentReview.snapshot.css, fullDocument: currentReview.snapshot.document },
          safetyStatus: statusLabel,
          safetySummary: { completionPercent: currentReview.completionPercent, checks: currentReview.checks },
          originBoardId: currentProject.originBoardId,
          originSource: currentProject.originSource,
          originDay: currentProject.originDay,
        }),
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; publicUrl?: string; publishId?: string; requestId?: string } | null;
      if (!response.ok || !json?.ok || !json.publicUrl || !json.publishId) throw new Error(json?.requestId ? `${json?.message ?? "공유 링크를 만들지 못했습니다."} (요청 ID: ${json.requestId})` : (json?.message ?? "공유 링크를 만들지 못했습니다."));
      setPublishResult({ publicUrl: json.publicUrl, publishId: json.publishId, requestId: json.requestId });
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "공유 링크를 만들지 못했습니다.");
    } finally {
      setPublishing(false);
    }
  }

  return <WebsiteStudioShell>
    <div className="space-y-4 text-slate-100">
      <header className="dashboard-websites-card rounded-xl border border-cyan-300/30 bg-slate-950/70 p-5 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">웹사이트 공개 전 점검</h1>
            <p className="mt-1 min-w-0 truncate text-sm text-slate-300">{currentProject.title} · 완성도 {currentReview.completionPercent}%</p>
            <Link href={`/dashboard/websites/${siteId}/edit`} className="dashboard-websites-control mt-2 inline-block rounded border border-transparent px-2 py-1 text-sm text-cyan-300">← 편집으로 돌아가기</Link>
          </div>
          <div className={`rounded-lg border px-3 py-2 text-sm font-semibold ${status === "blocked" ? "border-rose-300/50 text-rose-200" : "border-cyan-300/40 text-cyan-100"}`}>
            {status === "blocked" ? "차단 항목 해결 필요" : "공유 링크 만들기"}
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="dashboard-websites-card rounded-lg border border-cyan-300/30 bg-slate-900/60 p-3"><p className="text-xs text-slate-300">공개 상태</p><p className="text-lg font-semibold">{LABELS[status]}</p></article>
        <article className="dashboard-websites-card rounded-lg border border-rose-300/40 bg-slate-900/60 p-3"><p className="text-xs text-slate-300">차단 항목</p><p className="text-lg font-semibold text-rose-200">{blockers.length}개</p></article>
        <article className="dashboard-websites-card rounded-lg border border-amber-300/40 bg-slate-900/60 p-3"><p className="text-xs text-slate-300">확인 필요 항목</p><p className="text-lg font-semibold text-amber-200">{warnings.length}개</p></article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(420px,1fr)_minmax(360px,480px)] xl:items-start">
        <div className="space-y-4">
          <section className="dashboard-websites-card rounded-lg border border-rose-300/30 bg-slate-900/60 p-4">
            <h2 className="font-semibold">먼저 고쳐야 할 항목</h2>
            {blockers.length ? <ul className="mt-2 space-y-2 text-sm">{blockers.map((c) => <li key={c.id} className="dashboard-websites-row rounded border border-rose-300/30 bg-rose-900/20 p-2"><p className="font-medium">{c.label} · {LABELS.blocker}</p><p>{c.message}</p><p className="text-xs text-rose-100/80">{c.recommendation}</p></li>)}</ul> : <p className="mt-2 text-sm text-emerald-200">차단 항목이 없습니다.</p>}
          </section>

          <section className="dashboard-websites-card rounded-lg border border-cyan-300/30 bg-slate-900/60 p-4">
            <h2 className="font-semibold">확인하면 좋은 것</h2>
            <div className="mt-2 space-y-2 text-sm">
              {groupedChecks.map((group) => {
                const groupHasBlocker = group.items.some((c) => c.severity === "blocker" && !c.passed);
                const groupHasWarning = group.items.some((c) => c.severity === "warning" && !c.passed);
                const defaultOpen = groupHasBlocker || (!blockers.length && groupHasWarning);
                return <details key={group.key} open={defaultOpen} className="dashboard-websites-row rounded border border-slate-700/70 p-2">
                  <summary className="dashboard-websites-summary cursor-pointer rounded px-1 py-0.5 font-medium">{group.title}</summary>
                  <ul className="mt-2 space-y-2">
                    {group.items.map((c) => <li key={c.id} className="dashboard-websites-row rounded border border-slate-700 p-2"><p className="font-medium">{c.label} · {LABELS[c.passed ? "pass" : c.severity]}</p><p>{c.message}</p></li>)}
                  </ul>
                </details>;
              })}
              {passItems.length > 0 ? <details><summary className="dashboard-websites-summary cursor-pointer rounded px-1 py-0.5 text-slate-300">통과 항목 보기 ({passItems.length})</summary></details> : null}
            </div>
          </section>

          <section className="dashboard-websites-card rounded-lg border border-cyan-300/30 bg-slate-900/60 p-4">
            <h2 className="font-semibold">공유 링크 만들기</h2>
            <p className="text-xs text-slate-400">점검이 끝난 결과를 공유 링크로 저장합니다.</p>
            {hasBoardHandoff ? <p className="mt-2 text-xs text-indigo-700">공개하면 이 웹사이트가 수업 보드 작품 목록에 표시됩니다.</p> : null}
            {project.originDay ? <p className="text-xs text-slate-600">Day {project.originDay} 활동 작품으로 표시됩니다.</p> : null}
            {blockers.length > 0 ? <>
              <p className="mt-2 text-sm text-rose-300">먼저 차단 항목을 해결한 뒤 다시 점검해 주세요.</p>
              <Link href={`/dashboard/websites/${siteId}/edit`} className={websiteDangerLinkClass}>편집으로 돌아가기</Link>
            </> : null}
            {privacyWarning ? <label className="mt-2 flex min-w-0 items-center gap-2 text-sm"><input className="dashboard-websites-input h-4 w-4 rounded border border-slate-500" type="checkbox" checked={privacyConfirmed} onChange={(e) => setPrivacyConfirmed(e.target.checked)} /><span className="min-w-0 break-words">개인정보로 보일 수 있는 내용을 선생님과 확인했습니다.</span></label> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={!canPublish || publishing} onClick={() => void onPublish()} className={websitePrimaryControlClass}>{blockers.length > 0 ? "아직 공개할 수 없습니다" : publishing ? "공유 링크 생성 중..." : "공유 링크 만들기"}</button>
              {publishResult ? <button className={websiteControlClass} onClick={() => void copyTextToClipboard(`${window.location.origin}${publishResult.publicUrl}`)}>링크 복사</button> : null}
              {publishResult ? <a className={websiteControlClass} href={publishResult.publicUrl} target="_blank">공개 웹사이트 열기</a> : null}
              {publishResult && teacherGalleryHref ? <Link className={websiteControlClass} href={teacherGalleryHref}>선생님 작품 목록으로 이동</Link> : null}
            </div>
            {publishError ? <p className="mt-2 text-xs text-rose-300">{publishError}</p> : null}
            {publishResult && hasBoardHandoff ? <div className="mt-2 rounded border border-emerald-300/40 bg-emerald-900/20 p-2 text-xs text-emerald-100"><p className="font-semibold">공개 링크가 만들어졌습니다.</p><p>수업 보드에 제출되었습니다.</p><p>수업 보드 작품 목록에 제출되었습니다.</p><p>선생님 작품 목록으로 이동할 수 있습니다.</p>{publishResult.requestId ? <p className="text-emerald-200/90">요청 ID: {publishResult.requestId}</p> : null}</div> : null}
            {publishResult && !hasBoardHandoff ? <div className="mt-2 rounded border border-emerald-300/40 bg-emerald-900/20 p-2 text-xs text-emerald-100"><p className="font-semibold">공개 링크가 만들어졌습니다.</p>{publishResult.requestId ? <p className="text-emerald-200/90">요청 ID: {publishResult.requestId}</p> : null}</div> : null}
          </section>

          <details className="dashboard-websites-card rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <summary className="dashboard-websites-summary cursor-pointer rounded px-1 py-0.5 font-semibold">고급: HTML/CSS 내보내기</summary>
            <p className="mt-2 text-xs text-slate-400">수업 자료나 백업이 필요할 때만 사용하세요.</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs"><button className={websiteControlClass} onClick={() => void copyTextToClipboard(currentReview.snapshot.html)}>HTML 복사</button><button className={websiteControlClass} onClick={() => void copyTextToClipboard(currentReview.snapshot.css)}>CSS 복사</button><button className={websiteControlClass} onClick={() => void copyTextToClipboard(currentReview.snapshot.document)}>전체 문서 복사</button><button className={websiteControlClass} onClick={() => downloadTextFile(`${base || "gomdory-website"}.html`, currentReview.snapshot.document, "text/html")}>index.html 다운로드</button></div>
          </details>
        </div>

      <section className="dashboard-websites-preview max-w-full overflow-hidden rounded-lg border border-cyan-300/30 bg-slate-900/60 p-3 xl:sticky xl:top-4">
          <h2 className="mb-2 font-semibold">결과 미리보기</h2>
          <WebsiteStudioPreviewFrame srcDoc={currentReview.snapshot.document} />
        </section>
      </section>
    </div>
  </WebsiteStudioShell>;
}
