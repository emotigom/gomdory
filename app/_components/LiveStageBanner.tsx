"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/app/_components/uiTokens";
import { createBoardBus } from "@/app/dashboard/sessionBus";
import { useLiveSync } from "@/app/_components/useLiveSync";

type LiveStageBannerProps = {
  boardId: string;
  variant: "class" | "share" | "present";
  shareCode?: string | null;
};

const targetLabelMap: Record<"class" | "share" | "present", string> = {
  class: "수업",
  share: "학생",
  present: "발표",
};

const variantStyles = {
  class: {
    shell: "border-emerald-200 bg-emerald-50 text-emerald-900",
    badge: "bg-emerald-100 text-emerald-800",
  },
  share: {
    shell: "border-indigo-200 bg-indigo-50 text-indigo-900",
    badge: "bg-indigo-100 text-indigo-800",
  },
  present: {
    shell: "border-slate-700 bg-slate-900/90 text-white",
    badge: "bg-white/10 text-white",
  },
};

const AUTO_HIDE_MS = 8000;

type BannerEvent = {
  label: string;
  target: "class" | "share" | "present";
  ts: number;
};

const statusLabels = {
  idle: "Live Sync 대기",
  live: "Live Sync 연결됨",
  degraded: "Live Sync 지연",
  offline: "Live Sync 오프라인",
  paused: "라이브 재시도 필요",
};

const statusStyles = {
  idle: "bg-slate-100 text-slate-700",
  live: "bg-emerald-100 text-emerald-800",
  degraded: "bg-amber-100 text-amber-800",
  offline: "bg-rose-100 text-rose-700",
  paused: "bg-rose-100 text-rose-700",
};

