"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type RefObject } from "react";

import CardTile from "@/app/_components/CardTile";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import type { DashboardBoardSummary } from "@/lib/data/boards";
import { boardBoardHref, boardHubHref } from "@/lib/dashboard/boardHrefs";
import { getProjectorUrl, getStudentUrl } from "@/lib/share/shareUrls";

import { scheduleDashboardForceNavigationFallback } from "../forceNavigationFallback";
import { type Flow, type FlowStep, type FlowStepTarget } from "../flows";
import { formatPresetEffects, type ClassPreset } from "../presets";
import ShareLinkBlock from "./ShareLinkBlock";
import { buildShareLinkInfo, type ShareLinkInfo } from "../shareLinks";
import type { LiveSnapshot } from "@/app/_components/useLiveSync";
import { getRemainingSeconds } from "@/lib/flow/stepTimer";

type SpotlightPanelProps = {
  board: DashboardBoardSummary | null;
  preset: ClassPreset | null;
  onRecent: (boardId: string) => void;
  onOpenPreset: () => void;
  presetButtonRef?: RefObject<HTMLButtonElement | null>;
  shareInfo?: ShareLinkInfo | null;
  flow?: Flow | null;
  flowStep?: FlowStep | null;
  liveSnapshot?: LiveSnapshot | null;
  flowStepIndex?: number;
  onFlowRun?: () => void;
  onFlowNext?: () => void;
  onFlowPrev?: () => void;
  flowShareInfo?: ShareLinkInfo | null;
  flowShareTarget?: FlowStepTarget | null;
  onOpenFlowTarget?: (target: FlowStepTarget) => void;
  flowShareLoading?: boolean;
  flowShareError?: string | null;
  flowActionError?: string | null;
};

