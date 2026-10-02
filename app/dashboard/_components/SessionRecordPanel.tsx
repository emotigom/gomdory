"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import CardTile from "@/app/_components/CardTile";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import type { SessionReport } from "@/lib/types/sessionReport";

type SessionRecordPanelProps = {
  boardId: string | null;
  shareCode?: string | null;
  activeSessionId?: string | null;
  activeSessionStartedAt?: string | null;
  variant?: "compact" | "remote";
};

type SessionEvent = {
  id: string;
  ts: string;
  type: string;
  payload: Record<string, unknown>;
};

type SessionData = {
  id: string;
  status: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  report: SessionReport | null;
};

const eventLabelMap: Record<string, string> = {
  session_started: "기록 시작",
  session_ended: "기록 종료",
  step_changed: "스텝 변경",
  qa_window_changed: "Q&A 변경",
  question_pinned: "질문 고정",
  poll_opened: "투표 시작",
  poll_closed: "투표 종료",
  pulse_reset: "이해도 초기화",
  nudge_sent: "출석 알림",
  snapshot: "스냅샷",
};

function formatElapsed(startedAt: string | null, now: number) {
  if (!startedAt) return "00:00";
  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) return "00:00";
  const diffSeconds = Math.max(0, Math.floor((now - started) / 1000));
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatEvent(event: SessionEvent) {
  const label = eventLabelMap[event.type] ?? event.type;
  return `${label} · ${new Date(event.ts).toLocaleTimeString("ko-KR")}`;
}

export default function SessionRecordPanel({
  boardId,
  shareCode,
  activeSessionId,
  activeSessionStartedAt,
  variant = "compact",
}: SessionRecordPanelProps) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [bookmarkNotice, setBookmarkNotice] = useState<string | null>(null);

  const currentSessionId = activeSessionId ?? session?.id ?? null;
  const isRecording = Boolean(currentSessionId && (activeSessionId || session?.status === "running"));
  const displaySessionId = currentSessionId ? currentSessionId.slice(0, 8) : null;
  const sessionStartedAt = activeSessionStartedAt ?? session?.started_at ?? null;
  const elapsed = formatElapsed(sessionStartedAt, now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const fetchSession = useCallback(
    async (sessionId: string) => {
      if (!boardId) return;
      try {
        const response = await fetch(apiV1Path(`boards/${boardId}/sessions/${sessionId}`), {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              ok: true;
              data: { session: SessionData; events: SessionEvent[] };
            }
          | { ok?: false; error?: { message?: string } }
          | null;
        if (!response.ok || payload?.ok !== true) {
          const message =
            payload && "error" in payload && payload.error?.message
              ? payload.error.message
              : "세션을 불러오지 못했습니다.";
          throw new Error(message);
        }
        setSession(payload.data.session);
        setEvents(payload.data.events ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "세션을 불러오지 못했습니다.";
        setError(message);
      }
    },
    [boardId],
  );

  useEffect(() => {
    if (!activeSessionId) {
      setSession(null);
      setEvents([]);
      setConfirmEnd(false);
      return;
    }
    void fetchSession(activeSessionId);
  }, [activeSessionId, fetchSession]);

  const handleStart = async () => {
    if (!boardId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/sessions`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode: shareCode ?? undefined }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: SessionData }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || payload?.ok !== true) {
        const message =
          payload && "error" in payload && payload.error?.message
            ? payload.error.message
            : "기록을 시작하지 못했습니다.";
        throw new Error(message);
      }
      setSession(payload.data);
      setEvents([]);
      setConfirmEnd(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "기록을 시작하지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!boardId || !currentSessionId) return;
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiV1Path(`boards/${boardId}/sessions/${currentSessionId}/end`), {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: SessionData }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || payload?.ok !== true) {
        const message =
          payload && "error" in payload && payload.error?.message
            ? payload.error.message
            : "기록을 종료하지 못했습니다.";
        throw new Error(message);
      }
      setSession(payload.data);
      setConfirmEnd(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "기록을 종료하지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async () => {
    if (!boardId || !currentSessionId) return;
    setBookmarkLoading(true);
    setBookmarkNotice(null);
    try {
      const note = window.prompt("북마크 메모 (선택)") ?? "";
      const response = await fetch(apiV1Path(`boards/${boardId}/sessions/${currentSessionId}/bookmarks`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok?: false; error?: { message?: string } }
        | null;
      if (!response.ok || payload?.ok !== true) {
        const message =
          payload && payload.ok === false
            ? payload.error?.message
            : "북마크를 저장하지 못했습니다.";
        throw new Error(message ?? "북마크를 저장하지 못했습니다.");
      }
      setBookmarkNotice("북마크가 저장되었습니다.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "북마크를 저장하지 못했습니다.";
      setBookmarkNotice(message);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const latestEvents = useMemo(
    () => events.slice(-5).reverse(),
    [events],
  );

  const panelTone = variant === "remote" ? "border-slate-200 bg-white" : "border-indigo-100";
  const titleTone = variant === "remote" ? "text-slate-900" : "text-indigo-900";
  const metaTone = variant === "remote" ? "text-slate-600" : "text-indigo-600";
  const isRemote = variant === "remote";
  const buttonSize = isRemote ? "lg" : "sm";

  return (
    <CardTile variant="dense" subdued className={panelTone}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className={cn("text-sm font-semibold", titleTone)}>수업 기록</p>
            <p className={cn("text-xs", metaTone)}>
              {isRecording
                ? `기록중 · ${elapsed} · ${displaySessionId}`
                : session?.status === "ended" && displaySessionId
                  ? `기록 종료 · ${displaySessionId}`
                  : "기록을 시작하세요."}
            </p>
          </div>
          {isRecording ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleBookmark}
                disabled={bookmarkLoading}
                className={cn(buttonTone("primary", { size: buttonSize, tone: "indigo", fullWidth: isRemote }))}
              >
                지금 장면 북마크
              </button>
              <button
                type="button"
                onClick={handleEnd}
                disabled={loading}
                className={cn(
                  buttonTone(confirmEnd ? "primary" : "secondary", { size: buttonSize, fullWidth: isRemote }),
                  confirmEnd ? "bg-rose-600 text-white hover:bg-rose-500" : "",
                )}
              >
                {confirmEnd ? "정말 종료" : "기록 종료"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={!boardId || loading}
              className={cn(buttonTone("primary", { size: buttonSize, tone: "indigo", fullWidth: isRemote }))}
            >
              기록 시작
            </button>
          )}
        </div>
        {latestEvents.length > 0 ? (
          <div className="space-y-1 rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
            {latestEvents.map((event) => (
              <div key={event.id}>{formatEvent(event)}</div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">최근 이벤트가 아직 없습니다.</p>
        )}
        {session?.status === "ended" && session?.id ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href={`/dashboard/boards/${boardId}/reports/${session.id}`}
              className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "w-full text-center")}
            >
              리포트 열기
            </Link>
            <Link
              href={`/dashboard/boards/${boardId}/replay/${session.id}`}
              className={cn(buttonTone("secondary", { size: "sm" }), "w-full text-center")}
            >
              리플레이 보기
            </Link>
          </div>
        ) : null}
        {bookmarkNotice ? <p className="text-xs font-semibold text-slate-500">{bookmarkNotice}</p> : null}
        {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
      </div>
    </CardTile>
  );
}
