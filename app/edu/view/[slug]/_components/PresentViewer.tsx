"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { readEduviewOrigin } from "@/lib/env/appConfig";

type PresentViewerProps = {
  slug: string;
  rawUrl: string;
  isHidden: boolean;
  hiddenReason?: string | null;
};

type GalleryListItem = {
  slug: string;
  title: string;
  isHidden?: boolean | null;
};

type GalleryListResponse = {
  items: GalleryListItem[];
};

const isEditableElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
};

const ALLOWED_INTERVALS = [10, 20, 30, 60];
const HUD_HIDE_DELAY_MS = 3000;

const clampInterval = (value: number) => {
  if (ALLOWED_INTERVALS.includes(value)) {
    return value;
  }
  return 20;
};

export default function PresentViewer({ slug, rawUrl, isHidden, hiddenReason }: PresentViewerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPresentMode = searchParams.get("present") === "1";
  const isGalleryMode = searchParams.get("gallery") === "1";
  const boardId = searchParams.get("boardId")?.trim() ?? "";
  const shareCode = searchParams.get("shareCode")?.trim() ?? "";
  const isTeacherMode = searchParams.get("teacher") === "1";
  const autoplayParam = searchParams.get("autoplay") === "1";
  const intervalParamRaw = searchParams.get("interval");
  const intervalParam = intervalParamRaw ? Number.parseInt(intervalParamRaw, 10) : 20;
  const sortParam = searchParams.get("sort")?.trim() ?? "";
  const indexParam = searchParams.get("i");
  const startSlugParam = searchParams.get("startSlug")?.trim() ?? "";
  const canAutoPlay = isPresentMode && isGalleryMode && isTeacherMode && !isHidden;

  const [autoPlay, setAutoPlay] = useState(false);
  const [intervalSec, setIntervalSec] = useState(20);
  const [paused, setPaused] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [hudPinned, setHudPinned] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const hudTimerRef = useRef<number | null>(null);

  const [listItems, setListItems] = useState<GalleryListItem[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const cachedKeyRef = useRef<string | null>(null);
  const prefetchedSlugsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isPresentMode || !isGalleryMode || isHidden) return;
    const sourceKey = boardId ? `board:${boardId}` : shareCode ? `share:${shareCode}` : "";
    if (!sourceKey) return;
    if (cachedKeyRef.current === sourceKey) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "200", sort: "featured_order" });
    if (boardId) {
      params.set("boardId", boardId);
    } else if (shareCode) {
      params.set("shareCode", shareCode);
    }

    setIsListLoading(true);
    fetch(`${apiV1Path("edu/projects/list")}?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("fetch failed"))))
      .then((payload) => {
        const data = payload as GalleryListResponse;
        setListItems(data.items ?? []);
        cachedKeyRef.current = sourceKey;
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsListLoading(false);
        }
      });

    return () => controller.abort();
  }, [boardId, isGalleryMode, isHidden, isPresentMode, shareCode]);

  const currentIndex = useMemo(() => {
    if (listItems.length === 0) return -1;
    if (indexParam) {
      const parsed = Number.parseInt(indexParam, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < listItems.length) {
        return parsed;
      }
    }
    return listItems.findIndex((item) => item.slug === slug);
  }, [indexParam, listItems, slug]);

  const totalCount = listItems.length;
  const currentItem = currentIndex >= 0 ? listItems[currentIndex] : null;
  const headerTitle = currentItem?.title ?? slug;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < totalCount - 1;
  const hiddenSlugs = useMemo(
    () => new Set(listItems.filter((item) => item.isHidden).map((item) => item.slug)),
    [listItems],
  );

  const eduViewOrigin = useMemo(() => {
    if (typeof window === "undefined") {
      return readEduviewOrigin();
    }
    if (rawUrl.startsWith("/")) {
      return window.location.origin;
    }
    try {
      return new URL(rawUrl).origin;
    } catch {
      return readEduviewOrigin();
    }
  }, [rawUrl]);

  const buildPresentQuery = useCallback(
    (nextIndex: number) => {
      const params = new URLSearchParams({ present: "1", gallery: "1", i: String(nextIndex) });
      if (boardId) {
        params.set("boardId", boardId);
      } else if (shareCode) {
        params.set("shareCode", shareCode);
      }
      if (sortParam) {
        params.set("sort", sortParam);
      }
      if (isTeacherMode) {
        params.set("teacher", "1");
      }
      return params.toString();
    },
    [boardId, isTeacherMode, shareCode, sortParam],
  );

  useEffect(() => {
    if (!isPresentMode || !isGalleryMode || indexParam || !startSlugParam || listItems.length === 0) return;
    const targetIndex = listItems.findIndex((item) => item.slug === startSlugParam);
    if (targetIndex < 0) return;
    const targetSlug = listItems[targetIndex]?.slug;
    if (!targetSlug) return;
    router.replace(`/edu/view/${targetSlug}?${buildPresentQuery(targetIndex)}`);
  }, [buildPresentQuery, indexParam, isGalleryMode, isPresentMode, listItems, router, startSlugParam]);

  const handleNavigate = useCallback(
    (nextIndex: number) => {
      const nextItem = listItems[nextIndex];
      if (!nextItem) return;
      router.replace(`/edu/view/${nextItem.slug}?${buildPresentQuery(nextIndex)}`);
    },
    [buildPresentQuery, listItems, router],
  );

  const handleExit = useCallback(() => {
    router.replace(`/edu/view/${slug}/`);
  }, [router, slug]);

  const pauseAutoPlay = useCallback(() => {
    if (!autoPlay) return;
    setPaused(true);
  }, [autoPlay]);

  const clearHudTimer = useCallback(() => {
    if (hudTimerRef.current) {
      window.clearTimeout(hudTimerRef.current);
      hudTimerRef.current = null;
    }
  }, []);

  const scheduleHudHide = useCallback(() => {
    clearHudTimer();
    hudTimerRef.current = window.setTimeout(() => {
      setHudVisible(false);
      setHelpOpen(false);
    }, HUD_HIDE_DELAY_MS);
  }, [clearHudTimer]);

  const markHudActivity = useCallback(() => {
    if (!isPresentMode || isHidden) return;
    if (hudPinned) return;
    setHudVisible(true);
    scheduleHudHide();
  }, [hudPinned, isHidden, isPresentMode, scheduleHudHide]);

  const handleUserNavigate = useCallback(
    (nextIndex: number) => {
      pauseAutoPlay();
      handleNavigate(nextIndex);
    },
    [handleNavigate, pauseAutoPlay],
  );

  useEffect(() => {
    if (!isPresentMode || !isGalleryMode) return;
    if (isTeacherMode && autoplayParam) {
      setAutoPlay(true);
      setIntervalSec(clampInterval(intervalParam));
      setPaused(false);
      return;
    }
    if (!isTeacherMode) {
      setAutoPlay(false);
      setPaused(false);
      return;
    }
    try {
      const storedAutoPlay = sessionStorage.getItem("edu:present:autoplay");
      const storedInterval = sessionStorage.getItem("edu:present:intervalSec");
      if (storedAutoPlay === "1") {
        setAutoPlay(true);
      }
      if (storedInterval) {
        const parsed = Number.parseInt(storedInterval, 10);
        if ([10, 20, 30, 60].includes(parsed)) {
          setIntervalSec(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, [autoplayParam, intervalParam, isGalleryMode, isPresentMode, isTeacherMode]);

  useEffect(() => {
    if (!isPresentMode || !isGalleryMode || !isTeacherMode) return;
    try {
      sessionStorage.setItem("edu:present:autoplay", autoPlay ? "1" : "0");
      sessionStorage.setItem("edu:present:intervalSec", String(intervalSec));
    } catch {
      // ignore
    }
  }, [autoPlay, intervalSec, isGalleryMode, isPresentMode, isTeacherMode]);

  useEffect(() => {
    if (!canAutoPlay) return;
    if (!autoPlay || paused) return;
    if (currentIndex >= totalCount - 1 && totalCount > 0) {
      setAutoPlay(false);
      setPaused(false);
      return;
    }
    const timer = window.setInterval(() => {
      handleNavigate(currentIndex + 1);
    }, intervalSec * 1000);
    return () => window.clearInterval(timer);
  }, [autoPlay, canAutoPlay, currentIndex, handleNavigate, intervalSec, paused, totalCount]);

  useEffect(() => {
    if (!isPresentMode || !isGalleryMode) return;
    const handleVisibility = () => {
      if (document.hidden) {
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isGalleryMode, isPresentMode]);

  useEffect(() => {
    if (!isPresentMode || !isGalleryMode || isHidden) return;
    if (!hasNext) return;
    const nextItem = listItems[currentIndex + 1];
    if (!nextItem?.slug) return;
    if (nextItem.isHidden || hiddenSlugs.has(nextItem.slug)) return;
    if (prefetchedSlugsRef.current.has(nextItem.slug)) return;

    prefetchedSlugsRef.current.add(nextItem.slug);
    const nextThumbUrl = `${eduViewOrigin}/v1/${nextItem.slug}/thumb.png`;
    const nextIndexUrl = `${eduViewOrigin}/v1/${nextItem.slug}/`;

    try {
      const image = new Image();
      image.referrerPolicy = "no-referrer";
      image.crossOrigin = "anonymous";
      image.src = nextThumbUrl;
    } catch {
      // ignore
    }

    try {
      const link = document.createElement("link");
      const supportsPrefetch = "relList" in link && link.relList.supports?.("prefetch");
      if (supportsPrefetch) {
        link.rel = "prefetch";
        link.as = "document";
        link.href = nextIndexUrl;
        link.crossOrigin = "anonymous";
        link.referrerPolicy = "no-referrer";
        link.onload = () => link.remove();
        link.onerror = () => link.remove();
        document.head.appendChild(link);
      } else {
        void fetch(nextIndexUrl, {
          method: "GET",
          credentials: "omit",
          mode: "no-cors",
          referrerPolicy: "no-referrer",
        }).catch(() => null);
      }
    } catch {
      // ignore
    }
  }, [
    currentIndex,
    eduViewOrigin,
    hasNext,
    hiddenSlugs,
    isGalleryMode,
    isHidden,
    isPresentMode,
    listItems,
  ]);

  useEffect(() => {
    if (!isPresentMode || isHidden) return;
    if (hudPinned) {
      setHudVisible(true);
      clearHudTimer();
      return () => undefined;
    }
    setHudVisible(true);
    scheduleHudHide();
    return () => clearHudTimer();
  }, [clearHudTimer, hudPinned, isHidden, isPresentMode, scheduleHudHide]);

  useEffect(() => {
    if (!isPresentMode || isHidden) return;
    const handleMouseMove = () => markHudActivity();
    const handlePointerDown = () => markHudActivity();
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isHidden, isPresentMode, markHudActivity]);

  useEffect(() => {
    if (!isPresentMode || isHidden) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) return;
      markHudActivity();
      if (event.key === "Escape") {
        event.preventDefault();
        handleExit();
        return;
      }
      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setHudPinned((prev) => {
          const next = !prev;
          if (next) {
            setHudVisible(true);
            clearHudTimer();
          } else {
            setHudVisible(true);
            scheduleHudHide();
          }
          return next;
        });
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setHudVisible(true);
        setHelpOpen((prev) => !prev);
        return;
      }
      if (event.key === " " && canAutoPlay && autoPlay) {
        event.preventDefault();
        setPaused(true);
      }
      if (!isGalleryMode) return;
      if (event.key === "ArrowLeft" && hasPrev) {
        event.preventDefault();
        pauseAutoPlay();
        handleNavigate(currentIndex - 1);
      }
      if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        pauseAutoPlay();
        handleNavigate(currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentIndex,
    handleExit,
    handleNavigate,
    hasNext,
    hasPrev,
    isGalleryMode,
    isHidden,
    isPresentMode,
    autoPlay,
    canAutoPlay,
    pauseAutoPlay,
    clearHudTimer,
    markHudActivity,
    scheduleHudHide,
  ]);

  const counterLabel =
    totalCount > 0 ? `${currentIndex >= 0 ? currentIndex + 1 : "-"} / ${totalCount}` : null;
  const endLabel = totalCount > 0 && !hasNext ? "끝" : null;

  const showGalleryNav = isGalleryMode && !isHidden;
  const showAutoPlayControls = canAutoPlay && showGalleryNav;
  const autoPlayStatusLabel = autoPlay ? "ON" : "OFF";
  const isAutoPlayActive = autoPlay && !paused;

  const containerClasses = isPresentMode
    ? "relative h-screen w-screen overflow-hidden bg-slate-50"
    : "mx-auto flex min-h-screen w-[calc(100vw-12px)] flex-col gap-3 px-2 py-2 sm:w-[calc(100vw-16px)] sm:px-3 sm:py-3 2xl:w-[min(2400px,calc(100vw-24px))]";
  const iframeClasses = isPresentMode
    ? "h-full w-full border-0 bg-white"
    : "h-[85vh] w-full rounded-2xl border border-slate-200 bg-white shadow-sm sm:h-[90vh]";
  const hudContainerClasses = `absolute inset-x-0 top-0 z-20 flex flex-col gap-2 px-3 pt-3 transition-opacity duration-300 ${
    hudVisible || hudPinned ? "opacity-100" : "pointer-events-none opacity-0"
  }`;

  return (
    <div className={containerClasses} onPointerDown={pauseAutoPlay}>
      {isPresentMode ? (
        <div className={hudContainerClasses}>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 backdrop-blur-sm">
            <span className="rounded-full border border-slate-200 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              발표 모드
            </span>
            <p className="flex-1 text-center text-xs font-semibold text-slate-900">{headerTitle}</p>
            <div className="flex items-center gap-2">
              {showAutoPlayControls ? (
                <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => {
                      if (!autoPlay) {
                        setAutoPlay(true);
                        setPaused(false);
                        return;
                      }
                      setAutoPlay(false);
                      setPaused(false);
                    }}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                      autoPlay
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    Auto {autoPlayStatusLabel}
                  </button>
                  <select
                    value={intervalSec}
                    onChange={(event) => setIntervalSec(Number(event.target.value))}
                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                    aria-label="자동 재생 간격"
                  >
                    <option value={10}>10s</option>
                    <option value={20}>20s</option>
                    <option value={30}>30s</option>
                    <option value={60}>60s</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!autoPlay) {
                        setAutoPlay(true);
                        setPaused(false);
                        return;
                      }
                      setPaused((prev) => !prev);
                    }}
                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300"
                    aria-label={isAutoPlayActive ? "자동 재생 일시정지" : "자동 재생 시작"}
                  >
                    {isAutoPlayActive ? "⏸" : "▶"}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setHudPinned((prev) => {
                    const next = !prev;
                    if (next) {
                      setHudVisible(true);
                      clearHudTimer();
                    } else {
                      setHudVisible(true);
                      scheduleHudHide();
                    }
                    return next;
                  });
                }}
                className={`rounded-full border px-2 py-1 text-[10px] font-semibold transition ${
                  hudPinned
                    ? "border-slate-400 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
                aria-pressed={hudPinned}
              >
                HUD {hudPinned ? "고정" : "자동"}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setHelpOpen((prev) => !prev);
                    setHudVisible(true);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300"
                  aria-expanded={helpOpen}
                  aria-controls="present-shortcuts"
                >
                  ?
                </button>
                {helpOpen ? (
                  <div
                    id="present-shortcuts"
                    className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white/90 p-3 text-[11px] font-medium text-slate-700 backdrop-blur-sm"
                  >
                    <p className="text-[10px] font-semibold uppercase text-slate-500">단축키</p>
                    <ul className="mt-2 space-y-1">
                      <li>←/→ 다음·이전</li>
                      <li>ESC 종료</li>
                      <li>H HUD 토글</li>
                      <li>Space 자동재생 일시정지 (교사용)</li>
                    </ul>
                  </div>
                ) : null}
              </div>
              <Link
                href={`/edu/view/${slug}/`}
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                닫기
              </Link>
            </div>
          </div>
          {showGalleryNav ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-600 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUserNavigate(currentIndex - 1)}
                  disabled={!hasPrev}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                >
                  이전
                </button>
                <button
                  type="button"
                  onClick={() => handleUserNavigate(currentIndex + 1)}
                  disabled={!hasNext}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                >
                  다음
                </button>
              </div>
              <div className="flex items-center gap-2">
                {endLabel ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    끝
                  </span>
                ) : null}
                <span className="text-[10px] font-semibold text-slate-500">
                  {counterLabel ?? (isListLoading ? "불러오는 중..." : "")}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {isHidden ? (
        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
          <p className="text-base font-semibold">숨김 처리됨</p>
          <p className="mt-2 text-xs text-rose-600">선생님 또는 운영진이 이 작품을 숨김 처리했어요.</p>
          {hiddenReason ? <p className="mt-3 text-xs text-rose-700">사유: {hiddenReason}</p> : null}
        </section>
      ) : (
        <iframe
          title={`Student site ${slug}`}
          src={rawUrl}
          sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
          referrerPolicy="no-referrer"
          className={iframeClasses}
          onPointerDown={pauseAutoPlay}
        />
      )}

      {!isPresentMode && showGalleryNav ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm sm:px-4"
          onPointerDown={pauseAutoPlay}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleUserNavigate(currentIndex - 1)}
              disabled={!hasPrev}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => handleUserNavigate(currentIndex + 1)}
              disabled={!hasNext}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
            >
              다음
            </button>
          </div>
          <div className="flex items-center gap-2">
            {endLabel ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                끝
              </span>
            ) : null}
            <span className="text-[11px] font-semibold text-slate-500">
              {counterLabel ?? (isListLoading ? "불러오는 중..." : "")}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