export default function SpotlightPanel({
  board,
  preset,
  onRecent,
  onOpenPreset,
  presetButtonRef,
  shareInfo,
  flow,
  flowStep,
  liveSnapshot,
  flowStepIndex = 0,
  onFlowRun,
  onFlowNext,
  onFlowPrev,
  flowShareInfo,
  flowShareTarget,
  onOpenFlowTarget,
  flowShareLoading,
  flowShareError,
  flowActionError,
}: SpotlightPanelProps) {
  const boardId = board?.boardId ?? null;
  const shareAvailable = Boolean(board?.shareEnabled && board?.shareCode);
  const shareBaseUrl = shareAvailable ? getStudentUrl(board?.shareCode ?? "") : null;
  const presentUrl = shareAvailable ? getProjectorUrl(board?.shareCode ?? "") : null;
  const presetEffects = preset ? formatPresetEffects(preset.settings) : [];
  const [resolvedShareInfo, setResolvedShareInfo] = useState<ShareLinkInfo | null>(shareInfo ?? null);

  useEffect(() => {
    if (shareInfo) {
      setResolvedShareInfo(shareInfo);
      return;
    }

    if (!boardId || !board?.shareCode) {
      setResolvedShareInfo(null);
      return;
    }

    setResolvedShareInfo(buildShareLinkInfo(boardId, board.shareCode));
  }, [board?.shareCode, boardId, shareInfo]);

  const resolvedPresentUrl = useMemo(
    () => resolvedShareInfo?.presentUrl ?? presentUrl,
    [presentUrl, resolvedShareInfo],
  );
  const previewUrl = useMemo(() => resolvedShareInfo?.shareUrl ?? null, [resolvedShareInfo]);
  const resolvedShareReady = Boolean(resolvedShareInfo ?? (shareAvailable && presentUrl));
  const flowPreviewShareUrl = resolvedShareInfo?.shareUrl ?? shareBaseUrl;
  const flowPreviewPresentUrl = resolvedShareInfo?.presentUrl ?? presentUrl;
  const [now, setNow] = useState(() => Date.now());
  const currentStep = liveSnapshot?.currentStep ?? null;
  const remainingSeconds =
    currentStep && typeof currentStep.seconds === "number" && currentStep.seconds > 0
      ? getRemainingSeconds(
          {
            startedAt: currentStep.startedAt,
            seconds: currentStep.seconds,
            paused: currentStep.paused,
            pausedAt: currentStep.pausedAt,
          },
          now,
        )
      : null;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <CardTile
      variant="present"
      className="relative overflow-hidden border-indigo-300 bg-white shadow-[0_18px_60px_-36px_rgba(79,70,229,0.6)]"
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-indigo-400/60 shadow-[0_0_40px_rgba(99,102,241,0.35)]" />
      <div className="relative z-10 flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">현재 교실</p>
          <h2 className="mt-3 text-3xl font-semibold text-gray-900">
            {board?.title ?? "보드를 선택해 주세요"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {board?.description ?? "집중 발표를 위한 대표 보드를 선택하세요."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={boardId ? `/dashboard/boards/${boardId}/board` : "#"}
              aria-disabled={!boardId}
              data-interactive="true"
              className={cn(
                buttonTone("secondary", { size: "sm" }),
                "min-h-[40px]",
                !boardId ? "pointer-events-none opacity-60" : "",
              )}
            >
              보드 열기
            </Link>
            <Link
              href={boardId ? boardHubHref(boardId) : "#"}
              aria-disabled={!boardId}
              data-interactive="true"
              className={cn(
                buttonTone("secondary", { size: "sm" }),
                "min-h-[40px]",
                !boardId ? "pointer-events-none opacity-60" : "",
              )}
            >
              최근 리포트
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-500">
                ACTIVE PRESET
              </p>
              <p className="mt-1 text-base font-semibold text-indigo-950">
                {preset?.name ?? "프리셋 미지정"}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenPreset}
              data-interactive="true"
              ref={presetButtonRef}
              className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
            >
              프리셋 변경
            </button>
          </div>
          {preset ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-indigo-700">
              {presetEffects.map((label) => (
                <span key={label} className="rounded-full bg-white/70 px-2 py-1">
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-indigo-700">기본 프리셋으로 실행됩니다.</p>
          )}
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Flow Console</p>
              <p className="mt-2 text-base font-semibold text-indigo-950">
                {flow?.name ?? "플로우 미지정"}
              </p>
              <p className="text-xs text-indigo-700">
                {flowStep
                  ? `${flowStepIndex + 1}단계 · ${flowStep.label}`
                  : "플로우 단계를 선택하세요."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onFlowPrev}
                data-interactive="true"
                disabled={!flowStep || !onFlowPrev}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
              >
                이전
              </button>
              <button
                type="button"
                onClick={onFlowRun}
                data-interactive="true"
                disabled={!flowStep || !onFlowRun}
                className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "min-h-[44px]")}
              >
                실행
              </button>
              <button
                type="button"
                onClick={onFlowNext}
                data-interactive="true"
                disabled={!flowStep || !onFlowNext}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
              >
                다음
              </button>
            </div>
          </div>
          {flowShareLoading ? (
            <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              공유 링크 준비 중…
            </div>
          ) : null}
          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-500">
              Present HUD
            </p>
            <p className="mt-2 text-sm font-semibold text-indigo-950">
              {currentStep?.title ?? currentStep?.prompt ?? "현재 진행 중인 스텝이 없습니다."}
            </p>
            {currentStep?.prompt ? (
              <p className="mt-1 whitespace-pre-line text-xs text-indigo-800">{currentStep.prompt}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-700">
              {remainingSeconds !== null ? (
                <span className="rounded-full border border-indigo-200 bg-white px-3 py-1">
                  남은 시간 {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
                  {String(remainingSeconds % 60).padStart(2, "0")}
                </span>
              ) : (
                <span className="rounded-full border border-indigo-200 bg-white px-3 py-1">
                  타이머 없음
                </span>
              )}
              <span className="rounded-full border border-indigo-200 bg-white px-3 py-1">
                스텝 변경: H/J 또는 ←/→
              </span>
            </div>
            {flowActionError ? (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                {flowActionError} (수동으로 조정 가능)
              </p>
            ) : null}
          </div>
          {flowShareError ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {flowShareError}
            </div>
          ) : null}
          {flowShareInfo ? (
            <div className="mt-3">
              <ShareLinkBlock shareUrl={flowShareInfo.shareUrl} previewHref={flowShareInfo.shareUrl} />
            </div>
          ) : null}
          {flowShareInfo && flowShareTarget && onOpenFlowTarget ? (
            <button
              type="button"
              onClick={() => onOpenFlowTarget(flowShareTarget)}
              data-interactive="true"
              className={cn(buttonTone("primary", { size: "sm", tone: "indigo" }), "mt-3 min-h-[44px]")}
            >
              {flowShareTarget === "present" ? "발표 화면 열기" : "학생 화면 열기"}
            </button>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-indigo-700">
            {flowPreviewShareUrl ? (
              <a
                href={flowPreviewShareUrl}
                target="_blank"
                rel="noreferrer"
                data-interactive="true"
                className="rounded-full border border-indigo-200 bg-white px-3 py-1"
              >
                학생 화면 미리보기(새 탭)
              </a>
            ) : null}
            {flowPreviewPresentUrl ? (
              <a
                href={flowPreviewPresentUrl}
                target="_blank"
                rel="noreferrer"
                data-interactive="true"
                className="rounded-full border border-indigo-200 bg-white px-3 py-1"
              >
                발표 화면(새 탭)
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2" data-interactive="true">
          <Link
            href={boardId ? boardBoardHref(boardId) : "#"}
            aria-disabled={!boardId}
            data-force-nav={boardId ? "true" : undefined}
            data-interactive="true"
            prefetch={false}
            onClick={(event) => {
              if (!boardId) {
                event.preventDefault();
                return;
              }
              onRecent(boardId);
              scheduleDashboardForceNavigationFallback(event, boardBoardHref(boardId));
            }}
            className={cn(
              buttonTone("primary", { size: "lg", tone: "indigo" }),
              "min-h-[56px] text-base",
              !boardId ? "pointer-events-none opacity-60" : "",
            )}
          >
            수업 시작
          </Link>
          {resolvedShareReady ? (
            <a
              href={resolvedPresentUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              data-interactive="true"
              className={cn(buttonTone("secondary", { size: "lg" }), "min-h-[52px]")}
            >
              발표
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="공유 코드가 활성화되어야 합니다."
              className={cn(buttonTone("secondary", { size: "lg" }), "min-h-[52px] cursor-not-allowed text-gray-400")}
            >
              발표
            </button>
          )}
          {resolvedShareInfo ? (
            <ShareLinkBlock
              shareUrl={resolvedShareInfo.shareUrl}
              previewHref={previewUrl}
              className="mt-3"
            />
          ) : null}
          <Link
            href={boardId ? boardHubHref(boardId) : "#"}
            aria-disabled={!boardId}
            data-force-nav={boardId ? "true" : undefined}
            data-interactive="true"
            onClick={(event) => {
              if (!boardId) {
                event.preventDefault();
                return;
              }
              onRecent(boardId);
              scheduleDashboardForceNavigationFallback(event, boardHubHref(boardId));
            }}
            className={cn(
              buttonTone("secondary", { size: "lg" }),
              "min-h-[52px] border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
              !boardId ? "pointer-events-none opacity-60" : "",
            )}
          >
            보드 열기
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-600">
          {shareAvailable ? <span>공유 링크 준비됨</span> : <span>공유 링크 없음</span>}
          <span aria-hidden>•</span>
          <span>집중 화면</span>
        </div>
      </div>
    </CardTile>
  );
}