function formatTimeAgo(timestamp: number, now: number) {
  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSeconds < 10) return "방금";
  if (diffSeconds < 60) return `${diffSeconds}초 전`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}시간 전`;
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "종료";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function LiveStageBanner({ boardId, variant, shareCode }: LiveStageBannerProps) {
  const [latestEvent, setLatestEvent] = useState<BannerEvent | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const nudgeRef = useRef<number | null>(null);
  const nudgeTimerRef = useRef<number | null>(null);
  const liveVersionRef = useRef<number | null>(null);
  const isTeacher = variant === "class";
  const { data: liveSnapshot, status: liveStatus, activeSessionId, activeSessionStartedAt, retryLive } = useLiveSync({
    mode: isTeacher ? "teacher" : "viewer",
    boardId,
    shareCode: shareCode ?? undefined,
  });

  const pushEvent = useCallback((event: BannerEvent) => {
    setLatestEvent(event);
    setIsOpen(true);
    setIsExpanded(true);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, AUTO_HIDE_MS);
  }, []);

  useEffect(() => {
    if (!boardId) return;
    const bus = createBoardBus(boardId);
    return bus.subscribe((event) => {
      if (event.type !== "FLOW_RUN" && event.type !== "FLOW_NEXT" && event.type !== "FLOW_PREV") return;
      pushEvent({ label: event.label, target: event.target, ts: event.ts });
    });
  }, [boardId, pushEvent]);

  useEffect(() => {
    if (isTeacher) return;
    if (!liveSnapshot?.label || !liveSnapshot.target) return;
    const version = liveSnapshot.version ?? liveSnapshot.ts;
    if (liveVersionRef.current && version <= liveVersionRef.current) return;
    liveVersionRef.current = version;
    pushEvent({
      label: liveSnapshot.label,
      target: liveSnapshot.target,
      ts: liveSnapshot.ts,
    });
  }, [isTeacher, liveSnapshot, pushEvent]);

  useEffect(() => {
    if (variant !== "share") return;
    const nudgeAt = liveSnapshot?.presenceNudgeAt ?? null;
    if (!nudgeAt) return;
    if (nudgeRef.current && nudgeAt <= nudgeRef.current) return;
    nudgeRef.current = nudgeAt;
    setNudgeOpen(true);
    if (nudgeTimerRef.current) {
      window.clearTimeout(nudgeTimerRef.current);
    }
    nudgeTimerRef.current = window.setTimeout(() => setNudgeOpen(false), 5000);
  }, [liveSnapshot?.presenceNudgeAt, variant]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      if (nudgeTimerRef.current) {
        window.clearTimeout(nudgeTimerRef.current);
      }
    };
  }, []);

  const timeAgo = useMemo(() => {
    if (!latestEvent) return "";
    return formatTimeAgo(latestEvent.ts, now);
  }, [latestEvent, now]);

  const qnaEndsAt = liveSnapshot?.qnaEndsAt ?? null;
  const qnaOpen = liveSnapshot?.qnaOpen === true && (!qnaEndsAt || qnaEndsAt > now);
  const showQnaChip =
    variant === "present" &&
    (typeof liveSnapshot?.qnaOpen === "boolean" || qnaEndsAt || liveSnapshot?.qnaPrompt);
  const qnaLabel = qnaOpen
    ? qnaEndsAt
      ? `질문 열림 · ${formatRemaining(qnaEndsAt - now)}`
      : "질문 열림"
    : "질문 닫힘";
  const sessionElapsed =
    activeSessionStartedAt && !Number.isNaN(Date.parse(activeSessionStartedAt))
      ? formatRemaining(now - Date.parse(activeSessionStartedAt))
      : null;

  if (!latestEvent && !showQnaChip && !nudgeOpen && !activeSessionId) {
    return null;
  }

  const variantTokens = variantStyles[variant];
  const targetLabel = latestEvent ? targetLabelMap[latestEvent.target] : targetLabelMap[variant];
  const bannerLabel = latestEvent ? `현재 단계: ${latestEvent.label} · ${targetLabel} · ${timeAgo}` : "";
  const collapsedLabel = latestEvent ? `현재 단계 · ${targetLabel}` : "";
  const statusLabel = statusLabels[liveStatus];
  const statusStyle = statusStyles[liveStatus];

  return (
    <>
      {nudgeOpen && variant === "share" ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4">
          <div className="pointer-events-none flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-900 shadow-lg">
            <span className="rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-semibold text-indigo-700">출석</span>
            <span>참여 체크를 부탁드려요!</span>
          </div>
        </div>
      ) : null}
      {latestEvent && isOpen ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
          <div
            className={cn(
              "pointer-events-none flex max-w-[94vw] items-center gap-3 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg",
              variantTokens.shell,
              isExpanded ? "opacity-100" : "opacity-90",
            )}
          >
            <span className={cn("rounded-full px-2 py-1 text-[11px] font-semibold", variantTokens.badge)}>
              Live
            </span>
            {isTeacher ? (
              <span className={cn("rounded-full px-2 py-1 text-[11px] font-semibold", statusStyle)}>
                {statusLabel}
              </span>
            ) : null}
            <span className="truncate">{isExpanded ? bannerLabel : collapsedLabel}</span>
          </div>
        </div>
      ) : null}
      {activeSessionId && sessionElapsed ? (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4">
          <div
            className={cn(
              "pointer-events-none flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold shadow",
              variantTokens.shell,
            )}
          >
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", variantTokens.badge)}>
              기록중
            </span>
            <span>{sessionElapsed}</span>
            <span className="uppercase">{activeSessionId.slice(0, 8)}</span>
          </div>
        </div>
      ) : null}
      {latestEvent ? (
        <div className="fixed right-4 top-4 z-50">
          <button
            type="button"
            onClick={() => {
              if (!latestEvent) return;
              if (!isOpen) {
                setIsOpen(true);
                setIsExpanded(true);
                return;
              }
              setIsExpanded((prev) => !prev);
            }}
            className={cn(
              "pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold shadow-lg transition",
              variantTokens.shell,
            )}
            aria-expanded={isOpen && isExpanded}
          >
            <span>{isOpen && isExpanded ? "배너 접기" : "현재 단계 보기"}</span>
            <span aria-hidden>{isOpen && isExpanded ? "▾" : "▴"}</span>
          </button>
        </div>
      ) : null}
      {isTeacher && liveStatus === "paused" ? (
        <div className="fixed right-4 top-20 z-50">
          <button
            type="button"
            onClick={retryLive}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-800 shadow-lg transition hover:bg-rose-100"
          >
            <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700">라이브 끊김</span>
            <span>다시 시도</span>
          </button>
        </div>
      ) : null}
      {showQnaChip ? (
        <div className="fixed left-4 top-4 z-50">
          <span
            className={cn(
              "pointer-events-none rounded-full border px-3 py-2 text-[11px] font-semibold shadow-lg",
              qnaOpen
                ? "border-emerald-400/40 bg-emerald-400/20 text-emerald-50"
                : "border-white/20 bg-white/10 text-white/80",
            )}
          >
            {qnaLabel}
          </span>
        </div>
      ) : null}
    </>
  );
}
