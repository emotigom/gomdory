"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { buildClipUrl } from "@/lib/http/publicLinks";
import { boardClassHref, boardHubHref } from "@/lib/dashboard/boardHrefs";
import ClipShareSheet from "./ClipShareSheet";
import { buildHighlights, type Highlight } from "@/lib/replay/highlights";
import { suggestClipRange, type ClipSuggestKind } from "@/lib/replay/clipSuggest";
import {
  buildReplayTimeline,
  stateAt,
  type ReplayEvent,
  type ReplayMarker,
  type ReplayState,
} from "@/lib/replay/sessionReplay";
import type { SessionEventType } from "@/lib/types/sessionEvents";
import type { SessionReport } from "@/lib/types/sessionReport";

const SPEED_OPTIONS = [1, 2, 4] as const;

type HighlightFilter = "all" | "step" | "question" | "poll" | "pulse" | "presence" | "bookmark";

type ReplayClientProps = {
  boardId: string;
  sessionId: string;
  session: { started_at: string; ended_at: string | null; status: string };
  events: Array<{ ts: string; type: SessionEventType; payload: Record<string, unknown> }>;
  report: SessionReport | null;
  hasLiveSession: boolean;
  readOnly?: boolean;
  clipTitle?: string | null;
  clipMode?: "safe" | "full";
  initialBookmarks?: SessionBookmark[];
};

type SessionBookmark = {
  id: string;
  ts: string;
  note: string | null;
};

type ClipShareItem = {
  token: string;
  clip_start_ts: string;
  clip_end_ts: string;
  mode: "safe" | "full";
  title: string | null;
  created_at: string;
  revoked_at: string | null;
  expires_at: string | null;
};

type ClipSuggestion = {
  startMs: number;
  endMs: number;
  anchorMs: number;
  kind: ClipSuggestKind;
  subtype?: string;
  label: string;
};

function formatClock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatTimestamp(ts: number | null) {
  if (!ts) return "--:--";
  return new Date(ts).toLocaleTimeString("ko-KR");
}

function maskToken(token: string) {
  if (token.length <= 8) return `${token.slice(0, 2)}…${token.slice(-2)}`;
  return `****${token.slice(-4)}`;
}

function resolveClipStatus(share: ClipShareItem) {
  const expiresAt = share.expires_at ? Date.parse(share.expires_at) : null;
  const isExpired = expiresAt !== null && !Number.isNaN(expiresAt) && expiresAt <= Date.now();
  if (share.revoked_at) return "revoked";
  if (isExpired) return "expired";
  return "active";
}

function formatExpiryLabel(share: ClipShareItem) {
  if (!share.expires_at) return "무기한";
  const expiresAt = Date.parse(share.expires_at);
  if (Number.isNaN(expiresAt)) return "무기한";
  return new Date(expiresAt).toLocaleDateString("ko-KR");
}

function resolveStartEnd(session: ReplayClientProps["session"], timelineStart: number, timelineEnd: number) {
  const startedAt = Date.parse(session.started_at);
  const endedAt = session.ended_at ? Date.parse(session.ended_at) : Number.NaN;
  const hasStart = Number.isFinite(startedAt);
  const hasEnd = Number.isFinite(endedAt);
  const start = timelineStart || (hasStart ? startedAt : 0);
  const end = timelineEnd || (hasEnd ? endedAt : start);
  return { start, end };
}

function mapEvent(event: ReplayClientProps["events"][number]): ReplayEvent {
  return {
    ts: event.ts,
    type: event.type,
    payload: event.payload ?? {},
  };
}

function resolvePinnedTitle(item: ReplayState["pinnedQuestions"]["recent"][number]) {
  if (item.title) return item.title;
  return `질문 #${item.id.slice(0, 4)}`;
}

function markerStyle(marker: ReplayMarker, start: number, duration: number) {
  if (duration <= 0) return { left: "0%" };
  const percentage = ((marker.ts - start) / duration) * 100;
  return { left: `${Math.min(100, Math.max(0, percentage))}%` };
}

function highlightStyle(ts: number, start: number, duration: number) {
  if (duration <= 0) return { left: "0%" };
  const percentage = ((ts - start) / duration) * 100;
  return { left: `${Math.min(100, Math.max(0, percentage))}%` };
}

