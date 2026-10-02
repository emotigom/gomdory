"use client";

import React, { useEffect, useMemo, useState } from "react";

import { buttonTone, cn, hairlineBorderClass } from "@/app/_components/uiTokens";
import type { DashboardMode } from "../useDashboardMode";
import type { OnboardingChecklistState } from "../useOnboardingChecklist";

type OnboardingChecklistModalProps = {
  shouldAutoOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
  dismissed: boolean;
  onDismiss: () => void;
  onResetDismiss: () => void;
  mode: DashboardMode;
  boardCount: number;
  checklistState: OnboardingChecklistState;
  onCreateBoard: () => void;
  onOpenSharePanel: () => void;
  onOpenPresentHud: () => void;
};

const stepTitles = {
  board: "보드 만들기",
  share: "공유코드 확인",
  present: "발표/HUD 또는 리모컨",
};

export function OnboardingChecklistModal({
  shouldAutoOpen,
  isOpen,
  onOpenChange,
  dismissed,
  onDismiss,
  onResetDismiss,
  mode,
  boardCount,
  checklistState,
  onCreateBoard,
  onOpenSharePanel,
  onOpenPresentHud,
}: OnboardingChecklistModalProps) {
  const [localOpen, setLocalOpen] = useState(() => Boolean(shouldAutoOpen));
  const resolvedOpen = isOpen ?? localOpen;
  const setResolvedOpen = onOpenChange ?? setLocalOpen;

  useEffect(() => {
    if (shouldAutoOpen) {
      setResolvedOpen(true);
    }
  }, [setResolvedOpen, shouldAutoOpen]);

  const completedCount = useMemo(() => {
    return [checklistState.boardCreated, checklistState.shareOpened, checklistState.presentOpened].filter(Boolean)
      .length;
  }, [checklistState.boardCreated, checklistState.presentOpened, checklistState.shareOpened]);

  const isComplete =
    checklistState.boardCreated &&
    checklistState.shareOpened &&
    checklistState.presentOpened;

  if (!resolvedOpen) {
    return null;
  }

  const modeCopy =
    mode === "focus"
      ? {
          headline: "HUD/관제 바로 실행",
          detail: "Focus 모드에 맞춘 발표/리모컨 CTA를 우선합니다.",
          presentLabel: "HUD/리모컨 열기",
        }
      : mode === "manage"
        ? {
            headline: "정리/프리셋 흐름을 바로 시작",
            detail: "Manage 모드에서는 핵심 체크리스트만 빠르게 안내합니다.",
            presentLabel: "발표/HUD 열기",
          }
        : {
            headline: "수업 시작 런처",
            detail: "Clean 모드에서 바로 수업을 시작할 수 있도록 돕습니다.",
            presentLabel: "발표/HUD 열기",
          };

  const shareDisabled = boardCount < 1;
  const presentDisabled = boardCount < 1;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      data-testid="onboarding-checklist-modal"
    >
      <div className="w-full max-w-5xl rounded-[32px] bg-white p-6 shadow-2xl md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[44px] font-semibold leading-tight text-slate-900">
                30초 시작 체크리스트
              </p>
              {isComplete ? (
                <span className="rounded-full bg-emerald-100 px-4 py-1 text-sm font-semibold text-emerald-700">
                  완료! 이제 수업을 시작할 수 있어요
                </span>
              ) : null}
            </div>
            <p className="text-lg font-semibold text-slate-700">{modeCopy.headline}</p>
            <p className="text-sm text-slate-500">{modeCopy.detail}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <button
              type="button"
              onClick={() => setResolvedOpen(false)}
              className={buttonTone("ghost", { size: "sm" })}
              data-interactive="true"
            >
              닫기
            </button>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={dismissed}
                onChange={(event) => {
                  if (event.target.checked) {
                    onDismiss();
                  } else {
                    onResetDismiss();
                  }
                }}
              />
              다시 보지 않기
            </label>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div
            className={cn(
              "rounded-2xl border bg-slate-50/80 p-4",
              hairlineBorderClass,
              checklistState.boardCreated
                ? "border-emerald-200 bg-emerald-50/70"
                : "border-slate-200",
            )}
          >
            <p className="text-xs font-semibold text-slate-500">STEP 1</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stepTitles.board}</p>
            <p className="mt-2 text-sm text-slate-600">
              새 보드를 만든 뒤 제목을 입력하면 바로 시작할 수 있어요.
            </p>
            <button
              type="button"
              onClick={onCreateBoard}
              className={cn("mt-4 w-full", buttonTone("primary", { size: "lg", tone: "indigo" }))}
              data-interactive="true"
            >
              새 보드 만들기
            </button>
          </div>

          <div
            className={cn(
              "rounded-2xl border bg-slate-50/80 p-4",
              hairlineBorderClass,
              checklistState.shareOpened
                ? "border-emerald-200 bg-emerald-50/70"
                : "border-slate-200",
            )}
          >
            <p className="text-xs font-semibold text-slate-500">STEP 2</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stepTitles.share}</p>
            <p className="mt-2 text-sm text-slate-600">
              보드를 만들면 자동으로 공유코드가 생성됩니다.
            </p>
            <button
              type="button"
              onClick={onOpenSharePanel}
              className={cn("mt-4 w-full", buttonTone("secondary", { size: "lg" }))}
              disabled={shareDisabled}
              data-interactive="true"
            >
              {shareDisabled ? "보드를 먼저 만들어주세요" : "공유 패널 열기"}
            </button>
          </div>

          <div
            className={cn(
              "rounded-2xl border bg-slate-50/80 p-4",
              hairlineBorderClass,
              checklistState.presentOpened
                ? "border-emerald-200 bg-emerald-50/70"
                : "border-slate-200",
            )}
          >
            <p className="text-xs font-semibold text-slate-500">STEP 3</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stepTitles.present}</p>
            <p className="mt-2 text-sm text-slate-600">
              HUD 또는 리모컨을 열어 바로 발표를 시작하세요.
            </p>
            <button
              type="button"
              onClick={onOpenPresentHud}
              className={cn("mt-4 w-full", buttonTone("secondary", { size: "lg" }))}
              disabled={presentDisabled}
              data-interactive="true"
            >
              {presentDisabled ? "보드를 먼저 만들어주세요" : modeCopy.presentLabel}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-700">
            진행 상태 {completedCount}/3
          </p>
          <p className="text-sm text-slate-500">
            {isComplete ? "모든 체크리스트를 완료했습니다." : "각 단계는 자동으로 완료 처리됩니다."}
          </p>
        </div>
      </div>
    </div>
  );
}
