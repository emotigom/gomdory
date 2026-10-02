"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

import { apiV1Path } from "@/lib/standards/pathTypes";
import { useModalScrollLock } from "@/lib/ui/useModalScrollLock";

type DisplayMode = "button" | "modal-host" | "standalone";
type GalleryCloseReason = "backdrop" | "close-button" | "programmatic";
type GalleryApp = {
  id: string;
  title: string | null;
  authorLabel: string;
  publishedAt?: string | null;
  displayUrl: string;
};

function getTrustedPreviewUrl(displayUrl: string): string | null {
  try {
    const url = new URL(displayUrl);
    if (url.protocol !== "https:" || url.hostname !== "eduview.gkrry.com" || !/^\/apps\/[^/]+\/$/.test(url.pathname)) return null;
    url.searchParams.set("embed", "1");
    return url.toString();
  } catch {
    return null;
  }
}

function GalleryPreview({ app, onOpen }: { app: GalleryApp; onOpen: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [nearby, setNearby] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const previewUrl = useMemo(() => getTrustedPreviewUrl(app.displayUrl), [app.displayUrl]);
  useEffect(() => {
    const node = ref.current;
    if (!node || !("IntersectionObserver" in window)) return setNearby(true);
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setNearby(true); observer.disconnect(); } }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!nearby) return;
    if (!previewUrl) { setState("failed"); return; }
    setState("loading");
    const timeout = window.setTimeout(() => setState((current) => current === "ready" ? current : "failed"), 8000);
    return () => window.clearTimeout(timeout);
  }, [nearby, previewUrl]);
  return <div ref={ref} className="relative aspect-[16/10] overflow-hidden rounded-t-xl bg-slate-800">
    {nearby && state !== "failed" && previewUrl ? <iframe title={`${app.title || "친구 작품"} 미리보기`} src={previewUrl} loading="lazy" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" tabIndex={-1} onLoad={() => setState("ready")} onError={() => setState("failed")} className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-white" /> : null}
    {state !== "ready" ? <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-700 text-center text-sm text-slate-200">{state === "failed" ? <span>{app.title || "친구 작품"}<br />미리보기를 불러오지 못했어요</span> : <span className="animate-pulse" aria-label="미리보기 준비 중">미리보기를 준비 중이에요</span>}</div> : null}
    <button type="button" aria-label={`${app.title || "친구 작품"} 크게 보기`} onClick={onOpen} className="absolute inset-0 z-20" />
  </div>;
}

function FullscreenGalleryPreview({ app }: { app: GalleryApp }) {
  const previewUrl = useMemo(() => getTrustedPreviewUrl(app.displayUrl), [app.displayUrl]);
  const [state, setState] = useState<"loading" | "ready" | "failed">(previewUrl ? "loading" : "failed");
  useEffect(() => {
    if (!previewUrl) { setState("failed"); return; }
    setState("loading");
    const timeout = window.setTimeout(() => setState((current) => current === "ready" ? current : "failed"), 8000);
    return () => window.clearTimeout(timeout);
  }, [previewUrl]);
  return <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-lg bg-slate-800">
    {state !== "failed" && previewUrl ? <iframe title={`${app.title || "친구 작품"} 크게 보기`} src={previewUrl} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" onLoad={() => setState("ready")} onError={() => setState("failed")} className="absolute inset-0 h-full w-full touch-pan-y border-0 bg-white" /> : null}
    {state !== "ready" ? <div className="absolute inset-0 z-10 flex items-center justify-center text-center text-sm text-slate-200">{app.title || "친구 작품"}<br />{state === "failed" ? "미리보기를 불러오지 못했어요." : "미리보기를 준비 중이에요"}</div> : null}
  </div>;
}

const galleryOpenByBoard = new Map<string, boolean>();
const galleryListenersByBoard = new Map<string, Set<(open: boolean) => void>>();

function getGalleryStateKey(boardId: string, shareCode?: string | null) {
  return `${boardId}:${shareCode?.trim().toLowerCase() || "unknown-share"}`;
}

function setGalleryOpenState(stateKey: string, nextOpen: boolean) {
  galleryOpenByBoard.set(stateKey, nextOpen);
  galleryListenersByBoard.get(stateKey)?.forEach((listener) => listener(nextOpen));
}

function subscribeToGalleryOpenState(stateKey: string, listener: (open: boolean) => void) {
  const listeners = galleryListenersByBoard.get(stateKey) ?? new Set<(open: boolean) => void>();
  listeners.add(listener);
  galleryListenersByBoard.set(stateKey, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) galleryListenersByBoard.delete(stateKey);
  };
}