function resolveHighlightLabel(highlight: Highlight) {
  switch (highlight.type) {
    case "step":
      return "단계";
    case "question":
      return "질문";
    case "poll":
      return "투표";
    case "pulse":
      return "분위기";
    case "presence":
      return "출석";
    case "qa":
      return "Q&A";
    case "bookmark":
      return "북마크";
    default:
      return "하이라이트";
  }
}

function resolveHighlightSubtype(highlight: Highlight): string | undefined {
  if (highlight.type === "poll") {
    return highlight.title.includes("종료") ? "poll_close" : "poll_open";
  }
  if (highlight.type === "step") return "step_start";
  if (highlight.type === "question") return "question_pin";
  if (highlight.type === "qa") return highlight.title.includes("종료") ? "qa_close" : "qa_open";
  if (highlight.type === "pulse") return "pulse_peak";
  if (highlight.type === "presence") return "presence_drop";
  return undefined;
}

const highlightIcons: Record<Highlight["iconKey"], string> = {
  step: "🧭",
  poll: "📊",
  pulse: "💡",
  presence: "👥",
  question: "❓",
  qa: "🗣️",
  bookmark: "🔖",
};

export default function ReplayClient({
  boardId,
  sessionId,
  session,
  events,
  report,
  hasLiveSession,
  readOnly = false,
  clipTitle,
  clipMode = "safe",
  initialBookmarks,
}: ReplayClientProps) {
  const replayEvents = useMemo(() => events.map(mapEvent), [events]);
  const timeline = useMemo(() => buildReplayTimeline(replayEvents), [replayEvents]);
  const { start, end } = resolveStartEnd(session, timeline.startTs, timeline.endTs);
  const durationMs = Math.max(0, end - start);
  const sessionStartMs = start;
  const sessionEndMs = end;

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [currentOffsetMs, setCurrentOffsetMs] = useState(0);
  const [bookmarkItems, setBookmarkItems] = useState<SessionBookmark[]>(initialBookmarks ?? []);
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [highlightFilter, setHighlightFilter] = useState<HighlightFilter>("all");
  const [clipShares, setClipShares] = useState<ClipShareItem[]>([]);
  const [clipError, setClipError] = useState<string | null>(null);
  const [clipSheetOpen, setClipSheetOpen] = useState(false);
  const [clipSuggestion, setClipSuggestion] = useState<ClipSuggestion | null>(null);
  const [clipFilter, setClipFilter] = useState<"active" | "revoked" | "expired">("active");
  const [pendingRevokeToken, setPendingRevokeToken] = useState<string | null>(null);
  const [shareProto, setShareProto] = useState<"http" | "https">("https");
  const initializedSessionRef = useRef<string | null>(null);
  const autoClipHandledRef = useRef<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (initializedSessionRef.current === sessionId) return;
    initializedSessionRef.current = sessionId;
    autoClipHandledRef.current = null;
    setCurrentOffsetMs(0);
    setIsPlaying(false);
    setBookmarkItems(initialBookmarks ?? []);
    setBookmarkError(null);
    setClipShares([]);
    setClipError(null);
    setClipSheetOpen(false);
    setClipSuggestion(null);
    setClipFilter("active");
    setPendingRevokeToken(null);
  }, [initialBookmarks, sessionId]);

  useEffect(() => {
    if (readOnly) {
      setBookmarkItems(initialBookmarks ?? []);
      return;
    }
    let isMounted = true;
    const loadBookmarks = async () => {
      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/sessions/${sessionId}/bookmarks`), {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: { items: SessionBookmark[] } }
          | { ok?: false; error?: { message?: string } }
          | null;
        if (!response.ok || payload?.ok !== true) {
          const message =
            payload && payload.ok === false
              ? payload.error?.message
              : "북마크를 불러오지 못했습니다.";
          throw new Error(message ?? "북마크를 불러오지 못했습니다.");
        }
        if (isMounted) {
          setBookmarkItems(payload.data.items ?? []);
        }
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : "북마크를 불러오지 못했습니다.";
          setBookmarkError(message);
        }
      }
    };

    void loadBookmarks();
    return () => {
      isMounted = false;
    };
  }, [boardId, sessionId, readOnly, initialBookmarks]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShareProto(window.location.protocol === "http:" ? "http" : "https");
  }, []);

  useEffect(() => {
    if (!isPlaying || durationMs <= 0) return;
    const interval = window.setInterval(() => {
      setCurrentOffsetMs((prev) => {
        const next = Math.min(prev + 100 * speed, durationMs);
        if (next >= durationMs) {
          setIsPlaying(false);
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [durationMs, isPlaying, speed]);

  const targetTs = start + currentOffsetMs;
  const replayState = useMemo(() => stateAt(replayEvents, targetTs), [replayEvents, targetTs]);

  const pollSummaryMap = useMemo(() => {
    const map = new Map<string, { title: string | null; topOption: string | null; total: number | null }>();
    report?.polls?.forEach((poll) => {
      if (typeof poll.pollId === "string") {
        map.set(poll.pollId, {
          title: typeof poll.title === "string" ? poll.title : null,
          topOption: poll.topOption ?? null,
          total: poll.total ?? null,
        });
      }
    });
    return map;
  }, [report?.polls]);

  const pollSummary = replayState.poll.pollId ? pollSummaryMap.get(replayState.poll.pollId) : null;
  const pollTitle = replayState.poll.title ?? pollSummary?.title ?? "투표";
  const pollTop = pollSummary?.topOption ?? "-";
  const pollTotal = pollSummary?.total ?? 0;
  const autoHighlights = useMemo(() => buildHighlights(replayEvents), [replayEvents]);
  const bookmarkHighlights = useMemo<Highlight[]>(
    () =>
      bookmarkItems
        .map((item) => ({
          ts: Date.parse(item.ts),
          type: "bookmark" as const,
          title: "교사 북마크",
          subtitle: item.note ?? "메모 없음",
          severity: 1 as const,
          iconKey: "bookmark" as const,
          source: "bookmark" as const,
        }))
        .filter((item) => Number.isFinite(item.ts)),
    [bookmarkItems],
  );
  const highlightItems = useMemo(
    () => [...autoHighlights, ...bookmarkHighlights].sort((a, b) => a.ts - b.ts),
    [autoHighlights, bookmarkHighlights],
  );
  const filteredHighlights = useMemo(() => {
    if (highlightFilter === "all") return highlightItems;
    if (highlightFilter === "question") {
      return highlightItems.filter((item) => item.type === "question" || item.type === "qa");
    }
    return highlightItems.filter((item) => item.type === highlightFilter);
  }, [highlightFilter, highlightItems]);

  const stepTimestamps = useMemo(
    () =>
      replayEvents
        .filter((event) => event.type === "step_changed")
        .map((event) => Date.parse(event.ts))
        .filter((ts) => Number.isFinite(ts))
        .sort((a, b) => a - b),
    [replayEvents],
  );

  const clampToSession = useCallback(
    (value: number) => Math.min(sessionEndMs, Math.max(sessionStartMs, value)),
    [sessionEndMs, sessionStartMs],
  );

  const normalizeClipRange = useCallback(
    (startMs: number, endMs: number) => {
      const start = clampToSession(startMs);
      let end = clampToSession(endMs);
      if (end <= start) {
        end = Math.min(sessionEndMs, start + 1000);
      }
      return { start, end };
    },
    [clampToSession, sessionEndMs],
  );

  const resolveClipSuggestion = useCallback(
    (highlight: Highlight): ClipSuggestion => {
      const baseLabel = highlight.title;
      const kind: ClipSuggestKind =
        highlight.type === "bookmark" ? "bookmark" : highlight.type === "step" ? "step" : "highlight";
      const subtype = resolveHighlightSubtype(highlight);
      const nextStepTs =
        highlight.type === "step"
          ? stepTimestamps[stepTimestamps.findIndex((ts) => ts === highlight.ts) + 1]
          : undefined;
      const suggestion = suggestClipRange({
        kind,
        subtype,
        ts: highlight.ts,
        nextTs: nextStepTs,
      });
      const normalized = normalizeClipRange(suggestion.startMs, suggestion.endMs);
      const suffix = kind === "bookmark" ? "북마크 추천" : kind === "step" ? "스텝 추천" : "하이라이트 추천";
      return {
        startMs: normalized.start,
        endMs: normalized.end,
        anchorMs: suggestion.anchorMs,
        kind,
        subtype,
        label: `${baseLabel} · ${suffix}`,
      };
    },
    [normalizeClipRange, stepTimestamps],
  );

  const openClipSheet = useCallback(
    (suggestion: ClipSuggestion) => {
      setClipSuggestion(suggestion);
      setClipSheetOpen(true);
    },
    [setClipSuggestion, setClipSheetOpen],
  );

  const defaultClipSuggestion = useMemo(
    () => ({
      startMs: sessionStartMs,
      endMs: clampToSession(sessionStartMs + 120_000),
      anchorMs: sessionStartMs,
      kind: "highlight" as const,
      label: "새 클립 추천",
    }),
    [clampToSession, sessionStartMs],
  );

  const jumpTo = useCallback(
    (ts: number, pause = true) => {
      const clamped = Math.max(0, Math.min(durationMs, ts - start));
      setCurrentOffsetMs(clamped);
      if (pause) setIsPlaying(false);
    },
    [durationMs, start],
  );

  const jumpToRelativeHighlight = useCallback(
    (direction: "prev" | "next") => {
      if (highlightItems.length === 0) return;
      const nowTs = start + currentOffsetMs;
      if (direction === "next") {
        const next = highlightItems.find((item) => item.ts > nowTs + 1) ?? highlightItems[0];
        jumpTo(next.ts, true);
        return;
      }
      const prevIndex = [...highlightItems].reverse().find((item) => item.ts < nowTs - 1);
      const prev = prevIndex ?? highlightItems[highlightItems.length - 1];
      jumpTo(prev.ts, true);
    },
    [currentOffsetMs, highlightItems, jumpTo, start],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      }
      if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        jumpToRelativeHighlight("prev");
      }
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        jumpToRelativeHighlight("next");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [jumpToRelativeHighlight]);

  useEffect(() => {
    if (readOnly) return;
    if (autoClipHandledRef.current === sessionId) return;
    const clipKind = searchParams.get("clip");
    const tsParam = searchParams.get("ts");
    if (!clipKind || !tsParam) return;
    if (!["highlight", "bookmark", "step"].includes(clipKind)) return;
    const ts = Number(tsParam);
    if (!Number.isFinite(ts)) return;
    const nextTsParam = searchParams.get("nextTs");
    const nextTs = nextTsParam ? Number(nextTsParam) : undefined;
    const subtype = searchParams.get("subtype") ?? undefined;
    const suggestion = suggestClipRange({
      kind: clipKind as ClipSuggestKind,
      ts,
      nextTs: Number.isFinite(nextTs) ? nextTs : undefined,
      subtype,
    });
    const normalized = normalizeClipRange(suggestion.startMs, suggestion.endMs);
    setClipSuggestion({
      startMs: normalized.start,
      endMs: normalized.end,
      anchorMs: suggestion.anchorMs,
      kind: suggestion.kind,
      subtype: suggestion.subtype,
      label: "빠른 클립 추천",
    });
    setClipSheetOpen(true);
    autoClipHandledRef.current = sessionId;
  }, [normalizeClipRange, readOnly, searchParams, sessionId]);

  const loadClipShares = useCallback(async () => {
    if (readOnly) return;
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/sessions/${sessionId}/clips`), {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; items: ClipShareItem[] }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || payload?.ok !== true) {
        const message =
          payload && payload.ok === false ? payload.error?.message : "클립 목록을 불러오지 못했습니다.";
        throw new Error(message ?? "클립 목록을 불러오지 못했습니다.");
      }
      setClipShares(payload.items ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "클립 목록을 불러오지 못했습니다.";
      setClipError(message);
    }
  }, [boardId, readOnly, sessionId]);

  useEffect(() => {
    if (readOnly) return;
    void loadClipShares();
  }, [loadClipShares, readOnly]);

  const filteredClipShares = useMemo(() => {
    const sorted = [...clipShares].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    );
    return sorted.filter((share) => resolveClipStatus(share) === clipFilter);
  }, [clipFilter, clipShares]);

  return (
    <div className="space-y-6">
      {!readOnly ? (
        <ClipShareSheet
          open={clipSheetOpen}
          onClose={() => setClipSheetOpen(false)}
          boardId={boardId}
          sessionId={sessionId}
          sessionStartMs={sessionStartMs}
          sessionEndMs={sessionEndMs}
          suggestion={clipSuggestion}
          onCreated={loadClipShares}
        />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
            {readOnly ? "Replay v2 Clip" : "Replay v1"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {readOnly ? clipTitle ?? "Clip Replay" : "수업 다시보기"}
          </h1>
          <p className="text-sm text-slate-600">
            {new Date(session.started_at).toLocaleString("ko-KR")}
            {session.ended_at ? ` ~ ${new Date(session.ended_at).toLocaleString("ko-KR")}` : ""}
          </p>
          {readOnly ? (
            <p className="mt-2 text-xs font-semibold text-indigo-600">
              읽기 전용 클립 · {clipMode === "safe" ? "Safe 모드" : "Full 모드"}
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/boards/${boardId}/reports/${sessionId}`}
              className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
            >
              리포트 보기
            </Link>
            <Link
              href={boardHubHref(boardId)}
              className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
            >
              보드로 돌아가기
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.45fr_0.55fr]">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-500">하이라이트 패널</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">중요 순간을 빠르게 점프하세요</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>J/K 이동</span>
              <span>Space 재생</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { key: "all", label: "전체" },
                { key: "step", label: "단계" },
                { key: "question", label: "질문" },
                { key: "poll", label: "투표" },
                { key: "pulse", label: "분위기" },
                { key: "presence", label: "출석" },
                { key: "bookmark", label: "북마크" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setHighlightFilter(filter.key)}
                className={cn(
                  buttonTone("secondary", { size: "sm" }),
                  "min-h-[36px] px-3",
                  highlightFilter === filter.key ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {filteredHighlights.length > 0 ? (
              filteredHighlights.map((highlight) => (
                <div
                  key={`${highlight.type}-${highlight.ts}-${highlight.title}`}
                  className="flex w-full flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50"
                >
                  <button type="button" onClick={() => jumpTo(highlight.ts, true)} className="flex flex-1 items-start gap-3 text-left">
                    <span className="mt-0.5 text-lg" aria-hidden>
                      {highlightIcons[highlight.iconKey]}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{highlight.title}</p>
                      <p className="text-xs text-slate-500">{highlight.subtitle ?? resolveHighlightLabel(highlight)}</p>
                      <p className="text-xs text-slate-400">{formatTimestamp(highlight.ts)}</p>
                    </div>
                  </button>
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => openClipSheet(resolveClipSuggestion(highlight))}
                      className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[36px]")}
                    >
                      클립 만들기
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                선택한 필터에 표시할 하이라이트가 없습니다.
              </p>
            )}
            {bookmarkError ? <p className="text-xs font-semibold text-rose-500">{bookmarkError}</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">현재 시점</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatClock(currentOffsetMs)} / {formatClock(durationMs)}
              </p>
              <p className="text-xs text-slate-500">{formatTimestamp(start + currentOffsetMs)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying((prev) => !prev)}
                className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "min-h-[44px]")}
                disabled={durationMs <= 0}
              >
                {isPlaying ? "일시정지" : "재생"}
              </button>
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSpeed(option)}
                  className={cn(
                    buttonTone("secondary", { size: "sm" }),
                    "min-h-[44px]",
                    option === speed ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "",
                  )}
                >
                  {option}x
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <div className="relative">
              <input
                type="range"
                min={0}
                max={durationMs}
                value={currentOffsetMs}
                onChange={(event) => setCurrentOffsetMs(Number(event.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2">
                {timeline.markers.map((marker) => (
                  <span
                    key={`${marker.type}-${marker.ts}`}
                    className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-indigo-400"
                    style={markerStyle(marker, start, durationMs)}
                  />
                ))}
                {autoHighlights.map((highlight) => (
                  <span
                    key={`highlight-${highlight.type}-${highlight.ts}`}
                    className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-amber-400"
                    style={highlightStyle(highlight.ts, start, durationMs)}
                  />
                ))}
                {bookmarkHighlights.map((highlight) => (
                  <span
                    key={`bookmark-${highlight.ts}`}
                    className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-400"
                    style={highlightStyle(highlight.ts, start, durationMs)}
                  />
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap justify-between text-xs text-slate-500">
              <span>{formatTimestamp(start)}</span>
              <span>{formatTimestamp(end)}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>주요 이벤트 점: 스텝 · 투표 · 질문 · Q&amp;A</span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
              자동 하이라이트
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
              북마크
            </span>
            {hasLiveSession ? (
              <Link
                href={boardClassHref(boardId)}
                prefetch={false}
                className="font-semibold text-indigo-600 hover:text-indigo-500"
              >
                실시간으로 돌아가기
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {!readOnly ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Replay v2 · Clips</p>
              <p className="mt-1 text-sm text-slate-600">클립 링크를 생성하고 즉시 공유/해제할 수 있습니다.</p>
            </div>
            <button
              type="button"
              onClick={() => openClipSheet(defaultClipSuggestion)}
              className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "min-h-[40px]")}
            >
              새 클립 만들기
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                { key: "active", label: "Active" },
                { key: "revoked", label: "Revoked" },
                { key: "expired", label: "Expired" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setClipFilter(filter.key)}
                className={cn(
                  buttonTone("secondary", { size: "sm" }),
                  "min-h-[36px] px-3",
                  clipFilter === filter.key ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {filteredClipShares.length > 0 ? (
              filteredClipShares.map((share) => {
                const status = resolveClipStatus(share);
                const shareUrl = buildClipUrl(share.token, shareProto);
                return (
                  <div
                    key={share.token}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{share.title ?? "클립 공유"}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : status === "revoked"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-200 text-slate-600",
                          )}
                        >
                          {status === "active" ? "활성" : status === "revoked" ? "해제됨" : "만료"}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            share.mode === "safe"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-rose-100 text-rose-700",
                          )}
                        >
                          {share.mode === "safe" ? "Safe" : "Full"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(share.clip_start_ts).toLocaleTimeString("ko-KR")} ~{" "}
                        {new Date(share.clip_end_ts).toLocaleTimeString("ko-KR")}
                      </p>
                      <p className="text-xs text-slate-500">
                        토큰 {maskToken(share.token)} · 만료 {formatExpiryLabel(share)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(shareUrl);
                          } catch {
                            // ignore
                          }
                        }}
                        className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[36px]")}
                      >
                        Copy
                      </button>
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[36px]")}
                      >
                        Open
                      </a>
                      {status === "active" ? (
                        pendingRevokeToken === share.token ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(apiV1Path(`boards/${boardId}/sessions/${sessionId}/clips/revoke`), {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ token: share.token }),
                              }).catch(() => null);
                              setPendingRevokeToken(null);
                              void loadClipShares();
                            }}
                            className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[36px] text-rose-600")}
                          >
                            폐기합니다
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingRevokeToken(share.token)}
                            className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[36px] text-rose-600")}
                          >
                            정말 폐기?
                          </button>
                        )
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                선택한 상태에 표시할 클립이 없습니다.
              </p>
            )}
            {clipError ? <p className="text-xs font-semibold text-rose-500">{clipError}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">현재 스텝</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {replayState.currentStep.label ?? "진행 중인 스텝이 없습니다."}
          </h2>
          {replayState.currentStep.description ? (
            <p className="mt-1 text-sm text-slate-600">{replayState.currentStep.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              타이머 {replayState.currentStep.timerSeconds ? `${replayState.currentStep.timerSeconds}s` : "없음"}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
              스텝 #{replayState.currentStep.index !== null ? replayState.currentStep.index + 1 : "-"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Q&amp;A 창</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {replayState.qaWindow.open ? "질문 받는 중" : "질문 받지 않음"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{replayState.qaWindow.prompt ?? ""}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">고정 질문</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{replayState.pinnedQuestions.count}개</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {replayState.pinnedQuestions.recent.length > 0 ? (
              replayState.pinnedQuestions.recent.slice(0, 2).map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  {resolvePinnedTitle(item)}
                </div>
              ))
            ) : (
              <p className="text-slate-500">고정된 질문이 없습니다.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">투표 요약</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">
            {replayState.poll.status === "open" ? "투표 진행 중" : replayState.poll.status === "closed" ? "투표 종료" : "투표 없음"}
          </h2>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <p>질문: {pollTitle}</p>
            <p>최다 선택: {pollTop}</p>
            <p>참여 {pollTotal}명</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">펄스</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            현재 {replayState.pulse.current} · 피크 {replayState.pulse.peak}
          </p>
          <p className="mt-1 text-sm text-slate-600">스냅샷 기준</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">참여 인원</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            현재 {replayState.presence.current} · 피크 {replayState.presence.peak}
          </p>
          <p className="mt-1 text-sm text-slate-600">스냅샷 기준</p>
        </div>
      </div>
    </div>
  );
}
