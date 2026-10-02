"use client";

import Image from "next/image";
import Link from "next/link";
import type { PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GalleryItem } from "@/lib/gallery/getClassGalleryItems";

import { createGalleryHotkeyHandler } from "./galleryHotkeys";

type ViewMode = "mixed" | "clips" | "boards";

type GalleryClientProps = {
  items: GalleryItem[];
  fallbackItems: GalleryItem[];
  classTitle: string;
  classId: string;
  demoMode: boolean;
};

const MAX_VISIBLE = 7;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function useReducedMotionPref(): [boolean, (next: boolean) => void] {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("class-gallery-reduced-motion");
    if (stored === "true") {
      setReduced(true);
      return;
    }
    if (stored === "false") {
      setReduced(false);
      return;
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const update = useCallback((next: boolean) => {
    setReduced(next);
    localStorage.setItem("class-gallery-reduced-motion", next ? "true" : "false");
  }, []);

  return [reduced, update];
}

function useFullscreenState() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggle = useCallback((element?: HTMLElement | null) => {
    if (!element) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      element.requestFullscreen().catch(() => undefined);
    }
  }, []);

  return { isFullscreen, toggle };
}

function deriveCoverPalette(key: string | null | undefined): {
  background: string;
  accent: string;
} {
  if (!key) {
    return { background: "bg-gradient-to-br from-slate-800 to-slate-900", accent: "text-indigo-300" };
  }
  const palettes = [
    { background: "bg-gradient-to-br from-indigo-900/80 via-slate-900 to-slate-950", accent: "text-indigo-200" },
    { background: "bg-gradient-to-br from-emerald-800/80 via-slate-900 to-slate-950", accent: "text-emerald-200" },
    { background: "bg-gradient-to-br from-amber-800/80 via-slate-900 to-slate-950", accent: "text-amber-100" },
    { background: "bg-gradient-to-br from-cyan-800/80 via-slate-900 to-slate-950", accent: "text-cyan-200" },
    { background: "bg-gradient-to-br from-rose-800/80 via-slate-900 to-slate-950", accent: "text-rose-100" },
    { background: "bg-gradient-to-br from-purple-800/80 via-slate-900 to-slate-950", accent: "text-purple-200" },
  ];
  const index = Math.abs(Array.from(key).reduce((sum, char) => sum + char.charCodeAt(0), 0)) % palettes.length;
  return palettes[index] ?? palettes[0];
}

