"use client";
import { apiV1Path } from "@/lib/standards/pathTypes";

import { useMemo, useState } from "react";

import InlineAlert from "@/app/_components/InlineAlert";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { buttonTone, cn, tvText } from "@/app/_components/uiTokens";

type QuickPollCardProps = {
  shareCode: string;
};

export default function QuickPollCard({ shareCode }: QuickPollCardProps) {
  const { data } = useLiveSync({ mode: "viewer", shareCode });
  const [pendingOption, setPendingOption] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const quickPoll = data?.quickPoll ?? null;

  const breakdown = useMemo(() => {
    if (!quickPoll || !quickPoll.counts) return [];
    return quickPoll.options.map((option, index) => {
      const count = quickPoll.counts?.[index] ?? 0;
      const percent = quickPoll.total ? Math.round((count / quickPoll.total) * 100) : 0;
      return { ...option, count, percent };
    });
  }, [quickPoll]);

  if (!quickPoll) return null;

  const handleVote = async (index: number) => {
    if (!quickPoll?.id || pendingOption !== null) return;
    setPendingOption(index);
    setError(null);
    try {
      const response = await fetch(apiV1Path(`quick-polls/${quickPoll.id}/vote`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIndex: index }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "투표를 완료하지 못했습니다.");
      }
    } catch {
      setError("투표를 완료하지 못했습니다.");
    } finally {
      setPendingOption(null);
    }
  };

  return (
    <div className="rounded-2xl bg-white/90 px-5 py-4 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.28)] ring-1 ring-indigo-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">10초 퀵 폴</p>
          <p className={cn(tvText.heading, "mt-1 text-lg leading-6 text-gray-900")}>
            {quickPoll.question}
          </p>
        </div>
        <div className="text-xs font-semibold text-indigo-700">
          {quickPoll.open ? "진행 중" : "종료"}
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {quickPoll.options.map((option, index) => {
          const percent = breakdown[index]?.percent ?? 0;
          const votedCount = breakdown[index]?.count ?? 0;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => void handleVote(index)}
              disabled={!quickPoll.open}
              className={cn(
                buttonTone("secondary", { size: "md" }),
                "group relative flex min-h-[56px] items-center justify-between overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50 px-4 text-left text-base font-semibold text-indigo-900 transition",
                !quickPoll.open ? "opacity-70" : "hover:-translate-y-[1px] hover:shadow-md",
              )}
            >
              <span>{option.label}</span>
              <span className="text-sm text-indigo-700">{percent}%</span>
              <span
                className="pointer-events-none absolute inset-y-0 left-0 bg-indigo-200/60 transition-all"
                style={{ width: `${percent}%` }}
                aria-hidden
              />
              <span className="pointer-events-none absolute right-3 text-xs font-medium text-indigo-800">
                {votedCount}표
              </span>
            </button>
          );
        })}
      </div>
      {pendingOption !== null ? (
        <p className="mt-2 text-sm text-indigo-700">응답을 보내는 중...</p>
      ) : null}
      {error ? <InlineAlert tone="error" className="mt-3" title={error} /> : null}
    </div>
  );
}
