"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WEBSITE_STUDIO_TEMPLATES } from "@/lib/website-studio/websiteStudioTemplates";
import { createLocalWebsiteProjectFromTemplate, listLocalWebsiteProjects, saveLocalWebsiteProject, deleteLocalWebsiteProject } from "@/lib/website-studio/websiteStudioLocalStore";
import { getWebsiteStudioCompletionPercent, getWebsiteStudioNextStep } from "@/lib/website-studio/websiteStudioCompletion";
import WebsiteStudioShell from "@/app/dashboard/websites/_components/WebsiteStudioShell";

const websiteControlClass = "dashboard-websites-control rounded-lg border border-slate-400/70 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-100";
const websitePrimaryControlClass = "dashboard-websites-control rounded-lg border border-cyan-300/70 bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950";
const websiteDangerControlClass = "dashboard-websites-control dashboard-websites-danger-control rounded-lg border border-rose-400/65 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-rose-100";

export default function WebsiteStudioStarterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const boardId = searchParams.get("boardId") ?? undefined;
  const source = searchParams.get("source") ?? undefined;
  const day = searchParams.get("day") ?? undefined;
  const [mounted, setMounted] = useState(false);
  const [drafts, setDrafts] = useState<ReturnType<typeof listLocalWebsiteProjects>>([]);

  useEffect(() => {
    setMounted(true);
    setDrafts(listLocalWebsiteProjects());
  }, []);

  const hasCourseContext = source === "edu-course" || Boolean(boardId);
  const sourceHint = useMemo(
    () =>
      hasCourseContext
        ? `AI 수업 코스에서 연결되었습니다. ${day ? `Day ${day} 활동과 연결되어 있습니다.` : ""}`
        : null,
    [day, hasCourseContext],
  );

  return (
    <WebsiteStudioShell>
      <div className="mx-auto w-full max-w-[1240px] space-y-6" data-website-starter-hub="glass-layout">
        <header className="rounded-3xl border border-cyan-300/35 bg-slate-900/70 p-6 shadow-[0_0_36px_rgba(34,211,238,0.2)] backdrop-blur-sm sm:p-8">
          <h1 className="text-3xl font-semibold text-white">AI 웹사이트 스튜디오</h1>
          <p className="mt-2 text-sm text-slate-100 sm:text-base">이어서 만들기 &gt; 새로 시작하기 &gt; 완성 점검까지 한 번에 진행하세요.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-cyan-100">
            <span className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-3 py-1">로컬 초안</span>
            <span className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-3 py-1">블록 편집</span>
            <span className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-3 py-1">배포 전 점검</span>
          </div>
        </header>

        {sourceHint ? (
          <section className="rounded-2xl border border-indigo-300/35 bg-indigo-500/15 p-4 text-sm text-indigo-100 backdrop-blur-sm">
            <h2 className="font-semibold">AI 수업 코스에서 연결되었습니다.</h2>
            <p className="mt-1">템플릿을 선택하면 이 보드와 연결된 로컬 초안이 만들어집니다.</p>
            {day ? <p className="mt-1 text-indigo-200/90">{sourceHint}</p> : null}
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-white">이어서 만들기</h2>
          <p className="text-sm text-slate-200">저장된 초안에서 계속 작업합니다.</p>
          {!mounted ? (
            <p className="dashboard-websites-empty-state rounded-2xl border border-cyan-300/20 bg-slate-900/60 p-4 text-sm text-slate-200">초안 불러오는 중…</p>
          ) : drafts.length === 0 ? (
            <article className="dashboard-websites-empty-state rounded-2xl border border-cyan-300/25 bg-slate-900/60 p-5 text-sm text-slate-100">
              <p className="font-semibold">아직 이어서 만들 초안이 없습니다.</p>
              <p className="mt-1 text-slate-300">아래 템플릿을 골라 첫 웹사이트를 시작하세요.</p>
            </article>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {drafts.map((d) => (
                <article key={d.id} className="dashboard-websites-card rounded-2xl border border-amber-300/35 bg-slate-900/75 p-5 shadow-[0_0_24px_rgba(251,191,36,0.14)]">
                  <h3 className="min-w-0 truncate font-semibold text-white">{d.title}</h3>
                  <p className="mt-1 min-w-0 break-words text-xs text-slate-300">{d.templateId} · {d.updatedAt}</p>
                  <p className="mt-2 text-sm font-semibold text-amber-100">완성도 {getWebsiteStudioCompletionPercent(d)}%</p>
                  <p className="text-xs text-slate-200">다음 단계: {getWebsiteStudioNextStep(d)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => router.push(`/dashboard/websites/${d.id}/edit`)} className={websitePrimaryControlClass}>이어서 만들기</button>
                    <button onClick={() => { const copy = { ...d, id: `${d.id}_copy_${Date.now()}`, title: `${d.title} (복사본)` }; saveLocalWebsiteProject(copy); setDrafts(listLocalWebsiteProjects()); }} className={websiteControlClass}>복제</button>
                    <button onClick={() => { if (!window.confirm("이 초안을 삭제할까요?")) return; deleteLocalWebsiteProject(d.id); setDrafts(listLocalWebsiteProjects()); }} className={websiteDangerControlClass}>삭제</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-white">새로 시작하기</h2>
          <p className="text-sm text-slate-200">새 웹사이트를 빠르게 시작합니다.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {WEBSITE_STUDIO_TEMPLATES.map((template) => (
              <article key={template.id} className="dashboard-websites-card rounded-2xl border border-cyan-300/30 bg-slate-900/70 p-5 shadow-[0_0_22px_rgba(34,211,238,0.16)]">
                <h3 className="min-w-0 break-words text-lg font-semibold text-white">{template.name}</h3>
                <p className="mt-1 min-w-0 break-words text-sm text-slate-200">{template.description}</p>
                <button
                  type="button"
                  onClick={() => {
                    const draft = createLocalWebsiteProjectFromTemplate(template.id, { originBoardId: boardId, originSource: source, originDay: day });
                    saveLocalWebsiteProject(draft);
                    router.push(`/dashboard/websites/${draft.id}/edit`);
                  }}
                  className="dashboard-websites-control mt-4 rounded-lg border border-cyan-300/70 bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
                >
                  이 템플릿으로 시작
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </WebsiteStudioShell>
  );
}