function EmptyState({
  demoMode,
  classId,
}: {
  demoMode: boolean;
  classId: string;
}) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-3xl border border-slate-800/60 bg-slate-900/50 px-8 py-10 text-center shadow-2xl shadow-slate-950/40">
      <div className="rounded-full bg-indigo-500/10 px-4 py-1 text-sm font-semibold text-indigo-200">
        갤러리 준비중
      </div>
      <p className="text-balance text-lg font-semibold text-slate-50">
        첫 수업을 시작하면 갤러리가 자동으로 채워져요.
      </p>
      <p className="text-pretty text-sm text-slate-300">
        보드에서 수업을 열고 클립을 만들면 이 공간에 전시처럼 정리됩니다. 큰 화면에서도 편하게 살펴볼 수 있어요.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/dashboard/classes/${classId}/launch`}
          className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-400/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
        >
          수업 시작 (Launchpad)
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-400/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
        >
          보드 관리로 이동
        </Link>
      </div>
      {demoMode ? (
        <p className="text-xs text-slate-400">demo=1 모드에선 샘플 프레임으로 무대를 가득 채웠어요.</p>
      ) : null}
    </div>
  );
}

function FrameCard({
  item,
  active,
  dimmed,
  reducedMotion,
  onPrimary,
  onSecondary,
  setActive,
}: {
  item: GalleryItem;
  active: boolean;
  dimmed: boolean;
  reducedMotion: boolean;
  onPrimary: (href: string) => void;
  onSecondary?: (href: string) => void;
  setActive: () => void;
}) {
  const palette = deriveCoverPalette(item.coverKey ?? item.id);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (active && buttonRef.current) {
      buttonRef.current.focus({ preventScroll: true });
    }
  }, [active]);

  return (
    <div
      role="option"
      aria-selected={active}
      onMouseEnter={setActive}
      className={cx(
        "group relative w-[360px] max-w-full cursor-default select-none overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/80 p-4 shadow-2xl shadow-slate-900/70",
        dimmed ? "opacity-70" : "opacity-100",
        reducedMotion ? "transition-opacity" : "transition-all duration-500 ease-out",
        active ? "ring-2 ring-indigo-400/80" : "ring-0",
      )}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-950/60">
        <div className="relative aspect-video w-full overflow-hidden">
          {item.thumbUrl ? (
            <Image
              src={item.thumbUrl}
              loading="lazy"
              alt=""
              fill
              sizes="360px"
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={cx(
                "flex h-full w-full flex-col items-center justify-center gap-2 text-center text-sm font-semibold",
                palette.background,
                palette.accent,
              )}
            >
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-100/70">
                {item.type === "clip" ? "Clip" : item.type === "board" ? "Board" : "Session"}
              </span>
              <span className="px-4 text-balance text-base text-white/90">{item.title}</span>
              <span className="text-xs text-white/70">{item.subtitle}</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
        </div>
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
            <span className="rounded-full bg-slate-800/60 px-3 py-1 text-[11px] font-semibold text-slate-200">
              {item.type === "clip" ? "클립" : item.type === "board" ? "보드" : "세션"}
            </span>
            <span className="text-slate-500">{item.subtitle}</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-50 line-clamp-2">{item.title}</h3>
            {item.thumbUrl ? null : (
              <p className="text-sm text-slate-300 line-clamp-2">
                갤러리 커버 이미지를 준비 중입니다. 텍스트 커버로 미리보기 중.
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              ref={buttonRef}
              type="button"
              onClick={() => onPrimary(item.primaryHref)}
              className="flex-1 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-200 hover:shadow-indigo-400/40"
            >
              {item.primaryLabel ?? "열기"}
            </button>
            {item.secondaryHref ? (
              <button
                type="button"
                onClick={() => onSecondary?.(item.secondaryHref!)}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-indigo-400/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-200"
              >
                {item.secondaryLabel ?? "자세히"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GalleryClient({ items, fallbackItems, classTitle, classId, demoMode }: GalleryClientProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("mixed");
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [headerPinned, setHeaderPinned] = useState(true);
  const [reducedMotion, setReducedMotion] = useReducedMotionPref();
  const { isFullscreen, toggle } = useFullscreenState();
  const scrollHideTimer = useRef<NodeJS.Timeout | null>(null);

  const filteredItems = useMemo(() => {
    const base = items.length ? items : demoMode ? fallbackItems : [];
    const normalizedSearch = search.trim().toLowerCase();
    const byMode = base.filter((item) => {
      if (viewMode === "mixed") return true;
      if (viewMode === "clips") return item.type === "clip";
      return item.type === "board" || item.type === "session";
    });
    if (!normalizedSearch) return byMode;
    return byMode.filter((item) =>
      [item.title, item.subtitle].some((text) => text.toLowerCase().includes(normalizedSearch)),
    );
  }, [items, fallbackItems, search, viewMode, demoMode]);

  useEffect(() => {
    if (activeIndex >= filteredItems.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, filteredItems.length]);

  const visibleItems = useMemo(() => {
    if (filteredItems.length === 0) return [];
    if (filteredItems.length <= MAX_VISIBLE) {
      return filteredItems.map((item, index) => ({ item, index, offset: index - activeIndex }));
    }
    const windowRadius = 3;
    const frames = [] as Array<{ item: GalleryItem; index: number; offset: number }>;
    for (let offset = -windowRadius; offset <= windowRadius; offset += 1) {
      const index = (activeIndex + offset + filteredItems.length) % filteredItems.length;
      frames.push({ item: filteredItems[index]!, index, offset });
    }
    return frames;
  }, [filteredItems, activeIndex]);

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : prev));
  }, [filteredItems.length]);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : prev));
  }, [filteredItems.length]);

  const handleActivate = useCallback(() => {
    const active = filteredItems[activeIndex];
    if (active) {
      window.location.href = active.primaryHref;
    }
  }, [activeIndex, filteredItems]);

  const hotkeyHandler = useMemo(
    () =>
      createGalleryHotkeyHandler({
        onPrev: handlePrev,
        onNext: handleNext,
        onActivate: handleActivate,
        onFullscreenToggle: () => toggle(stageRef.current),
      }),
    [handlePrev, handleNext, handleActivate, toggle],
  );

  useEffect(() => {
    window.addEventListener("keydown", hotkeyHandler);
    return () => window.removeEventListener("keydown", hotkeyHandler);
  }, [hotkeyHandler]);

  useEffect(() => {
    if (!isFullscreen) {
      setHeaderPinned(true);
      return undefined;
    }
    const onMove = () => {
      setHeaderPinned(true);
      if (scrollHideTimer.current) {
        clearTimeout(scrollHideTimer.current);
      }
      scrollHideTimer.current = setTimeout(() => setHeaderPinned(false), 1600);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onMove);
    onMove();
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
      if (scrollHideTimer.current) {
        clearTimeout(scrollHideTimer.current);
      }
    };
  }, [isFullscreen]);

  const handlePrimary = useCallback((href: string) => {
    window.location.href = href;
  }, []);

  const handleSecondary = useCallback((href: string) => {
    window.location.href = href;
  }, []);

  const onSwipe = useCallback(
    (deltaX: number) => {
      if (Math.abs(deltaX) < 40) return;
      if (deltaX > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    },
    [handlePrev, handleNext],
  );

  const pointerState = useRef<{ startX: number; active: boolean }>({ startX: 0, active: false });

  const stageProps = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      pointerState.current = { startX: event.clientX, active: true };
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      if (!pointerState.current.active) return;
      const delta = event.clientX - pointerState.current.startX;
      pointerState.current.active = false;
      onSwipe(delta);
    },
    onPointerCancel: () => {
      pointerState.current.active = false;
    },
  };

  return (
    <div
      className={cx(
        "flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50",
        isFullscreen ? "text-lg" : "text-base",
      )}
      data-class-gallery-fullscreen={isFullscreen ? "1" : "0"}
    >
      <div
        className={cx(
          "sticky top-0 z-20 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/80 px-6 py-3 backdrop-blur",
          isFullscreen ? "transition-opacity duration-500" : "",
          isFullscreen && !headerPinned ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.08em] text-slate-400">
            <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-200">Gallery</span>
            <span className="text-slate-300">{classTitle}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggle(stageRef.current)}
            className="rounded-full border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-indigo-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
          >
            TV 풀스크린
          </button>
          <button
            type="button"
            onClick={() => setReducedMotion(!reducedMotion)}
            className={cx(
              "rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300",
              reducedMotion
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                : "border-slate-700 bg-slate-900 text-slate-100 hover:border-indigo-400 hover:text-white",
            )}
            aria-pressed={reducedMotion}
          >
            모션 낮춤 {reducedMotion ? "ON" : "OFF"}
          </button>
          <div className="flex rounded-full border border-slate-800 bg-slate-900/80 p-1 text-xs font-semibold text-slate-200">
            {(
              [
                { key: "mixed" as const, label: "Mixed" },
                { key: "clips" as const, label: "Clips" },
                { key: "boards" as const, label: "Boards" },
              ] satisfies Array<{ key: ViewMode; label: string }>
            ).map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setViewMode(mode.key)}
                className={cx(
                  "rounded-full px-3 py-1.5 transition",
                  viewMode === mode.key
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                    : "text-slate-300 hover:text-white",
                )}
                aria-pressed={viewMode === mode.key}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="제목 검색"
              className="w-40 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">⌕</div>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col" {...stageProps}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.15),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(52,211,153,0.18),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(244,114,182,0.12),transparent_28%)]" />
        <div className="absolute inset-0" ref={stageRef} style={{ perspective: "1600px" }}>
          <div
            className={cx(
              "absolute inset-0 flex items-center justify-center gap-10",
              reducedMotion ? "transition-none" : "transition-transform duration-500 ease-out",
            )}
            style={{ transformStyle: "preserve-3d" }}
          >
            {visibleItems.length === 0 ? (
              <div className="w-full px-4">
                <EmptyState demoMode={demoMode} classId={classId} />
              </div>
            ) : (
              visibleItems.map((frame) => {
                const depth = Math.abs(frame.offset);
                const translateX = frame.offset * 140;
                const translateZ = reducedMotion ? -20 * depth : -80 * depth;
                const rotateY = reducedMotion ? frame.offset * -4 : frame.offset * -12;
                const scale = reducedMotion ? 1 : 1 - Math.min(0.08 * depth, 0.3);
                return (
                  <div
                    key={`${frame.item.id}-${frame.offset}`}
                    style={{
                      transform: `translate3d(${translateX}px, 0, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                      filter: depth >= 3 ? "blur(1.5px)" : undefined,
                    }}
                  >
                    <FrameCard
                      item={frame.item}
                      active={frame.index === activeIndex}
                      dimmed={depth >= 2}
                      reducedMotion={reducedMotion}
                      onPrimary={handlePrimary}
                      onSecondary={handleSecondary}
                      setActive={() => setActiveIndex(frame.index)}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {filteredItems.length ? (
        <div className="flex items-center justify-center gap-3 px-6 py-4 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
            <span>
              {activeIndex + 1}/{filteredItems.length}
            </span>
          </div>
          <div className="rounded-full border border-slate-800/80 px-3 py-1">
            키보드 ←/→, Enter, F 로 제어 · 마우스 스와이프 가능
          </div>
          {demoMode ? <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-indigo-200">Demo</span> : null}
        </div>
      ) : null}
    </div>
  );
}