export default function StudentAppGalleryPanel({
  boardId,
  shareCode,
  accessCode,
  studentSessionToken,
  guestToken,
  displayMode = "standalone",
}: {
  boardId: string;
  shareCode?: string | null;
  accessCode?: string | null;
  studentSessionToken?: string | null;
  guestToken?: string | null;
  displayMode?: DisplayMode;
}) {
  const searchParams = useSearchParams();
  const stateKey = getGalleryStateKey(boardId, shareCode);
  const [open, setOpen] = useState(() => galleryOpenByBoard.get(stateKey) === true);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<GalleryApp[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [selectedApp, setSelectedApp] = useState<GalleryApp | null>(null);
  const debugStudentGallery = searchParams.get("debugStudentGallery") === "1";
  const accessProof = useMemo(
    () => ({
      shareCode: shareCode ?? undefined,
      accessCode: accessCode ?? undefined,
      studentSessionToken: studentSessionToken ?? undefined,
      guestToken: guestToken ?? undefined,
    }),
    [accessCode, guestToken, shareCode, studentSessionToken],
  );

  useEffect(() => subscribeToGalleryOpenState(stateKey, setOpen), [stateKey]);

  useEffect(() => {
    const storedOpen = galleryOpenByBoard.get(stateKey) === true;
    setOpen((currentOpen) => (currentOpen === storedOpen ? currentOpen : storedOpen));
  }, [stateKey]);

  useEffect(() => {
    setMounted(true);
    if (debugStudentGallery) {
      console.info(`[StudentAppGalleryPanel] ${displayMode === "modal-host" ? "stable gallery host mount" : "trigger mount"}`, {
        boardId,
        shareCode,
        displayMode,
      });
    }
    return () => {
      if (debugStudentGallery) {
        console.info(`[StudentAppGalleryPanel] ${displayMode === "modal-host" ? "stable gallery host unmount" : "trigger unmount"}`, {
          boardId,
          shareCode,
          displayMode,
          open: galleryOpenByBoard.get(stateKey) === true,
        });
        if (displayMode === "button" && galleryOpenByBoard.get(stateKey) === true) {
          console.info("[StudentAppGalleryPanel] gallery host preserved while trigger unmounted", {
            boardId,
            shareCode,
            galleryContentExists: typeof document !== "undefined" && Boolean(document.getElementById("student-app-gallery-modal")),
          });
        }
      }
    };
  }, [boardId, debugStudentGallery, displayMode, shareCode, stateKey]);

  useEffect(() => {
    if (open && debugStudentGallery) {
      console.info("[StudentAppGalleryPanel] gallery modal open", { boardId, shareCode, displayMode });
    }
  }, [boardId, debugStudentGallery, displayMode, open, shareCode]);

  const loadList = async () => {
    setLoading(true);
    setListError(null);
    if (debugStudentGallery) console.info("[StudentAppGalleryPanel] public gallery API request start", { boardId, shareCode });
    try {
      const response = await fetch(apiV1Path("student-apps/gallery/list"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId, ...accessProof }),
      });
      if (!response.ok) {
        setApps([]);
        setListError("연결이 잠시 불안정해요.\n잠시 후 다시 시도해 주세요.");
        if (debugStudentGallery) console.info("[StudentAppGalleryPanel] public gallery API request failed", { boardId, shareCode, status: response.status });
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as { apps?: GalleryApp[] };
      const nextApps = Array.isArray(payload.apps) ? payload.apps : [];
      setApps(nextApps);
      setLastRefreshedAt(new Date());
      if (debugStudentGallery) console.info("[StudentAppGalleryPanel] public gallery API request success", { boardId, shareCode, count: nextApps.length });
    } catch (error) {
      setApps([]);
      setListError("연결이 잠시 불안정해요.\n잠시 후 다시 시도해 주세요.");
      if (debugStudentGallery) console.info("[StudentAppGalleryPanel] public gallery API request failed", { boardId, shareCode, error });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !mounted || (displayMode !== "modal-host" && displayMode !== "standalone")) return;
    void loadList();
  // The stable host owns requests so a disappearing top-bar trigger cannot cancel them.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMode, mounted, open]);

  const closeGallery = useCallback((reason: GalleryCloseReason) => {
    if (debugStudentGallery) console.info("[StudentAppGalleryPanel] gallery modal close", { boardId, shareCode, reason });
    setGalleryOpenState(stateKey, false);
  }, [boardId, debugStudentGallery, shareCode, stateKey]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedApp) setSelectedApp(null);
      else closeGallery("close-button");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeGallery, open, selectedApp]);

  useModalScrollLock(open && mounted && (displayMode === "modal-host" || displayMode === "standalone"));
  useModalScrollLock(Boolean(selectedApp && mounted));

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    closeGallery("backdrop");
  };

  const modal = open && mounted && (displayMode === "modal-host" || displayMode === "standalone")
    ? createPortal(
        <div id="student-app-gallery-modal" data-modal-scroll-root="true" className="fixed inset-0 z-[10000] isolate" role="dialog" aria-modal="true" aria-label="친구 작품 보기">
          <div
            data-student-app-gallery-backdrop="true"
            className="absolute inset-0 touch-none bg-slate-950/70 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />
          <div className="relative z-10 flex min-h-full items-center justify-center p-3" data-student-app-gallery="content">
            <div className="flex max-h-[92dvh] w-[min(920px,96vw)] flex-col overflow-hidden rounded-2xl border border-white/20 bg-slate-900/95 text-slate-100">
              <div className="shrink-0 p-5 pb-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">친구 작품 보기</h3>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void loadList()} className="min-h-11 rounded-xl border border-white/25 px-3 text-sm">새로고침</button>
                  <button type="button" onClick={() => closeGallery("close-button")} className="min-h-11 rounded-xl border border-white/25 px-3 text-sm">닫기</button>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-300">공개된 친구들의 앱 작품을 볼 수 있어요.</p>
              <p className="text-sm text-slate-400">안전 검사를 통과해 공개된 작품이 여기에 나타나요.</p>
              {lastRefreshedAt ? <p className="mt-2 text-xs text-slate-300">마지막 새로고침: {lastRefreshedAt.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}</p> : null}
              </div>
              <div data-modal-scroll-container="true" className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y p-5 pt-4">
              {loading ? <p className="mt-4 text-sm">친구 작품을 불러오는 중이에요...</p> : null}
              {!loading && listError ? <div className="mt-4 rounded-xl border border-amber-200/30 bg-amber-200/10 p-4 text-sm text-amber-50"><p className="whitespace-pre-line">{listError}</p><button type="button" onClick={() => void loadList()} className="mt-3 min-h-10 rounded-lg border border-amber-100/40 px-3 text-xs font-semibold">다시 불러오기</button></div> : null}
              {!loading && !listError && apps.length === 0 ? <div className="mt-4 space-y-1 text-sm text-slate-200"><p>아직 공개된 친구 작품이 없어요.</p><p>작품이 공개되면 여기에 보여요.</p></div> : null}
              {!loading && apps.length > 0 ? <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{apps.map((app) => <article key={app.id} className="overflow-hidden rounded-xl border border-white/20 bg-slate-950/40"><GalleryPreview app={app} onOpen={() => setSelectedApp(app)} /><div className="p-3"><p className="truncate font-semibold">{app.title || "제목 없음"}</p><p className="mt-1 text-xs text-slate-300">작성자 {app.authorLabel || "친구 작품"}</p>{app.publishedAt ? <p className="mt-1 text-xs text-slate-300">공개일: {new Date(app.publishedAt).toLocaleDateString("ko-KR")}</p> : null}<button type="button" onClick={() => setSelectedApp(app)} className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-white/30 px-3 text-xs font-semibold">크게 보기</button></div></article>)}</div> : null}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  const previewModal = selectedApp && mounted ? createPortal(
    <div data-modal-scroll-root="true" className="fixed inset-0 z-[10001] flex items-center justify-center touch-none bg-slate-950/85 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label={`${selectedApp.title || "친구 작품"} 크게 보기`} onClick={(event) => { if (event.target === event.currentTarget) setSelectedApp(null); }}>
      <div data-modal-scroll-container="true" className="flex h-[94dvh] w-full max-w-6xl flex-col rounded-xl bg-slate-900 p-3 sm:h-[90vh]">
        <div className="mb-3 flex items-center justify-between gap-2"><p className="truncate font-semibold">{selectedApp.title || "친구 작품"}</p><div className="flex gap-2"><a href={selectedApp.displayUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-white/30 px-3 text-xs">새 창에서 열기</a><button type="button" autoFocus onClick={() => setSelectedApp(null)} className="min-h-10 rounded-lg border border-white/30 px-3 text-xs">닫기</button></div></div>
        <FullscreenGalleryPreview app={selectedApp} />
      </div>
    </div>, document.body) : null;

  if (displayMode === "modal-host") return <>{modal}{previewModal}</>;

  return (
    <div className="inline-flex items-center">
      <button type="button" data-student-app-gallery="trigger" onClick={() => {
        if (debugStudentGallery) console.info("[StudentAppGalleryPanel] gallery trigger click", { boardId, shareCode, displayMode });
        setGalleryOpenState(stateKey, true);
      }} className="min-h-11 rounded-xl border border-cyan-200/50 bg-cyan-400/25 px-3.5 text-xs font-semibold text-cyan-50">
        친구 작품 보기
      </button>
      {modal}{previewModal}
    </div>
  );
}
