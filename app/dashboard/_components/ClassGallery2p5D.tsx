"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent,
} from "react";

import { buttonTone, cn, pill } from "@/app/_components/uiTokens";
import { getStudentUrl } from "@/lib/share/shareUrls";
import { boardBoardHref, boardHubHref } from "@/lib/dashboard/boardHrefs";
import type { ShareLinkInfo } from "../shareLinks";
import { pushDashboardToast } from "../useDashboardToast";

type ClassGalleryItem = {
  boardId: string;
  title: string;
  shareCode?: string | null;
  heroFileId?: string | null;
  updatedAt?: string | null;
  pinned?: boolean;
};

type ClassGallery2p5DProps = {
  items: ClassGalleryItem[];
  ensuredShareLinks?: Record<string, ShareLinkInfo | null>;
  onCreate: () => void;
};

function usePrefersReducedMotion() {
  const prefers = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      prefers.current = media.matches;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefers;
}

function resolveHeroUrl(heroFileId?: string | null) {
  if (!heroFileId) return null;
  if (heroFileId.startsWith("/") || heroFileId.startsWith("http")) {
    return heroFileId;
  }
  return apiV1Path(`files/${heroFileId}/thumb?size=640`);
}

function formatUpdatedAt(updatedAt?: string | null) {
  if (!updatedAt) return null;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ClassGallery2p5D({ items, ensuredShareLinks, onCreate }: ClassGallery2p5DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestRef = useRef<{
    target: HTMLElement;
    x: number;
    y: number;
  } | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const mostRecentId = useMemo(() => {
    const withUpdated = items
      .map((item) => ({ item, timestamp: item.updatedAt ? new Date(item.updatedAt).getTime() : 0 }))
      .filter((entry) => Number.isFinite(entry.timestamp) && entry.timestamp > 0);
    if (!withUpdated.length) return null;
    withUpdated.sort((a, b) => b.timestamp - a.timestamp);
    return withUpdated[0]?.item.boardId ?? null;
  }, [items]);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (prefersReducedMotion.current) return;
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      latestRef.current = { target, x, y };

      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        const latest = latestRef.current;
        if (!latest) {
          rafRef.current = null;
          return;
        }
        const rotateX = (-latest.y * 4).toFixed(2);
        const rotateY = (latest.x * 4).toFixed(2);
        latest.target.style.setProperty("--tilt-x", `${rotateX}deg`);
        latest.target.style.setProperty("--tilt-y", `${rotateY}deg`);
        latest.target.style.setProperty("--glow-x", `${(latest.x + 0.5) * 100}%`);
        latest.target.style.setProperty("--glow-y", `${(latest.y + 0.5) * 100}%`);
        rafRef.current = null;
      });
    },
    [prefersReducedMotion],
  );

  const handlePointerLeave = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    target.style.setProperty("--tilt-x", "0deg");
    target.style.setProperty("--tilt-y", "0deg");
    target.style.setProperty("--glow-x", "50%");
    target.style.setProperty("--glow-y", "50%");
  }, []);

  const handleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenEnabled || !containerRef.current) {
      pushDashboardToast({
        title: "전체화면이 지원되지 않습니다",
        description: "TV에서는 F11 키로 전체화면을 열 수 있어요.",
      });
      return;
    }

    try {
      await containerRef.current.requestFullscreen();
    } catch {
      pushDashboardToast({
        title: "전체화면 전환 실패",
        description: "브라우저 설정을 확인하거나 F11 키를 사용해 주세요.",
      });
    }
  }, []);

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleFullscreen}
        data-interactive="true"
        className={buttonTone("secondary", { size: "sm" })}
      >
        TV 전체화면
      </button>
      <button
        type="button"
        onClick={onCreate}
        data-interactive="true"
        className={buttonTone("primary", { size: "sm", tone: "emerald" })}
      >
        새 보드
      </button>
    </div>
  );

  return (
    <section ref={containerRef} className="space-y-4" aria-label="Class Gallery">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">Class Gallery</p>
          <h2 className="text-2xl font-semibold text-slate-900">수업이 바로 보이는 2.5D 갤러리</h2>
          <p className="text-sm text-slate-600">고정/최근 보드를 한눈에 확인하고 CTA로 바로 진입하세요.</p>
        </div>
        {headerActions}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const heroUrl = resolveHeroUrl(item.heroFileId ?? null);
          const shareInfo = ensuredShareLinks?.[item.boardId] ?? null;
          const shareUrl = shareInfo?.shareUrl ?? (item.shareCode ? getStudentUrl(item.shareCode) : null);
          const updatedLabel = formatUpdatedAt(item.updatedAt ?? null);
          const badge = item.pinned
            ? "고정 클래스"
            : item.boardId === mostRecentId
              ? "방금 쓴 보드"
              : "최근 수업";

          const baseActions = [
            { label: "수업 시작", href: boardBoardHref(item.boardId) },
            { label: "보드 열기", href: boardHubHref(item.boardId) },
            { label: "공유", href: shareUrl },
          ];

          return (
            <div
              key={item.boardId}
              data-interactive="false"
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              className={cn(
                "group relative min-h-[220px] overflow-hidden rounded-[26px] border border-white/40 bg-slate-900 text-white",
                "shadow-[0_26px_90px_-48px_rgba(15,23,42,0.75)] transition-transform duration-300",
              )}
              style={
                {
                  transform: "perspective(900px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y))",
                  transformStyle: "preserve-3d",
                  ["--tilt-x" as string]: "0deg",
                  ["--tilt-y" as string]: "0deg",
                  ["--glow-x" as string]: "50%",
                  ["--glow-y" as string]: "50%",
                } as CSSProperties
              }
            >
              <div
                className="absolute inset-0 opacity-90"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.85) 48%, rgba(15,118,110,0.7) 100%)",
                }}
              />
              <div
                className={cn(
                  "absolute inset-0 bg-cover bg-center transition-opacity duration-500",
                  heroUrl ? "opacity-35" : "opacity-0",
                )}
                style={heroUrl ? { backgroundImage: `url(${heroUrl})` } : undefined}
                aria-hidden
              />
              <div
                className="absolute inset-0 opacity-80"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at var(--glow-x) var(--glow-y), rgba(255,255,255,0.2), rgba(255,255,255,0) 55%)",
                }}
                aria-hidden
              />
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                  backgroundSize: "36px 36px",
                }}
                aria-hidden
              />

              <div
                className="relative z-10 flex h-full flex-col justify-between gap-6 p-5"
                style={{ transform: "translateZ(24px)" }}
              >
                <div className="pointer-events-none space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        pill.badge,
                        "border border-white/20 bg-white/10 text-[11px] font-semibold text-white",
                      )}
                    >
                      {badge}
                    </span>
                    {updatedLabel ? (
                      <span className="text-[11px] font-medium text-emerald-100/90">{updatedLabel}</span>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-white line-clamp-2">{item.title}</h3>
                    <p className="text-xs text-emerald-100/80">TV에서도 또렷하게 보이는 카드 프리뷰</p>
                  </div>
                </div>

                <div
                  className="pointer-events-auto grid grid-cols-2 gap-2"
                  data-interactive="true"
                >
                  {baseActions.map((action) =>
                    action.href ? (
                      <Link
                        key={action.label}
                        href={action.href}
                        prefetch={false}
                        data-interactive="true"
                        className={cn(
                          "inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/15 px-3 text-xs font-semibold",
                          action.label === "수업 시작"
                            ? "bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                            : action.label === "보드 열기"
                              ? "bg-white/15 text-white hover:bg-white/25"
                              : "bg-slate-900/50 text-white/80 hover:bg-slate-900/70",
                        )}
                      >
                        {action.label}
                      </Link>
                    ) : (
                      <button
                        key={action.label}
                        type="button"
                        disabled
                        className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/10 px-3 text-xs font-semibold text-white/40"
                      >
                        {action.label}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
