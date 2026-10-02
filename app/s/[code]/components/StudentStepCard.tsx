"use client";

import { useEffect, useMemo, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { getRemainingSeconds } from "@/lib/flow/stepTimer";

type StudentStepCardProps = {
  shareCode: string;
};

export default function StudentStepCard({ shareCode }: StudentStepCardProps) {
  const { data } = useLiveSync({ mode: "viewer", shareCode });
  const [now, setNow] = useState(0);
  const currentStep = data?.currentStep ?? null;
  const qnaEndsAt = data?.qnaEndsAt ?? null;
  const qnaOpen = data?.qnaOpen === true && (!qnaEndsAt || qnaEndsAt > now);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!currentStep || typeof currentStep.seconds !== "number" || currentStep.seconds <= 0) return null;
    return getRemainingSeconds(
      {
        startedAt: currentStep.startedAt,
        seconds: currentStep.seconds,
        paused: currentStep.paused,
        pausedAt: currentStep.pausedAt,
      },
      now,
    );
  }, [currentStep, now]);

  if (!currentStep) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">현재 스텝</p>
        <h2 className="text-2xl font-semibold text-slate-900">
          {currentStep.title ?? "지금 진행 중인 안내"}
        </h2>
        {currentStep.prompt ? (
          <p className="whitespace-pre-line text-sm text-slate-700">{currentStep.prompt}</p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {remainingSeconds !== null ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-lg font-semibold text-slate-900">
            {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
            {String(remainingSeconds % 60).padStart(2, "0")}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            타이머 없음
          </span>
        )}
        {qnaOpen ? (
          <button
            type="button"
            onClick={() => {
              const target = document.getElementById("student-qna-card");
              target?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[36px]")}
          >
            질문 카드로 이동
          </button>
        ) : null}
      </div>
    </div>
  );
}
