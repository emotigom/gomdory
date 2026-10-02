"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useCallback, useEffect, useMemo, useState } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { hasToolEnabled } from "@/lib/tools/toolsEnabled";

type PulseKind = "ok" | "unsure" | "help";

type PulseState = {
  submitting: boolean;
  lastKind: PulseKind | null;
  message: string | null;
};

type PollState = {
  submitting: boolean;
  error: string | null;
  selectedOption: string | null;
};

type StudentPulsePollProps = {
  shareCode: string;
  toolsEnabled?: string[] | null;
};

function formatPercent(count: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function useLocalSelection(pollId: string | null) {
  const [selection, setSelection] = useState<string | null>(null);

  useEffect(() => {
    if (!pollId) return;
    const stored = window.localStorage.getItem(`gom:poll:${pollId}:selection`);
    if (stored) {
      setSelection(stored);
    } else {
      setSelection(null);
    }
  }, [pollId]);

  const persist = useCallback((next: string) => {
    if (!pollId) return;
    window.localStorage.setItem(`gom:poll:${pollId}:selection`, next);
    setSelection(next);
  }, [pollId]);

  return { selection, persist };
}

export default function StudentPulsePoll({ shareCode, toolsEnabled }: StudentPulsePollProps) {
  const canPulse = hasToolEnabled(toolsEnabled, "pulse");
  const canPolls = hasToolEnabled(toolsEnabled, "polls");
  const { data: liveSnapshot, status } = useLiveSync({
    mode: "viewer",
    shareCode,
    enableLiveSync: canPulse || canPolls,
  });
  const [pulseState, setPulseState] = useState<PulseState>({ submitting: false, lastKind: null, message: null });
  const [pollState, setPollState] = useState<PollState>({ submitting: false, error: null, selectedOption: null });
  const poll = canPolls ? liveSnapshot?.poll ?? null : null;
  const pollId = poll?.id ?? null;
  const { selection, persist } = useLocalSelection(pollId);

  useEffect(() => {
    setPollState((prev) => ({ ...prev, selectedOption: selection }));
  }, [selection]);

  const pulseTotal = useMemo(() => {
    if (!canPulse || !liveSnapshot?.pulse) return 0;
    return liveSnapshot.pulse.ok + liveSnapshot.pulse.unsure + liveSnapshot.pulse.help;
  }, [canPulse, liveSnapshot?.pulse]);

  const handlePulse = useCallback(
    async (kind: PulseKind) => {
      setPulseState({ submitting: true, lastKind: kind, message: null });
      try {
        const response = await fetch(apiV1Path(`s/${shareCode}/pulse`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, timezoneOffset: new Date().getTimezoneOffset() }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: { counts: unknown } }
          | { ok: false; error?: { message?: string } }
          | null;

        if (!response.ok || !payload || payload.ok !== true) {
          const message =
            payload && "error" in payload && payload.error?.message
              ? payload.error.message
              : "잠시 후 다시 시도해주세요.";
          throw new Error(message);
        }

        setPulseState({ submitting: false, lastKind: kind, message: "전송됐어요!" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.";
        setPulseState({ submitting: false, lastKind: kind, message });
      }
    },
    [shareCode],
  );

  const handlePoll = useCallback(
    async (optionId: string) => {
      if (!pollId || pollState.submitting) return;
      setPollState((prev) => ({ ...prev, submitting: true, error: null }));
      try {
        const response = await fetch(apiV1Path(`s/${shareCode}/polls/${pollId}/submit`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionId, timezoneOffset: new Date().getTimezoneOffset() }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; data: { counts: Record<string, number>; total: number } }
          | { ok: false; error?: { message?: string } }
          | null;

        if (!response.ok || !payload || payload.ok !== true) {
          const message =
            payload && "error" in payload && payload.error?.message
              ? payload.error.message
              : "투표를 전송하지 못했습니다.";
          throw new Error(message);
        }

        persist(optionId);
        setPollState({ submitting: false, error: null, selectedOption: optionId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "투표를 전송하지 못했습니다.";
        setPollState({ submitting: false, error: message, selectedOption: pollState.selectedOption });
      }
    },
    [persist, pollId, pollState.selectedOption, pollState.submitting, shareCode],
  );

  const pollTotal = poll?.total ?? (poll?.counts ? Object.values(poll.counts).reduce((sum, value) => sum + value, 0) : 0);
  const isPollClosed = poll ? !poll.open : false;

  if (!canPulse && !canPolls) {
    return null;
  }

  return (
    <div className="grid gap-4">
      {canPulse ? (
        <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Live Pulse</p>
              <p className="mt-1 text-lg font-semibold text-indigo-900">지금 상태를 알려주세요</p>
              <p className="text-sm text-indigo-700">중복/스팸 방지로 3초마다 한 번씩만 전송돼요.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-800">
              연결: {status === "live" ? "실시간" : status === "offline" ? "오프라인" : "대기"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              className={cn(
                buttonTone("primary", { size: "lg", tone: "indigo" }),
                "min-h-[56px] text-base",
                pulseState.lastKind === "ok" ? "ring-2 ring-indigo-500 ring-offset-2" : "",
              )}
              onClick={() => void handlePulse("ok")}
              disabled={pulseState.submitting}
            >
              이해했어요
            </button>
            <button
              type="button"
              className={cn(
                buttonTone("primary", { size: "lg", tone: "slate" }),
                "min-h-[56px] text-base",
                pulseState.lastKind === "unsure" ? "ring-2 ring-slate-500 ring-offset-2" : "",
              )}
              onClick={() => void handlePulse("unsure")}
              disabled={pulseState.submitting}
            >
              애매해요
            </button>
            <button
              type="button"
              className={cn(
                buttonTone("primary", { size: "lg", tone: "rose" }),
                "min-h-[56px] text-base",
                pulseState.lastKind === "help" ? "ring-2 ring-rose-500 ring-offset-2" : "",
              )}
              onClick={() => void handlePulse("help")}
              disabled={pulseState.submitting}
            >
              도움!
            </button>
          </div>
          {pulseState.message ? (
            <p className="mt-2 text-sm font-semibold text-indigo-800">{pulseState.message}</p>
          ) : null}
          {liveSnapshot?.pulse ? (
            <div className="mt-3 grid gap-2 text-sm text-indigo-900 sm:grid-cols-3">
              {(["ok", "unsure", "help"] as PulseKind[]).map((kind) => {
                const count = liveSnapshot.pulse?.[kind] ?? 0;
                return (
                  <div key={kind} className="space-y-1 rounded-2xl bg-white/80 p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {kind === "ok" ? "이해했어요" : kind === "unsure" ? "애매해요" : "도움!"}
                      </span>
                      <span className="text-xs text-indigo-600">{formatPercent(count, pulseTotal)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-indigo-100">
                      <div
                        className="h-2 rounded-full bg-indigo-500 transition-all"
                        style={{ width: pulseTotal > 0 ? `${Math.min(100, (count / pulseTotal) * 100)}%` : "4%" }}
                      />
                    </div>
                    <p className="text-xs text-indigo-600">{count}명</p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {canPolls && poll && (poll.open || poll.counts) ? (
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">Quick Poll</p>
              <p className="mt-1 text-lg font-semibold text-amber-900">
                {poll.question}
              </p>
              <p className="text-sm text-amber-800">
                {isPollClosed ? "투표가 종료되었어요" : "투표 중이에요"}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800">
              총 {pollTotal ?? 0}표
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {poll.options.map((option) => {
              const count = poll.counts?.[option.id] ?? 0;
              const percent = pollTotal > 0 ? Math.round((count / pollTotal) * 100) : 0;
              const isSelected = pollState.selectedOption === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void handlePoll(option.id)}
                  disabled={pollState.submitting || isPollClosed}
                  className={cn(
                    "group flex flex-col items-start gap-2 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition",
                    isSelected ? "border-amber-500 shadow-md" : "border-amber-100",
                    pollState.submitting || isPollClosed ? "opacity-70" : "hover:border-amber-400",
                  )}
                  data-interactive="true"
                >
                  <span className="text-base font-semibold text-amber-900">{option.label}</span>
                  {poll.counts ? (
                    <div className="flex w-full items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-amber-100">
                        <div
                          className="h-2 rounded-full bg-amber-500 transition-all"
                          style={{ width: `${Math.min(100, percent)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-amber-800">
                        {count}표 · {formatPercent(count, pollTotal)}
                      </span>
                    </div>
                  ) : null}
                  {isSelected ? <span className="text-xs font-semibold text-amber-700">내 선택</span> : null}
                </button>
              );
            })}
          </div>
          {pollState.error ? (
            <div className="mt-3">
              <InlineAlert tone="warning" title={pollState.error} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
