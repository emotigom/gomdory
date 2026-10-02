"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/app/_components/uiTokens";
import { boardBoardHref } from "@/lib/dashboard/boardHrefs";
import { getDemoBoards } from "@/lib/demo/demoBoards";
import { useDemoMode } from "@/lib/demo/demoMode";
import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { enterFullscreen, exitFullscreen, isFullscreen } from "@/lib/ui/fullscreen";
import { usePrefersReducedMotion } from "@/lib/ui/motion";

import { useDashboardBoards } from "../useDashboardBoards";
import { pushDashboardToast } from "../useDashboardToast";
import { GalleryBackground } from "./_components/GalleryBackground";
import { GalleryGrid } from "./_components/GalleryGrid";

type GalleryTile = {
  id: string;
  source: "board" | "demo";
  title: string;
  description: string;
  subtitle?: string;
  shareCode?: string | null;
  badge?: string;
  tag?: string;
  coverMark: string;
  coverLabel: string;
  coverTone: "accent" | "success" | "warning" | "ink";
  actions: {
    label: string;
    href?: string;
    tone?: "primary" | "secondary" | "ghost";
    target?: string;
    onClick?: () => void;
    disabled?: boolean;
  }[];
};

const AUTOPLAY_INTERVAL_MS = 7000;
const AUTOPLAY_PAUSE_MS = 10000;

function boardCover(viewType: string | null | undefined, index: number) {
  if (viewType === "wall") {
    return { coverMark: "담", coverLabel: "담벼락", coverTone: "warning" as const };
  }
  if (viewType === "mindmap") {
    return { coverMark: "맵", coverLabel: "마인드맵", coverTone: "success" as const };
  }
  if (viewType === "gen") {
    return { coverMark: "AI", coverLabel: "생성 보드", coverTone: "accent" as const };
  }
  return {
    coverMark: String(index + 1).padStart(2, "0"),
    coverLabel: "수업 보드",
    coverTone: "ink" as const,
  };
}

function formatBoardTimestamp(value?: string) {
  if (!value) return "날짜 미기록";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 미기록";
  return `만든 날 ${date.toLocaleDateString("ko-KR")}`;
}

function mapBoardsToTiles(
  boards: ReturnType<typeof useDashboardBoards>["boards"],
  options: { onLaunch: (boardId: string) => void; launchingId: string | null },
): GalleryTile[] {
  return boards.map((board, index) => {
    const cover = boardCover(board.board_view_type, index);
    const shareCode = board.shareCode ?? null;
    const isLaunching = options.launchingId === board.boardId;
    const launchPending = options.launchingId !== null;

    return {
      id: board.boardId,
      source: "board" as const,
      title: board.title,
      description: board.description ?? "보드를 펼쳐보세요.",
      subtitle: formatBoardTimestamp(board.created_at),
      shareCode,
      badge: "내 보드",
      tag: cover.coverLabel,
      ...cover,
      actions: [
        {
          label: isLaunching ? "수업 여는 중…" : "수업 시작",
          onClick: () => options.onLaunch(board.boardId),
          tone: "primary",
          disabled: launchPending,
        },
        { label: "보드 열기", href: boardBoardHref(board.boardId), tone: "secondary" },
      ],
    };
  });
}

function mapDemoToTiles(): GalleryTile[] {
  const tones: GalleryTile["coverTone"][] = ["accent", "success", "warning", "ink"];
  return getDemoBoards().map((demo, index) => ({
    id: demo.id,
    source: "demo" as const,
    title: demo.title,
    description: demo.description,
    subtitle: "샘플 작품",
    shareCode: null,
    badge: "샘플",
    tag: demo.tag,
    coverMark: demo.title.trim().slice(0, 1) || "곰",
    coverLabel: demo.tag ?? "샘플 수업",
    coverTone: tones[index % tones.length] ?? "accent",
    actions: [
      { label: "새 보드 만들기", href: "/dashboard?clean=1", tone: "primary" },
      { label: "체험 안내", href: "/dashboard?onboarding=1", tone: "secondary" },
    ],
  }));
}

