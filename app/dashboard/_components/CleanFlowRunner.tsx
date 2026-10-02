"use client";

import { type MouseEvent, useEffect, useState } from "react";

import CardTile from "@/app/_components/CardTile";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";
import type { LiveSnapshot } from "@/app/_components/useLiveSync";
import ShareLinkBlock from "@/app/dashboard/_components/ShareLinkBlock";
import type { Flow, FlowStep, FlowStepTarget } from "@/app/dashboard/flows";
import type { ShareLinkInfo } from "@/app/dashboard/shareLinks";
import { getRemainingSeconds } from "@/lib/flow/stepTimer";

function formatElapsed(startedAt: string | null, now: number) {
  if (!startedAt) return null;
  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) return null;
  const diffSeconds = Math.max(0, Math.floor((now - started) / 1000));
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export type FlowRunLogEntry = {
  id: string;
  timestamp: string;
  label: string;
  target: FlowStepTarget;
};

type CleanFlowRunnerProps = {
  boardId?: string | null;
  runnerFlow: Flow | null;
  runnerStep: FlowStep | null;
  liveSnapshot?: LiveSnapshot | null;
  flowStepIndex: number;
  flowShareLoading: boolean;
  flowShareError: string | null;
  flowActionError?: string | null;
  flowShareInfo: ShareLinkInfo | null;
  flowShareTarget: FlowStepTarget | null;
  flowRunLog: FlowRunLogEntry[];
  onRunFlowStep: (event?: MouseEvent<HTMLButtonElement>) => void;
  onPrevFlowStep: () => void;
  onNextFlowStep: () => void;
  onOpenFlowTarget: (target: FlowStepTarget) => void;
  onEditFlow: () => void;
};

