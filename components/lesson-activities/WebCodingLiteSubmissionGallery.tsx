"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildWebCodingLitePreviewSrcDoc } from "@/components/lesson-activities/WebCodingLiteActivity";
import type { WebCodingLiteSubmissionReviewItem, WebCodingLiteSubmissionReviewPayload } from "@/lib/lesson-activities/types";
import { routes } from "@/lib/standards/routes";

type Props = {
  boardId: string;
  open: boolean;
  onClose: () => void;
};

type GalleryTab = "html" | "css" | "js" | "preview";
type CardStatus = { kind: "success" | "error"; message: string } | null;

type ApiPayload = {
  ok?: boolean;
  data?: WebCodingLiteSubmissionReviewPayload;
  error?: { message?: string };
};

type CreateCardPayload = {
  ok?: boolean;
  data?: { cardId?: string; wallId?: string; studentLabel?: string };
  error?: { message?: string };
};

const tabLabels: Record<GalleryTab, string> = {
  preview: "미리보기",
  html: "HTML",
  css: "CSS",
  js: "JS",
};

function formatTime(value: string | null): string {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getCode(item: WebCodingLiteSubmissionReviewItem | null, tab: GalleryTab): string {
  if (!item) return "";
  if (tab === "html") return item.html;
  if (tab === "css") return item.css;
  if (tab === "js") return item.js;
  return "";
}

function SubmissionBadge({ submitted }: { submitted: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${submitted ? "border-emerald-200/40 bg-emerald-300/15 text-emerald-100" : "border-[var(--theme-border)] bg-[var(--theme-surface-muted)] text-[var(--theme-text-muted)]"}`}>
      {submitted ? "제출됨" : "저장됨"}
    </span>
  );
}

function ReadOnlyCodeBlock({ label, value, onCopy, presentation = false }: { label: string; value: string; onCopy?: () => void; presentation?: boolean }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/90">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--theme-border)] px-3 py-2">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{label}</p>
        {onCopy ? (
          <button type="button" onClick={onCopy} className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-2.5 py-1 text-[11px] font-black text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)]">
            {label} 복사
          </button>
        ) : null}
      </div>
      <pre className={`${presentation ? "min-h-[60vh] text-[15px] leading-7" : "min-h-[320px] text-[12px] leading-5"} flex-1 overflow-auto whitespace-pre-wrap break-words p-4 text-left font-mono text-[var(--theme-text)] sm:whitespace-pre`}>
        <code>{value || "// 아직 저장된 코드가 없습니다."}</code>
      </pre>
    </div>
  );
}

function TabButtons({ activeTab, onSelect, label }: { activeTab: GalleryTab; onSelect: (tab: GalleryTab) => void; label: string }) {
  return (
    <div className="grid grid-cols-4 gap-2" role="tablist" aria-label={label}>
      {(Object.keys(tabLabels) as GalleryTab[]).map((tab) => (
        <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => onSelect(tab)} className={`rounded-xl border px-3 py-2 text-xs font-black ${activeTab === tab ? "border-[var(--theme-border-strong)] bg-[var(--theme-accent)] text-[var(--theme-accent-text)]" : "border-[var(--theme-border)] bg-[var(--theme-card-muted)] text-[var(--theme-text)] hover:border-[var(--theme-border-strong)]/60"}`}>
          {tabLabels[tab]}
        </button>
      ))}
    </div>
  );
}

export default function WebCodingLiteSubmissionGallery({ boardId, open, onClose }: Props) {
  const [payload, setPayload] = useState<WebCodingLiteSubmissionReviewPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GalleryTab>("html");
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [presentationTab, setPresentationTab] = useState<GalleryTab>("preview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [presentationRuntimeError, setPresentationRuntimeError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [presentationPreviewKey, setPresentationPreviewKey] = useState(0);
  const [creatingCardId, setCreatingCardId] = useState<string | null>(null);
  const [cardStatusById, setCardStatusById] = useState<Record<string, CardStatus>>({});
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const presentationIframeRef = useRef<HTMLIFrameElement | null>(null);

  const submissions = useMemo(() => payload?.submissions ?? [], [payload?.submissions]);
  const selectedIndex = useMemo(() => submissions.findIndex((item) => item.id === selectedId), [selectedId, submissions]);
  const selected = useMemo(
    () => submissions.find((item) => item.id === selectedId) ?? submissions[0] ?? null,
    [selectedId, submissions],
  );
  const normalizedSelectedIndex = selected ? Math.max(0, selectedIndex) : -1;
  const codeValue = getCode(selected, activeTab);
  const presentationCodeValue = getCode(selected, presentationTab);
  const previewSrcDoc = selected ? buildWebCodingLitePreviewSrcDoc(selected.html, selected.css, selected.js) : "";
  const selectedCardStatus = selected ? cardStatusById[selected.id] ?? null : null;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(routes.api.boards.webStudioSubmissions(boardId), { cache: "no-store" });
      const json = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok || !json?.ok || !json.data) throw new Error(json?.error?.message ?? "웹 코딩 제출물을 불러오지 못했습니다.");
      setPayload(json.data);
      setSelectedId((current) => (current && json.data?.submissions.some((item) => item.id === current) ? current : json.data?.submissions[0]?.id ?? null));
      setRuntimeError(null);
      setPresentationRuntimeError(null);
      setPreviewKey((key) => key + 1);
      setPresentationPreviewKey((key) => key + 1);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "웹 코딩 제출물을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boardId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (presentationOpen) {
        setPresentationOpen(false);
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, presentationOpen]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const isGalleryPreview = Boolean(iframeRef.current?.contentWindow && event.source === iframeRef.current.contentWindow);
      const isPresentationPreview = Boolean(presentationIframeRef.current?.contentWindow && event.source === presentationIframeRef.current.contentWindow);
      if (!isGalleryPreview && !isPresentationPreview) return;
      const data = event.data as { source?: string; type?: string; message?: string; line?: number; column?: number } | null;
      if (!data || data.source !== "gomdory-web-coding-lite-preview" || data.type !== "runtime_error") return;
      const safeMessage = String(data.message ?? "미리보기 오류").slice(0, 500);
      const position = data.line ? ` (${data.line}${data.column ? `:${data.column}` : ""})` : "";
      if (isPresentationPreview) {
        setPresentationRuntimeError(`${safeMessage}${position}`);
      } else {
        setRuntimeError(`${safeMessage}${position}`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    setRuntimeError(null);
    setPresentationRuntimeError(null);
    setPreviewKey((key) => key + 1);
    setPresentationPreviewKey((key) => key + 1);
  }, [selected?.id]);

  if (!open) return null;

  const copyActiveCode = async () => {
    if (!selected || activeTab === "preview") return;
    await navigator.clipboard?.writeText(codeValue);
  };

  const openPresentation = () => {
    if (!selected) return;
    setPresentationTab("preview");
    setPresentationRuntimeError(null);
    setPresentationPreviewKey((key) => key + 1);
    setPresentationOpen(true);
  };

  const selectRelativeSubmission = (direction: -1 | 1) => {
    if (!submissions.length || normalizedSelectedIndex < 0) return;
    const nextIndex = Math.min(Math.max(normalizedSelectedIndex + direction, 0), submissions.length - 1);
    setSelectedId(submissions[nextIndex]?.id ?? selectedId);
    setPresentationTab("preview");
  };

  const createBoardCard = async () => {
    if (!selected || creatingCardId) return;
    setCreatingCardId(selected.id);
    setCardStatusById((current) => ({ ...current, [selected.id]: null }));
    try {
      const response = await fetch(routes.api.boards.webStudioSubmissionCard(boardId, selected.id), { method: "POST" });
      const json = (await response.json().catch(() => null)) as CreateCardPayload | null;
      if (!response.ok || !json?.ok) throw new Error(json?.error?.message ?? "보드 카드 생성에 실패했어요.");
      setCardStatusById((current) => ({ ...current, [selected.id]: { kind: "success", message: "보드 카드로 보냈어요." } }));
    } catch {
      setCardStatusById((current) => ({ ...current, [selected.id]: { kind: "error", message: "보드 카드 생성에 실패했어요." } }));
    } finally {
      setCreatingCardId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--theme-card)] p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="web-coding-lite-submissions-title">
      <div className="flex max-h-[92vh] w-full max-w-7xl min-w-0 flex-col overflow-hidden rounded-[2rem] border border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-text)] shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--theme-border)] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--theme-accent)]">Web Studio Lite</p>
            <h2 id="web-coding-lite-submissions-title" className="mt-1 text-xl font-black text-[var(--theme-text)]">웹 코딩 제출물</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--theme-text-subtle)]">교사 권한으로만 전체 HTML/CSS/JS를 확인합니다. 미리보기는 sandbox=&quot;allow-scripts&quot; iframe에서 실행됩니다.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-3 py-2 text-xs font-black text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] disabled:opacity-60">새로고침</button>
            <button type="button" onClick={onClose} aria-label="웹 코딩 제출물 닫기" className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] px-3 py-2 text-xs font-black text-[var(--theme-text)] hover:border-[var(--theme-border-strong)]">닫기</button>
          </div>
        </header>

        {error ? <p role="alert" className="mx-4 mt-4 rounded-2xl border border-rose-300/30 bg-rose-400/10 p-3 text-sm leading-6 text-rose-100 sm:mx-5">{error}</p> : null}
        {loading ? <p className="mx-4 mt-4 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] p-3 text-sm text-[var(--theme-text-muted)] sm:mx-5">제출물을 불러오고 있어요...</p> : null}

        {!loading && !error && submissions.length === 0 ? (
          <div className="m-4 rounded-3xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card-muted)]/60 p-8 text-center text-sm font-bold text-[var(--theme-text-muted)] sm:m-5">
            아직 제출된 코드가 없어요.
          </div>
        ) : null}

        {submissions.length > 0 ? (
          <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1">
            <aside className="min-w-0 overflow-auto border-b border-[var(--theme-border)] p-3 lg:border-b-0 lg:border-r">
              <ul className="flex gap-2 overflow-x-auto lg:block lg:space-y-2 lg:overflow-x-visible">
                {submissions.map((item) => (
                  <li key={item.id} className="min-w-[240px] lg:min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${selected?.id === item.id ? "border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)]" : "border-[var(--theme-border)] bg-[var(--theme-card-muted)] hover:border-[var(--theme-border-strong)]"}`}
                    >
                      <span className="block text-sm font-black text-[var(--theme-text)]">{item.studentLabel}</span>
                      <span className="mt-2 block"><SubmissionBadge submitted={item.submitted} /></span>
                      <span className="mt-2 block text-[11px] leading-5 text-[var(--theme-text-subtle)]">저장: {formatTime(item.savedAt)}</span>
                      {item.submittedAt ? <span className="block text-[11px] leading-5 text-emerald-100/80">제출: {formatTime(item.submittedAt)}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4">
              <div className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-[var(--theme-text)]">{selected?.studentLabel}</h3>
                    {selected ? <SubmissionBadge submitted={selected.submitted} /> : null}
                  </div>
                  {selected ? <p className="mt-1 text-xs text-[var(--theme-text-subtle)]">총 {selected.counts.totalLines.toLocaleString()}줄 · {selected.counts.totalChars.toLocaleString()}자</p> : null}
                  {selectedCardStatus ? <p role="status" className={`mt-2 rounded-xl border px-3 py-2 text-xs font-bold ${selectedCardStatus.kind === "success" ? "border-emerald-200/40 bg-emerald-300/10 text-emerald-100" : "border-rose-200/40 bg-rose-300/10 text-rose-100"}`}>{selectedCardStatus.message}</p> : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button type="button" onClick={openPresentation} className="rounded-xl border border-amber-200/40 bg-amber-300 px-3 py-2 text-xs font-black text-[var(--theme-accent-text)] shadow-lg shadow-amber-950/20 hover:bg-amber-200">발표 보기</button>
                  <button type="button" onClick={() => void createBoardCard()} disabled={!selected || Boolean(creatingCardId)} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-3 py-2 text-xs font-black text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60">
                    {creatingCardId === selected?.id ? "보내는 중..." : "보드 카드로 보내기"}
                  </button>
                  <TabButtons activeTab={activeTab} onSelect={setActiveTab} label="웹 코딩 제출물 코드 탭" />
                </div>
              </div>

              <div className="mt-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {activeTab === "preview" ? (
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] p-3">
                    <div className="flex shrink-0 items-center justify-between gap-3">
                      <p className="text-xs leading-5 text-[var(--theme-text-muted)]">학생 JavaScript는 아래 iframe 내부에서만 실행됩니다.</p>
                      <button type="button" onClick={() => { setRuntimeError(null); setPreviewKey((key) => key + 1); }} className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-2.5 py-1 text-[11px] font-black text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)]">미리보기 새로고침</button>
                    </div>
                    {runtimeError ? <p role="alert" data-testid="web-coding-lite-teacher-preview-error" className="mt-3 rounded-xl border border-amber-200/40 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">코드를 실행하는 중 오류가 발생했어요. {runtimeError}</p> : null}
                    <iframe key={previewKey} ref={iframeRef} title="웹 코딩 제출물 미리보기" srcDoc={previewSrcDoc} sandbox="allow-scripts" className="mt-3 min-h-[420px] w-full flex-1 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]" />
                  </div>
                ) : (
                  <ReadOnlyCodeBlock label={tabLabels[activeTab]} value={codeValue} onCopy={() => void copyActiveCode()} />
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>

      {presentationOpen && selected ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--theme-bg)] text-[var(--theme-text)]" role="dialog" aria-modal="true" aria-labelledby="web-coding-lite-presentation-title">
          <header className="flex shrink-0 flex-col gap-3 border-b border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-200">발표 모드</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 id="web-coding-lite-presentation-title" className="text-2xl font-black text-[var(--theme-text)]">{selected.studentLabel}</h2>
                <SubmissionBadge submitted={selected.submitted} />
                <span className="text-sm font-bold text-[var(--theme-text-muted)]">{selected.submitted ? `제출: ${formatTime(selected.submittedAt)}` : `저장: ${formatTime(selected.savedAt)}`}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => selectRelativeSubmission(-1)} disabled={normalizedSelectedIndex <= 0} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] px-3 py-2 text-sm font-black text-[var(--theme-text)] hover:border-[var(--theme-border-strong)] disabled:opacity-40">이전 제출물</button>
              <button type="button" onClick={() => selectRelativeSubmission(1)} disabled={normalizedSelectedIndex >= submissions.length - 1} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] px-3 py-2 text-sm font-black text-[var(--theme-text)] hover:border-[var(--theme-border-strong)] disabled:opacity-40">다음 제출물</button>
              <button type="button" onClick={() => setPresentationOpen(false)} aria-label="발표 보기 닫기" className="rounded-xl border border-rose-200/40 bg-rose-400/15 px-3 py-2 text-sm font-black text-rose-50 hover:bg-rose-400/25">닫기</button>
            </div>
          </header>
          <main className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <TabButtons activeTab={presentationTab} onSelect={setPresentationTab} label="웹 코딩 제출물 발표 탭" />
            <div className="min-h-0 flex-1 overflow-hidden">
              {presentationTab === "preview" ? (
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--theme-border-strong)] bg-[var(--theme-card-muted)] p-3 shadow-2xl">
                  <div className="flex shrink-0 items-center justify-between gap-3 px-1 pb-2">
                    <p className="text-sm font-bold text-[var(--theme-text-muted)]">기본 화면은 미리보기입니다. 코드는 교사 발표 화면 안에서만 전환해 확인합니다.</p>
                    <button type="button" onClick={() => { setPresentationRuntimeError(null); setPresentationPreviewKey((key) => key + 1); }} className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-2.5 py-1 text-xs font-black text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)]">미리보기 새로고침</button>
                  </div>
                  {presentationRuntimeError ? <p role="alert" data-testid="web-coding-lite-presentation-preview-error" className="mb-3 rounded-xl border border-amber-200/40 bg-amber-300/10 px-3 py-2 text-sm leading-6 text-amber-100">코드를 실행하는 중 오류가 발생했어요. {presentationRuntimeError}</p> : null}
                  <iframe key={presentationPreviewKey} ref={presentationIframeRef} title="웹 코딩 제출물 발표 미리보기" srcDoc={previewSrcDoc} sandbox="allow-scripts" className="min-h-[65vh] w-full flex-1 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]" />
                </div>
              ) : (
                <ReadOnlyCodeBlock label={tabLabels[presentationTab]} value={presentationCodeValue} presentation />
              )}
            </div>
          </main>
        </div>
      ) : null}
    </div>
  );
}