function controlClass(active: boolean, tvEnabled: boolean) {
  return cn(
    "inline-flex min-h-12 items-center justify-center rounded-[4px] border-2 border-[var(--theme-border-strong)] px-4 text-sm font-black transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)]",
    active
      ? "bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-[3px_3px_0_var(--theme-border-strong)]"
      : "bg-[var(--theme-surface)] text-[var(--theme-text)] shadow-[3px_3px_0_var(--theme-border)] hover:-translate-y-0.5 hover:bg-[var(--theme-surface-muted)] hover:shadow-[4px_4px_0_var(--theme-border-strong)]",
    tvEnabled ? "min-h-14 px-5 text-base" : "",
  );
}

type GalleryClientProps = {
  tvMode: boolean;
  demoMode: boolean;
};

export default function GalleryClient({ tvMode, demoMode }: GalleryClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { boards, pinnedIds } = useDashboardBoards();
  const { demoMode: demoEnabled, toggleDemoMode } = useDemoMode(demoMode);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [tvEnabled, setTvEnabled] = useState(tvMode);
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const galleryRootRef = useRef<HTMLDivElement | null>(null);
  const pauseUntilRef = useRef(0);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const tvParamValue = searchParams?.get("tv");
  const tvFromParams = tvParamValue === null ? null : tvParamValue === "1" || tvParamValue === "true";

  useEffect(() => {
    setTvEnabled(tvFromParams ?? tvMode);
  }, [tvFromParams, tvMode]);

  const orderedBoards = useMemo(() => {
    const pinned = boards.filter((board) => pinnedIds.includes(board.boardId));
    const unpinned = boards.filter((board) => !pinnedIds.includes(board.boardId));
    return [...pinned, ...unpinned];
  }, [boards, pinnedIds]);

  const handleLaunch = useCallback(
    (boardId: string) => {
      if (launchingId !== null) return;
      setLaunchingId(boardId);
      void (async () => {
        try {
          const response = await apiFetch(apiV1Path(`boards/${boardId}/launch`), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ intent: "class", source: "gallery" }),
          });
          const payload = (await response.json().catch(() => null)) as
            | { ok?: boolean; action?: { href?: string } }
            | null;
          if (!response.ok || !payload?.ok || !payload.action?.href) {
            throw new Error("수업 시작 요청이 실패했습니다.");
          }
          router.push(payload.action.href);
        } catch (error) {
          const message = error instanceof Error ? error.message : "수업 시작에 실패했습니다.";
          pushDashboardToast({ title: "수업 시작 실패", description: message });
        } finally {
          setLaunchingId((previous) => (previous === boardId ? null : previous));
        }
      })();
    },
    [launchingId, router],
  );

  const baseTiles = useMemo(
    () => mapBoardsToTiles(orderedBoards, { onLaunch: handleLaunch, launchingId }),
    [handleLaunch, launchingId, orderedBoards],
  );
  const demoTiles = useMemo(() => mapDemoToTiles().slice(0, 8), []);
  const shouldShowDemoTiles = demoEnabled && baseTiles.length === 0;
  const combinedTiles = useMemo<GalleryTile[]>(
    () => (shouldShowDemoTiles ? demoTiles : baseTiles),
    [baseTiles, demoTiles, shouldShowDemoTiles],
  );

  useEffect(() => {
    setSpotlightIndex((previous) => (combinedTiles.length ? previous % combinedTiles.length : 0));
  }, [combinedTiles.length]);

  useEffect(() => {
    if (combinedTiles.length < 2) setAutoplayEnabled(false);
  }, [combinedTiles.length]);

  useEffect(() => {
    if (!autoplayEnabled || combinedTiles.length < 2) return;
    const activeCard = galleryRootRef.current?.querySelector<HTMLElement>(
      `[data-gallery-tile-index="${spotlightIndex}"]`,
    );
    activeCard?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [autoplayEnabled, combinedTiles.length, prefersReducedMotion, spotlightIndex]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => setFullscreenActive(isFullscreen());
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const handleFullscreen = useCallback(async () => {
    const galleryRoot = galleryRootRef.current;
    const ok = fullscreenActive
      ? await exitFullscreen()
      : galleryRoot
        ? await enterFullscreen(galleryRoot)
        : false;
    if (!ok) {
      pushDashboardToast({
        title: "전체화면을 시작하지 못했어요",
        description: "브라우저 전체화면 권한을 확인해 주세요.",
      });
    }
  }, [fullscreenActive]);

  const updateQueryFlag = useCallback(
    (key: string, enabled: boolean) => {
      const params = new URLSearchParams(searchParams?.toString());
      if (enabled) {
        params.set(key, "1");
      } else {
        params.delete(key);
      }
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleTvToggle = () => {
    const next = !tvEnabled;
    setTvEnabled(next);
    updateQueryFlag("tv", next);
  };

  const handleAutoplayToggle = useCallback(() => {
    setAutoplayEnabled((previous) => !previous);
  }, []);

  const pauseAutoplay = useCallback(() => {
    pauseUntilRef.current = Date.now() + AUTOPLAY_PAUSE_MS;
  }, []);

  useEffect(() => {
    if (!autoplayEnabled || combinedTiles.length === 0) return;
    const interval = window.setInterval(() => {
      if (Date.now() < pauseUntilRef.current) return;
      setSpotlightIndex((previous) => (previous + 1) % combinedTiles.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [autoplayEnabled, combinedTiles.length]);

  useEffect(() => {
    if (!autoplayEnabled) return;
    const handleInput = () => pauseAutoplay();
    window.addEventListener("pointerdown", handleInput);
    window.addEventListener("keydown", handleInput);
    return () => {
      window.removeEventListener("pointerdown", handleInput);
      window.removeEventListener("keydown", handleInput);
    };
  }, [autoplayEnabled, pauseAutoplay]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const activeElement = document.activeElement as HTMLElement | null;
      if (target?.isContentEditable || activeElement?.isContentEditable) return;
      const tag = target?.tagName?.toLowerCase();
      const activeTag = activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void handleFullscreen();
      }
      if (event.key.toLowerCase() === "d" && baseTiles.length === 0) {
        event.preventDefault();
        toggleDemoMode();
      }
      if (event.key.toLowerCase() === "a" && combinedTiles.length > 1) {
        event.preventDefault();
        handleAutoplayToggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [baseTiles.length, combinedTiles.length, handleAutoplayToggle, handleFullscreen, toggleDemoMode]);

  const boardCountLabel = shouldShowDemoTiles
    ? `샘플 ${combinedTiles.length}개`
    : baseTiles.length
      ? `${baseTiles.length}개`
      : "0개";

  return (
    <div
      ref={galleryRootRef}
      data-gallery-workshop-surface
      data-gallery-tv={tvEnabled ? "on" : "off"}
      className="relative min-h-[calc(100vh-72px)] overflow-x-hidden overflow-y-auto bg-[var(--theme-bg)] text-[var(--theme-text)] fullscreen:h-screen fullscreen:min-h-screen"
    >
      <GalleryBackground tvMode={tvEnabled} />
      <div className="relative z-10">
        <header
          className={cn(
            "border-b-2 border-[var(--theme-border-strong)] bg-[var(--theme-surface)]",
            tvEnabled ? "px-4 py-7 sm:px-8 lg:px-10" : "px-4 py-6 sm:px-6 lg:px-8",
          )}
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div className="max-w-3xl">
                <p className="inline-flex border-b-4 border-[var(--theme-warning)] pb-1 text-[10px] font-black tracking-[0.16em] text-[var(--theme-text-muted)]">
                  EXHIBITION DESK / 수업 작품
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1
                    className={cn(
                      "font-black leading-none tracking-[-0.06em] text-[var(--theme-text)]",
                      tvEnabled ? "text-[clamp(2.7rem,5vw,5.6rem)]" : "text-[clamp(2.35rem,5vw,4.4rem)]",
                    )}
                  >
                    작품 전시판
                  </h1>
                  <span className="border-2 border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] px-3 py-1 text-xs font-black tabular-nums shadow-[2px_2px_0_var(--theme-border-strong)]">
                    {boardCountLabel}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-4 max-w-2xl font-semibold leading-7 text-[var(--theme-text-muted)]",
                    tvEnabled ? "text-lg sm:text-xl" : "text-sm sm:text-base",
                  )}
                >
                  학생들과 나눌 보드를 골라 수업을 열거나, 화면 가득 작품을 넘겨보세요.
                </p>
              </div>

              <div className="flex flex-wrap gap-2" aria-label="전시 도구" data-gallery-toolbar>
                <button
                  type="button"
                  onClick={handleFullscreen}
                  className={controlClass(fullscreenActive, tvEnabled)}
                  data-interactive="true"
                  aria-pressed={fullscreenActive}
                >
                  {fullscreenActive ? "전체화면 끝내기" : "전체화면"}
                </button>
                <button
                  type="button"
                  onClick={handleTvToggle}
                  className={controlClass(tvEnabled, tvEnabled)}
                  data-interactive="true"
                  aria-pressed={tvEnabled}
                >
                  {tvEnabled ? "발표 화면 끄기" : "발표 화면"}
                </button>
                {shouldShowDemoTiles ? (
                  <button
                    type="button"
                    onClick={toggleDemoMode}
                    className={controlClass(true, tvEnabled)}
                    data-interactive="true"
                    aria-pressed="true"
                  >
                    샘플 닫기
                  </button>
                ) : null}
                {combinedTiles.length > 1 ? (
                  <button
                    type="button"
                    onClick={handleAutoplayToggle}
                    className={controlClass(autoplayEnabled, tvEnabled)}
                    data-interactive="true"
                    aria-pressed={autoplayEnabled}
                  >
                    {autoplayEnabled ? "자동 넘김 멈춤" : "자동 넘김"}
                  </button>
                ) : null}
                <Link
                  href="/dashboard?clean=1"
                  className={controlClass(false, tvEnabled)}
                  data-interactive="true"
                >
                  보드 서랍
                </Link>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-dashed border-[var(--theme-border)] pt-4 text-[11px] font-bold text-[var(--theme-text-muted)] sm:text-xs">
              <span><kbd className="border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-2 py-1 font-mono text-[var(--theme-text)]">F</kbd> 전체화면</span>
              {baseTiles.length === 0 ? <span><kbd className="border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-2 py-1 font-mono text-[var(--theme-text)]">D</kbd> 샘플 작품</span> : null}
              {combinedTiles.length > 1 ? <span><kbd className="border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-2 py-1 font-mono text-[var(--theme-text)]">A</kbd> 자동 넘김</span> : null}
              {fullscreenActive ? <span className="text-[var(--theme-success)]">화면 가득 전시 중</span> : null}
            </div>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto flex max-w-7xl flex-col pb-14",
            tvEnabled ? "px-4 pt-8 sm:px-8 lg:px-10" : "px-4 pt-7 sm:px-6 lg:px-8",
          )}
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-[var(--theme-border-strong)] pb-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.15em] text-[var(--theme-accent)]">NOW SHOWING</p>
              <h2 className={cn("mt-1 font-black tracking-[-0.04em]", tvEnabled ? "text-4xl" : "text-2xl sm:text-3xl")}>
                오늘의 전시
              </h2>
            </div>
            {shouldShowDemoTiles ? (
              <span className="border-2 border-[var(--theme-border-strong)] bg-[var(--theme-warning)] px-3 py-1 text-xs font-black text-[var(--theme-accent-text)] shadow-[2px_2px_0_var(--theme-border-strong)]">
                샘플 작품 펼침
              </span>
            ) : null}
          </div>

          {combinedTiles.length ? (
            <GalleryGrid
              tiles={combinedTiles}
              tvMode={tvEnabled}
              autoplayEnabled={autoplayEnabled}
              spotlightIndex={spotlightIndex}
            />
          ) : (
            <section className="relative border-2 border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-card)] px-5 py-12 text-center shadow-[7px_7px_0_var(--theme-border)] sm:px-8 sm:py-16">
              <span className="absolute -top-3 left-8 h-6 w-20 -rotate-2 border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] opacity-80" aria-hidden />
              <p className="text-xl font-black tracking-[-0.03em] sm:text-2xl">전시할 보드가 아직 없어요.</p>
              <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-6 text-[var(--theme-text-muted)]">
                샘플 작품을 먼저 펼쳐보거나 첫 보드를 만들어보세요.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={toggleDemoMode}
                  className={controlClass(true, false)}
                  data-interactive="true"
                >
                  샘플 작품 펼치기
                </button>
                <Link
                  href="/dashboard?clean=1"
                  className={controlClass(false, false)}
                  data-interactive="true"
                >
                  첫 보드 만들기
                </Link>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