export default function CleanFlowRunner({
  boardId,
  runnerFlow,
  runnerStep,
  liveSnapshot,
  flowStepIndex,
  flowShareLoading,
  flowShareError,
  flowActionError,
  flowShareInfo,
  flowShareTarget,
  flowRunLog,
  onRunFlowStep,
  onPrevFlowStep,
  onNextFlowStep,
  onOpenFlowTarget,
  onEditFlow,
}: CleanFlowRunnerProps) {
  const { data: syncSnapshot, publish } = useLiveSync({
    mode: "teacher",
    boardId: boardId ?? undefined,
  });
  const [now, setNow] = useState(() => Date.now());
  const resolvedSnapshot = liveSnapshot ?? syncSnapshot;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const qnaEndsAt = resolvedSnapshot?.qnaEndsAt ?? null;
  const qnaOpen = resolvedSnapshot?.qnaOpen === true && (!qnaEndsAt || qnaEndsAt > now);
  const qnaLabel = qnaOpen
    ? qnaEndsAt
      ? `열림 ${Math.max(0, Math.floor((qnaEndsAt - now) / 1000))}초 남음`
      : "열림"
    : "닫힘";
  const activeSessionId = resolvedSnapshot?.activeSessionId ?? null;
  const sessionElapsed = formatElapsed(resolvedSnapshot?.activeSessionStartedAt ?? null, now);
  const activeStep = resolvedSnapshot?.currentStep ?? null;
  const activeTitle = activeStep?.title ?? runnerStep?.title ?? runnerStep?.label ?? "단계를 선택하세요";
  const activePrompt = activeStep?.prompt ?? runnerStep?.prompt ?? "";
  const remainingSeconds =
    activeStep && typeof activeStep.seconds === "number" && activeStep.seconds > 0
      ? getRemainingSeconds(
          {
            startedAt: activeStep.startedAt,
            seconds: activeStep.seconds,
            paused: activeStep.paused,
            pausedAt: activeStep.pausedAt,
          },
          now,
        )
      : null;

  const handleQnaToggle = async (open: boolean) => {
    if (!publish) return;
    await publish({ qnaOpen: open, qnaEndsAt: open ? null : null, ts: Date.now() });
  };

  return (
    <CardTile variant="present" className="border-emerald-200 bg-white">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
              오늘의 수업 플로우
            </p>
            <h2 className="mt-2 text-xl font-semibold text-emerald-950">
              {runnerFlow?.name ?? "플로우가 없습니다"}
            </h2>
            <p className="text-sm text-emerald-700">
              {runnerFlow ? "단계를 순서대로 실행해 수업 리듬을 유지하세요." : "Manage 모드에서 플로우를 제작해 주세요."}
            </p>
            {activeSessionId && sessionElapsed ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] uppercase">기록중</span>
                <span>{sessionElapsed}</span>
                <span className="uppercase">{activeSessionId.slice(0, 8)}</span>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            {(runnerFlow?.steps ?? []).length > 0 ? (
              runnerFlow?.steps.map((step, index) => {
                const active = runnerStep?.id === step.id;
                return (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-3 text-sm font-semibold",
                      active
                        ? "border-emerald-500 bg-emerald-500 text-white shadow"
                        : "border-emerald-100 bg-emerald-50 text-emerald-900",
                    )}
                  >
                    <span>
                      {index + 1}. {step.label}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[11px]",
                        active ? "bg-white/20 text-white" : "bg-white text-emerald-700",
                      )}
                    >
                      {step.target === "class" ? "수업" : step.target === "present" ? "발표" : "학생"}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-700">
                단계가 없는 플로우입니다. Manage 모드에서 단계를 추가하세요.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onEditFlow}
            data-interactive="true"
            className={cn(buttonTone("secondary", { size: "md" }), "min-h-[44px]")}
          >
            플로우 편집 (Manage로 이동)
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-800">
            <span>Q&amp;A: {qnaLabel}</span>
            <button
              type="button"
              onClick={() => void handleQnaToggle(true)}
              data-interactive="true"
              className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800"
            >
              열기
            </button>
            <button
              type="button"
              onClick={() => void handleQnaToggle(false)}
              data-interactive="true"
              className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800"
            >
              닫기
            </button>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">현재 스텝 미리보기</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-950">{activeTitle}</p>
            {activePrompt ? (
              <p className="mt-2 whitespace-pre-line text-sm text-emerald-800">{activePrompt}</p>
            ) : (
              <p className="mt-2 text-sm text-emerald-700">학생에게 보여줄 안내문을 추가해 주세요.</p>
            )}
            {remainingSeconds !== null ? (
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                <span className="text-xs font-semibold text-emerald-600">남은 시간</span>
                <span className="text-3xl font-semibold text-emerald-950">
                  {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
                  {String(remainingSeconds % 60).padStart(2, "0")}
                </span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-emerald-700">타이머가 없는 스텝입니다.</p>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={(event) => void onRunFlowStep(event)}
              data-interactive="true"
              disabled={!runnerStep}
              className={cn(
                buttonTone("primary", { size: "lg", tone: "emerald" }),
                "min-h-[84px] text-lg",
                !runnerStep ? "cursor-not-allowed opacity-60" : "",
              )}
            >
              스텝 시작
            </button>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={onPrevFlowStep}
                data-interactive="true"
                disabled={!runnerStep || flowStepIndex === 0}
                className={cn(buttonTone("secondary", { size: "md" }), "min-h-[48px]")}
              >
                이전 단계
              </button>
              <button
                type="button"
                onClick={onNextFlowStep}
                data-interactive="true"
                disabled={!runnerStep || flowStepIndex >= (runnerFlow?.steps.length ?? 1) - 1}
                className={cn(buttonTone("secondary", { size: "md" }), "min-h-[48px]")}
              >
                다음 단계
              </button>
            </div>
          </div>
          {flowActionError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {flowActionError} (수동으로 조정할 수 있습니다.)
            </div>
          ) : null}
          {flowShareLoading ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              공유 링크 준비 중…
            </div>
          ) : null}
          {flowShareError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {flowShareError}
            </div>
          ) : null}
          {flowShareInfo ? (
            <div className="space-y-2">
              <ShareLinkBlock shareUrl={flowShareInfo.shareUrl} previewHref={flowShareInfo.shareUrl} />
              <button
                type="button"
                onClick={() => onOpenFlowTarget(flowShareTarget ?? "share")}
                data-interactive="true"
                className={cn(buttonTone("primary", { size: "md", tone: "indigo" }), "min-h-[52px]")}
              >
                {flowShareTarget === "present" ? "발표 화면 열기" : "학생 화면 열기"}
              </button>
            </div>
          ) : null}
          <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
              실행 로그(최근 5개)
            </p>
            <div className="mt-2 space-y-1 text-xs text-emerald-800">
              {flowRunLog.length > 0 ? (
                flowRunLog.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between">
                    <span>
                      {entry.timestamp} · {entry.label}
                    </span>
                    <span>
                      {entry.target === "class" ? "수업" : entry.target === "present" ? "발표" : "학생"}
                    </span>
                  </div>
                ))
              ) : (
                <p>아직 실행 기록이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </CardTile>
  );
}
