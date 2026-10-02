"use client";

import type { MouseEvent, RefObject } from "react";

import CardTile from "@/app/_components/CardTile";
import { cn } from "@/app/_components/uiTokens";
import type { DashboardBoardSummary } from "@/lib/data/boards";

import type { Flow, FlowStep, FlowStepTarget } from "../flows";
import type { LiveSnapshot } from "@/app/_components/useLiveSync";
import type { ClassPreset, ClassPresetSettings } from "../presets";
import type { ShareLinkInfo } from "../shareLinks";
import ClassPresetSheet from "./ClassPresetSheet";
import SpotlightPanel from "./SpotlightPanel";
import QuestionQueuePanel from "./QuestionQueuePanel";
import PresencePanel from "./PresencePanel";
import SessionRecordPanel from "./SessionRecordPanel";
import TriagePanel from "./TriagePanel";

type FocusFlowConsoleProps = {
  focusBoard: DashboardBoardSummary | null;
  focusPreset: ClassPreset | null;
  focusBoardId: string | null;
  focusShareInfo: ShareLinkInfo | null;
  runnerFlow: Flow | null;
  runnerStep: FlowStep | null;
  liveSnapshot?: LiveSnapshot | null;
  flowStepIndex: number;
  flowShareInfo: ShareLinkInfo | null;
  flowShareTarget: FlowStepTarget | null;
  flowShareLoading: boolean;
  flowShareError: string | null;
  flowActionError?: string | null;
  presetSheetOpen: boolean;
  presets: ClassPreset[];
  shareCode: string | null;
  presetButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenPreset: () => void;
  onClosePresetSheet: () => void;
  onRecent: (boardId: string) => void;
  onFlowRun: () => void;
  onFlowNext: () => void;
  onFlowPrev: () => void;
  onOpenFlowTarget: (target: FlowStepTarget) => void;
  onShareReady: (info: ShareLinkInfo) => void;
  onRunPreset: (
    event: MouseEvent<HTMLButtonElement>,
    preset: ClassPreset,
    settings: ClassPresetSettings,
    shareInfo?: ShareLinkInfo | null,
  ) => void;
  networkStatus: string;
  lockMode: boolean;
};

export default function FocusFlowConsole({
  focusBoard,
  focusPreset,
  focusBoardId,
  focusShareInfo,
  runnerFlow,
  runnerStep,
  liveSnapshot,
  flowStepIndex,
  flowShareInfo,
  flowShareTarget,
  flowShareLoading,
  flowShareError,
  flowActionError,
  presetSheetOpen,
  presets,
  shareCode,
  presetButtonRef,
  onOpenPreset,
  onClosePresetSheet,
  onRecent,
  onFlowRun,
  onFlowNext,
  onFlowPrev,
  onOpenFlowTarget,
  onShareReady,
  onRunPreset,
  networkStatus,
  lockMode,
}: FocusFlowConsoleProps) {
  const presentUrl = focusShareInfo?.presentUrl ?? null;
  const shareUrl = focusShareInfo?.shareUrl ?? null;
  const isLive = Boolean(liveSnapshot?.activeSessionId);
  const toolsEnabled = focusBoard?.toolsEnabled ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <div className="space-y-4">
        <SpotlightPanel
          board={focusBoard}
          preset={focusPreset}
          onRecent={onRecent}
          onOpenPreset={onOpenPreset}
          presetButtonRef={presetButtonRef}
          shareInfo={focusShareInfo}
          flow={runnerFlow}
          flowStep={runnerStep}
          liveSnapshot={liveSnapshot}
          flowStepIndex={flowStepIndex}
          onFlowRun={onFlowRun}
          onFlowNext={onFlowNext}
          onFlowPrev={onFlowPrev}
          flowShareInfo={flowShareInfo}
          flowShareTarget={flowShareTarget}
          onOpenFlowTarget={onOpenFlowTarget}
          flowShareLoading={flowShareLoading}
          flowShareError={flowShareError}
          flowActionError={flowActionError}
        />
        {presetSheetOpen ? (
          <ClassPresetSheet
            isOpen={presetSheetOpen}
            target="present"
            presets={presets}
            initialPresetId={focusPreset?.id ?? null}
            anchorRef={presetButtonRef}
            disabled={!focusBoardId}
            helper={
              !focusBoardId ? (
                <div className="text-sm text-amber-700">보드를 먼저 선택하세요.</div>
              ) : (
                <div className="text-sm text-amber-700">공유 링크가 없으면 자동으로 준비됩니다.</div>
              )
            }
            boardId={focusBoardId}
            shareCode={shareCode}
            shareInfo={focusShareInfo}
            onShareReady={onShareReady}
            onClose={onClosePresetSheet}
            onRun={onRunPreset}
          />
        ) : null}
        <QuestionQueuePanel boardId={focusBoardId} toolsEnabled={toolsEnabled} />
        <TriagePanel
          boardId={focusBoardId}
          snapshot={liveSnapshot ?? null}
          toolsEnabled={toolsEnabled}
        />
      </div>
      <div className="space-y-4">
        <SessionRecordPanel
          boardId={focusBoardId}
          shareCode={shareCode}
          activeSessionId={liveSnapshot?.activeSessionId ?? null}
          activeSessionStartedAt={liveSnapshot?.activeSessionStartedAt ?? null}
        />
        <PresencePanel boardId={focusBoardId} shareCode={shareCode} toolsEnabled={toolsEnabled} />
        <CardTile variant="dense" subdued className="border-indigo-500/40 bg-slate-950/70 text-slate-100">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-100">공지/잠금 상태</p>
            <p className="text-xs text-indigo-200">공지 배너는 수업 화면에서 설정합니다.</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-100">
                공지 준비됨
              </span>
              <span
                className={lockMode ? "rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200" : "rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200"}
              >
                {lockMode ? "읽기 전용 ON" : "편집 가능"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-100">
                {isLive ? "LIVE" : "대기"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-100">
                네트워크 {networkStatus}
              </span>
            </div>
          </div>
        </CardTile>
        <CardTile variant="present" className="border-indigo-500/40 bg-slate-950/70 text-slate-100">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-indigo-100">즉시 액션</p>
            <div className="grid gap-2">
              <a
                href={presentUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                data-interactive="true"
                className={cn(
                  "flex min-h-[52px] items-center justify-between rounded-xl border px-3 text-sm font-semibold",
                  presentUrl ? "border-indigo-500/40 bg-indigo-600 text-white" : "border-white/10 bg-white/5 text-slate-400",
                )}
              >
                발표 열기
                <span className="text-xs opacity-80">Present</span>
              </a>
              <a
                href={shareUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                data-interactive="true"
                className={cn(
                  "flex min-h-[52px] items-center justify-between rounded-xl border px-3 text-sm font-semibold",
                  shareUrl ? "border-indigo-500/40 bg-white/10 text-indigo-100" : "border-white/10 bg-white/5 text-slate-400",
                )}
              >
                공유 링크
                <span className="text-xs opacity-70">Share</span>
              </a>
              <button
                type="button"
                disabled
                className="flex min-h-[52px] items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-400"
              >
                타이머/벨
                <span className="text-xs opacity-70">준비중</span>
              </button>
            </div>
          </div>
        </CardTile>
      </div>
    </div>
  );
}
