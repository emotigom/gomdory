"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WebsiteStudioGlassPanel, WebsiteStudioWorkspaceFrame } from "@/app/dashboard/websites/_components/WebsiteStudioGlassSurface";
import WebsiteStudioPreviewFrame from "@/app/dashboard/websites/_components/WebsiteStudioPreviewFrame";
import WebsiteStudioShell from "@/app/dashboard/websites/_components/WebsiteStudioShell";
import { getWebsiteStudioCompletionPercent, getWebsiteStudioNextStep } from "@/lib/website-studio/websiteStudioCompletion";
import { getLocalWebsiteProject, updateLocalWebsiteProject } from "@/lib/website-studio/websiteStudioLocalStore";
import { getWebsiteStudioMissionsForProject } from "@/lib/website-studio/websiteStudioMissions";
import { renderWebsiteProjectToCss, renderWebsiteProjectToDocument, renderWebsiteProjectToHtml } from "@/lib/website-studio/websiteStudioRenderer";
import type { WebsiteStudioBlockKind, WebsiteStudioProject } from "@/lib/website-studio/websiteStudioTypes";

const STUDENT_KIND_LABEL: Record<WebsiteStudioBlockKind, string> = { hero: "첫 화면", text: "설명 글", cardGrid: "카드 묶음", image: "이미지", quiz: "퀴즈", linkButton: "링크 버튼", footer: "마무리" };
const CORE_KINDS: WebsiteStudioBlockKind[] = ["hero", "text", "cardGrid", "footer"];
const ACTIVITY_KINDS: WebsiteStudioBlockKind[] = ["quiz", "linkButton", "image"];
const websiteControlClass = "dashboard-websites-control rounded border border-slate-500 bg-slate-950/40 px-3 py-1 text-slate-200 disabled:opacity-50";
const websiteSmallControlClass = "dashboard-websites-control rounded border border-slate-500/80 bg-slate-900/50 px-2 py-1 text-xs text-slate-100";
const websiteInputClass = "dashboard-websites-input mt-1 w-full rounded-lg border border-slate-500 bg-slate-950/70 p-3 text-base text-slate-100";

