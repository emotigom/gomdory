"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type { ShareBoard, ShareWall } from "@/lib/data/share";
import type { StudentDefaultView } from "@/lib/data/boardShareSettingsShared";
import EmptyState from "@/app/_components/EmptyState";
import InlineAlert from "@/app/_components/InlineAlert";
import SkeletonBlock from "@/app/_components/SkeletonBlock";
import { buttonTone, cn, hairlineBorderClass, pill, surface, tvText } from "@/app/_components/uiTokens";

import StudentViewModeToggle from "../StudentViewModeToggle";
import { useStudentViewMode } from "../useStudentViewMode";
import { useStudentSafeMode } from "../useStudentSafeMode";
import { FeedCardPreview } from "./components/FeedCardPreview";
import { useFeedData } from "./useFeedData";
import { useFeedCardSize, type FeedCardSize } from "./useFeedCardSize";

type StudentFeedViewProps = {
  board: ShareBoard;
  walls: ShareWall[];
  shareCode: string;
  initialMode?: string | null;
  serverDefaultView?: StudentDefaultView;
};

const PREVIEW_LIMIT = 9;

export default function StudentFeedView({
  board,
  walls,
  shareCode,
  initialMode,
  serverDefaultView,
}: StudentFeedViewProps) {
  const { mode, setMode, hydrated } = useStudentViewMode(shareCode, initialMode, serverDefaultView);
  const { state, reload, loadMore } = useFeedData({ shareCode, limit: PREVIEW_LIMIT });
  const { safeMode, safeHydrated, toggleSafeMode } = useStudentSafeMode();
  const { cardSize, setCardSize, sizeHydrated } = useFeedCardSize(shareCode, safeMode);
  const experienceReady = hydrated && safeHydrated && sizeHydrated;
  const writeLocked = !board.share_write_enabled || board.class_state === "ended";

  const wallMap = useMemo(
    () => new Map(walls.map((wall) => [wall.id, wall] as const)),
    [walls],
  );
  const wallJumpTargets = useMemo(
    () =>
      state.walls.length > 0
        ? state.walls.map(({ wall }) => ({ id: wall.id, title: wall.title }))
        : walls.map((wall) => ({ id: wall.id, title: wall.title })),
    [state.walls, walls],
  );

  const handleJumpToWall = useCallback(
    (wallId: string) => {
      const element = document.getElementById(`wall-section-${wallId}`);
      if (!element) return;
      const behavior: ScrollBehavior = safeMode ? "auto" : "smooth";
      element.scrollIntoView({ behavior, block: "start" });
      element.classList.add("ring-2", "ring-indigo-200", "ring-offset-2");
      window.setTimeout(() => {
        element.classList.remove("ring-2", "ring-indigo-200", "ring-offset-2");
      }, 900);
    },
    [safeMode],
  );

  if (!experienceReady) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-6 w-64" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SkeletonBlock className="h-10 w-32" />
              <SkeletonBlock className="h-10 w-32" />
            </div>
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <SkeletonBlock className="h-5 w-48" />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <SkeletonBlock key={index} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const header = (
    <FeedHeader
      shareCode={shareCode}
      activeMode={mode}
      hydrated={hydrated}
      onModeChange={setMode}
      cardSize={cardSize}
      onCardSizeChange={setCardSize}
      safeMode={safeMode}
      onToggleSafeMode={toggleSafeMode}
    />
  );

  if (mode === "walls") {
    return (
      <div className="space-y-5" data-safe-mode={safeMode ? "true" : "false"}>
        {header}
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">담벼락</p>
              <h2 className="text-2xl font-bold text-gray-900">담벼락 목록</h2>
              <p className="text-sm text-gray-600">총 {walls.length}개</p>
            </div>
            <StudentViewModeToggle
              code={shareCode}
              mode={mode}
              hydrated={hydrated}
              safeMode={safeMode}
              size="lg"
              onModeChange={setMode}
            />
          </div>
          {walls.length === 0 ? (
            <EmptyState
              title="아직 공개된 담벼락이 없어요"
              description="선생님이 열어주실 때까지 기다려주세요."
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {walls.map((wall) => (
                <li key={wall.id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        <Link className="hover:underline" href={`/s/${shareCode}/walls/${wall.id}`}>
                          {wall.title}
                        </Link>
                      </h3>
                      <span className="text-[11px] text-gray-500">
                        {new Date(wall.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    {wall.description ? (
                      <p className="text-sm leading-6 text-gray-700">{wall.description}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="space-y-5" data-safe-mode={safeMode ? "true" : "false"}>
        {header}
        {[...Array(2)].map((_, index) => (
          <div
            key={index}
            className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <SkeletonBlock className="h-5 w-48" />
                <SkeletonBlock className="h-4 w-64" />
              </div>
              <SkeletonBlock className="h-9 w-24" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(4)].map((_, cardIndex) => (
                <SkeletonBlock key={cardIndex} className="h-36 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="space-y-5" data-safe-mode={safeMode ? "true" : "false"}>
        {header}
        <InlineAlert
          tone="error"
          title="전체 펼쳐보기를 불러오지 못했습니다."
          description={state.error}
          action={
            <button
              type="button"
              onClick={() => reload()}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              다시 시도
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-safe-mode={safeMode ? "true" : "false"}>
      {header}
      <FeedWallJump walls={wallJumpTargets} onJump={handleJumpToWall} safeMode={safeMode} />
      {state.walls.length === 0 ? (
        <EmptyState
          title="아직 공개된 담벼락이 없어요"
          description="선생님이 열어주실 때까지 기다려주세요."
        />
      ) : (
        state.walls.map((group) => {
          const originalWall = wallMap.get(group.wall.id);
          if (!originalWall) return null;
          const hasMore = Boolean(group.nextCursor);
          const remaining = Math.max(0, (group.totalCount ?? 0) - group.cards.length);
          return (
            <section
              key={group.wall.id}
              id={`wall-section-${group.wall.id}`}
              className={cn(
                "scroll-mt-32 space-y-4 px-5 py-6",
                surface.card,
                "border-2 border-gray-200 shadow-sm",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">담벼락</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">{originalWall.title}</h2>
                    {writeLocked ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        읽기 전용
                      </span>
                    ) : null}
                  </div>
                  {originalWall.description ? (
                    <p className="max-w-3xl text-base leading-7 text-gray-700">
                      {originalWall.description}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/s/${shareCode}/walls/${group.wall.id}`}
                  className={buttonTone("secondary", { size: "sm" })}
                >
                  더보기
                </Link>
              </div>
              {group.cards.length === 0 ? (
                <EmptyState
                  title="아직 카드가 없어요"
                  description="선생님이 열어주실 때까지 기다려주세요."
                />
              ) : (
                <div
                  className={
                    cardSize === "large"
                      ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-2"
                      : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                  }
                >
                  {group.cards.map((card) => (
                    <FeedCardPreview
                      key={card.id}
                      card={card}
                      shareCode={shareCode}
                      wallId={group.wall.id}
                      cardSize={cardSize}
                      safeMode={safeMode}
                    />
                  ))}
                </div>
              )}
              {state.wallErrors?.[group.wall.id] ? (
                <WallErrorPanel
                  message={state.wallErrors[group.wall.id] ?? undefined}
                  onRetry={() => loadMore(group.wall.id)}
                />
              ) : null}
              {hasMore ? (
                <LoadMoreRow
                  remaining={remaining}
                  loading={group.loadingMore}
                  onLoadMore={() => loadMore(group.wall.id)}
                />
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}

function FeedHeader({
  shareCode,
  activeMode,
  hydrated,
  onModeChange,
  cardSize,
  onCardSizeChange,
  safeMode,
  onToggleSafeMode,
}: {
  shareCode: string;
  activeMode: "walls" | "feed";
  hydrated: boolean;
  onModeChange: (mode: "walls" | "feed") => void;
  cardSize: FeedCardSize;
  onCardSizeChange: (size: FeedCardSize) => void;
  safeMode: boolean;
  onToggleSafeMode: (next?: boolean) => void;
}) {
  const [controlsOpen, setControlsOpen] = useState(false);

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <StudentViewModeToggle
        code={shareCode}
        mode={activeMode}
        hydrated={hydrated}
        safeMode={safeMode}
        size="lg"
        onModeChange={onModeChange}
      />
      {activeMode === "feed" ? (
        <CardSizeToggle value={cardSize} onChange={onCardSizeChange} safeMode={safeMode} />
      ) : null}
      <SafeModeToggleChip enabled={safeMode} onToggle={onToggleSafeMode} />
    </div>
  );

  return (
    <div className={cn(surface.card, "p-5", hairlineBorderClass)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className={cn(tvText.kicker, "text-gray-500")}>학생 피드</p>
          <h1 className={cn(tvText.heading, "text-2xl")}>
            {activeMode === "feed" ? "모든 담벼락을 한눈에" : "담벼락 목록"}
          </h1>
          <p className={cn(tvText.caption, "text-gray-600")}>
            벽별 보기와 피드를 자유롭게 전환하고, 카드 크기를 조절해 더 크게 볼 수 있어요.
          </p>
        </div>
        {safeMode ? (
          <button
            type="button"
            onClick={() => setControlsOpen(true)}
            className={buttonTone("secondary", { size: "sm" })}
          >
            보기 설정 열기
          </button>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">{controls}</div>
        )}
      </div>
      {safeMode ? (
        <ControlsOverlay open={controlsOpen} onClose={() => setControlsOpen(false)}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">보기 설정</h3>
              <p className="text-sm text-gray-600">필요할 때만 열리는 안전한 설정 패널이에요.</p>
            </div>
            <button
              type="button"
              onClick={() => setControlsOpen(false)}
              className="rounded-full border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              aria-label="설정 닫기"
            >
              닫기
            </button>
          </div>
          {controls}
        </ControlsOverlay>
      ) : null}
    </div>
  );
}

function CardSizeToggle({
  value,
  onChange,
  safeMode,
}: {
  value: FeedCardSize;
  onChange: (size: FeedCardSize) => void;
  safeMode: boolean;
}) {
  return (
    <div
      className={`inline-flex rounded-full border ${safeMode ? "border-gray-300 bg-gray-50" : "border-gray-200 bg-white"} p-1 shadow-sm`}
    >
      <CardSizeButton
        active={value === "default"}
        label="기본"
        onClick={() => onChange("default")}
        safeMode={safeMode}
      />
      <CardSizeButton
        active={value === "large"}
        label="크게"
        onClick={() => onChange("large")}
        safeMode={safeMode}
      />
    </div>
  );
}

function CardSizeButton({
  active,
  label,
  onClick,
  safeMode,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  safeMode: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[88px] rounded-full px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        active
          ? "bg-gray-900 text-white shadow"
          : safeMode
            ? "text-gray-800 hover:bg-gray-100"
            : "text-gray-700 hover:bg-gray-50"
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function SafeModeToggleChip({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (next?: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      className={cn(
        buttonTone(enabled ? "primary" : "secondary", {
          size: "sm",
          tone: enabled ? "slate" : "neutral",
        }),
        "inline-flex items-center gap-2",
      )}
      aria-pressed={enabled}
    >
      <span className="text-base" aria-hidden>
        {enabled ? "🛡️" : "🌗"}
      </span>
      {enabled ? "Safe Mode ON" : "Safe Mode"}
    </button>
  );
}

function ControlsOverlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6 backdrop-blur"
      onClick={onClose}
    >
      <div
        className={cn("w-full max-w-2xl p-5", surface.overlay)}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function FeedWallJump({
  walls,
  onJump,
  safeMode,
}: {
  walls: { id: string; title: string }[];
  onJump: (wallId: string) => void;
  safeMode: boolean;
}) {
  if (!walls.length) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-3 ${
        safeMode ? "border-gray-300 bg-gray-50" : "border-gray-200 bg-white"
      }`}
    >
      <span className="text-sm font-semibold text-gray-800">벽 빠른 점프</span>
      <div className="flex flex-wrap gap-2">
        {walls.map((wall) => (
          <button
            key={wall.id}
            type="button"
            onClick={() => onJump(wall.id)}
            className={cn(pill.badge, "border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400")}
          >
            {wall.title}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadMoreRow({
  remaining,
  loading,
  onLoadMore,
}: {
  remaining: number;
  loading?: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
      <span>
        카드 {Math.min(PREVIEW_LIMIT, remaining)}개 더 보기
        {remaining > PREVIEW_LIMIT ? ` (총 ${remaining}개 남음)` : ""}
      </span>
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        className={buttonTone("primary", { size: "sm", tone: "slate" })}
      >
        {loading ? "조용히 불러오는 중..." : "더 불러오기"}
      </button>
    </div>
  );
}

function WallErrorPanel({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-3 text-sm text-rose-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">담벼락을 불러오지 못했어요</p>
          {message ? <p className="text-[13px] text-rose-700">{message}</p> : null}
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-50"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