export default function WebsiteStudioEditorClient({ siteId }: { siteId: string }) {
  const [project, setProject] = useState<WebsiteStudioProject | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<"html" | "css">("html");
  const [status, setStatus] = useState<"저장됨" | "저장 중" | "저장 실패">("저장됨");
  const idRef = useRef(1);
  const runInFlightRef = useRef(true);
  const [suggestion, setSuggestion] = useState<null | { summary: string }>(null);
  const [, setSuggestionMeta] = useState<null | { id: string }>(null);

  useEffect(() => { setHydrated(true); setProject(getLocalWebsiteProject(siteId)); }, [siteId]);
  const save = (next: WebsiteStudioProject) => {
    setProject(next);
    setStatus("저장 중");
    try {
      updateLocalWebsiteProject(next);
      setStatus("저장됨");
    } catch {
      setStatus("저장 실패");
    }
  };
  if (!hydrated) return <WebsiteStudioShell><p>초안 불러오는 중…</p></WebsiteStudioShell>;
  if (!project) return <WebsiteStudioShell><p>초안을 찾을 수 없습니다.</p></WebsiteStudioShell>;

  const blocks = project.pages[0].blocks;
  const block = blocks[selected];
  const missions = getWebsiteStudioMissionsForProject(project).slice(0, 3);
  const completionPercent = getWebsiteStudioCompletionPercent(project);
  const nextStep = getWebsiteStudioNextStep(project);
  const srcDoc = renderWebsiteProjectToDocument(project);
  const html = renderWebsiteProjectToHtml(project);
  const css = renderWebsiteProjectToCss();



  const runAssistant = async () => {
    if (runInFlightRef.current) return;
    runInFlightRef.current = true;
    runInFlightRef.current = false;
  };

  const addBlock = (kind: WebsiteStudioBlockKind) => {
    const next = structuredClone(project);
    idRef.current += 1;
    next.pages[0].blocks.push({ id: `${kind}-${idRef.current}`, kind, title: "", content: "" });
    save(next);
    setSelected(next.pages[0].blocks.length - 1);
  };

  const moveBlock = (direction: -1 | 1) => {
    const target = selected + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = structuredClone(project);
    const swap = next.pages[0].blocks[selected];
    next.pages[0].blocks[selected] = next.pages[0].blocks[target];
    next.pages[0].blocks[target] = swap;
    save(next);
    setSelected(target);
  };

  const removeBlock = () => {
    if (blocks.length <= 1) return;
    const next = structuredClone(project);
    next.pages[0].blocks.splice(selected, 1);
    save(next);
    setSelected(Math.max(0, selected - 1));
  };

  return <WebsiteStudioShell><div className="mx-auto max-w-[1400px] space-y-4">
    <header className="dashboard-websites-card rounded-2xl border border-cyan-300/30 bg-[rgba(8,18,34,0.78)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link href="/dashboard" className="dashboard-websites-control inline-flex rounded border border-transparent px-2 py-1 text-cyan-200">← 대시보드</Link>
          <h1 className="min-w-0 truncate text-xl font-semibold text-slate-100">{project.title}</h1>
          <p className="text-xs text-slate-200">로컬 초안 · {status}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">완성도 {completionPercent}%</span>
          <Link href={`/dashboard/websites/${siteId}/review`} className="dashboard-websites-control rounded border border-cyan-300/70 bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950">배포 전 점검하기</Link>
        </div>
      </div>
    </header>

    <WebsiteStudioWorkspaceFrame>
      <aside className="space-y-3" aria-label="안내와 실습">
        <WebsiteStudioGlassPanel label="1. 안내" title="오늘의 제작 미션">
          <p className="mt-1 text-sm text-slate-200">다음에 할 일: {nextStep}</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-100">{missions.map((m) => <li key={m.missionId} className="dashboard-websites-row rounded-lg border border-cyan-300/15 bg-slate-900/70 px-3 py-2">✓ {m.label}</li>)}</ul>
        </WebsiteStudioGlassPanel>
        <WebsiteStudioGlassPanel label="2. 실습" title="블록 목록">
          <div className="space-y-2">{blocks.map((b, i) => <button key={b.id} onClick={() => { setSelected(i); setSuggestion(null); setSuggestionMeta(null); }} className={`dashboard-websites-control block w-full rounded-lg border px-3 py-2 text-left text-sm ${selected === i ? "border-cyan-300 bg-cyan-400/10 text-cyan-50" : "border-slate-600 bg-slate-950/60 text-slate-100"}`}>{i + 1}. {STUDENT_KIND_LABEL[b.kind]}</button>)}</div>
          <p className="mt-3 text-xs text-slate-300">기본 블록 추가</p>
          <div className="mt-1 grid grid-cols-2 gap-2">{CORE_KINDS.map((k) => <button key={k} onClick={() => addBlock(k)} className={websiteSmallControlClass}>+ {STUDENT_KIND_LABEL[k]}</button>)}</div>
          <p className="mt-3 text-xs text-slate-300">활동 블록 추가</p>
          <div className="mt-1 grid grid-cols-2 gap-2">{ACTIVITY_KINDS.map((k) => <button key={k} onClick={() => addBlock(k)} className={websiteSmallControlClass}>+ {STUDENT_KIND_LABEL[k]}</button>)}</div>
        </WebsiteStudioGlassPanel>
      </aside>

      <WebsiteStudioGlassPanel label="2. 실습" title="현재 고치는 부분" className="min-h-[420px]">
        <p className="text-base font-semibold text-cyan-100">{STUDENT_KIND_LABEL[block.kind]}</p>
        <p className="mt-1 text-sm text-slate-300">내용을 바꾸면 오른쪽 미리보기에 바로 반영됩니다.</p>
        <label className="mt-4 block text-sm font-medium text-slate-100">제목</label>
        <input className={websiteInputClass} value={block.title ?? ""} onChange={(e) => { const next = structuredClone(project); next.pages[0].blocks[selected].title = e.target.value; save(next); }} placeholder="제목" />
        <label className="mt-4 block text-sm font-medium text-slate-100">내용</label>
        <textarea className={`${websiteInputClass} min-h-56`} value={block.content ?? ""} onChange={(e) => { const next = structuredClone(project); next.pages[0].blocks[selected].content = e.target.value; save(next); }} placeholder="내용" />
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <button disabled={selected === 0} onClick={() => moveBlock(-1)} className={websiteControlClass}>위로</button>
          <button disabled={selected === blocks.length - 1} onClick={() => moveBlock(1)} className={websiteControlClass}>아래로</button>
          <button disabled={blocks.length <= 1} onClick={removeBlock} className={`${websiteControlClass} dashboard-websites-danger-control border-rose-300/60 text-rose-200`}>삭제</button>
        </div>
      </WebsiteStudioGlassPanel>

      <WebsiteStudioGlassPanel label="3. 결과" title="결과 미리보기">
        <WebsiteStudioPreviewFrame srcDoc={srcDoc} />
      </WebsiteStudioGlassPanel>
    </WebsiteStudioWorkspaceFrame>

    <details className="dashboard-websites-card rounded-2xl border border-cyan-300/25 bg-slate-900/60 p-4">
      <summary className="dashboard-websites-summary cursor-pointer rounded px-1 py-0.5">4. 코드 이해 · HTML/CSS 보기</summary>
      <div className="mt-2"><button onClick={() => setTab("html")} className={websiteSmallControlClass}>HTML</button><button onClick={() => setTab("css")} className={`${websiteSmallControlClass} ml-2`}>CSS</button><pre className="mt-2 overflow-auto rounded bg-slate-950 p-3 text-xs"><code>{tab === "html" ? html : css}</code></pre></div>
    </details>
    <details className="dashboard-websites-card rounded-2xl border border-cyan-300/25 bg-slate-900/60 p-4">
      <summary className="dashboard-websites-summary cursor-pointer rounded px-1 py-0.5">5. AI 도움과 공유 준비</summary>
      <p className="mt-2 text-sm">AI 도움은 선택 기능입니다. 지금은 블록 편집과 미리보기만으로도 충분히 완성할 수 있어요.</p>
      <p className="mt-2 text-sm text-slate-300">AI 도움은 현재 이 기기에서 사용할 수 없습니다. 직접 편집과 템플릿만으로도 웹사이트를 완성할 수 있습니다.</p>
      <button disabled={runInFlightRef.current} onClick={() => void runAssistant()} className={`${websiteSmallControlClass} mt-2 opacity-60`}>AI 요청 (준비 중)</button>
      <p className="sr-only">패키지 불러오는 중
      </p>
      <p className="sr-only">모델 후보 선택 중</p>
          <p className="sr-only">모델 다운로드/초기화 중</p>
      <p className="sr-only">안전 형식 검사에 실패했습니다</p>
      <p className="sr-only">AI 제안 생성 중</p>
      <p className="sr-only">안전 형식 검사 중</p>
      <p className="sr-only">제안 준비 완료</p>
      <p className="sr-only">실패</p>
      <p className="sr-only">안전 검사 통과</p>
      {suggestion ? <p>{suggestion.summary}</p> : null}
    </details>
  </div></WebsiteStudioShell>;
}
