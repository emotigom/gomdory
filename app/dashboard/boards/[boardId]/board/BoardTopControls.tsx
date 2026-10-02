"use client";

import type { RefObject, ReactNode } from "react";
import ShareGuideCtaButton from "@/app/dashboard/_components/ShareGuideCtaButton";

type BoardTopControlsProps = {
  shouldShowAdminPanels: boolean;
  shareGuideCtaRef: RefObject<HTMLButtonElement | null>;
  onOpenShareGuide: () => void;
  onOpenBoardSettings: () => void;
  onOpenDrawer: () => void;
  presentationToggleButton: ReactNode;
  showSecondaryActions: boolean;
};

export default function BoardTopControls({
  shouldShowAdminPanels,
  shareGuideCtaRef,
  onOpenShareGuide,
  onOpenBoardSettings,
  onOpenDrawer,
  presentationToggleButton,
  showSecondaryActions,
}: BoardTopControlsProps) {
  return (
    <div className="group flex items-center gap-2">
      <ShareGuideCtaButton ref={shareGuideCtaRef} variant="collapsed" onClick={onOpenShareGuide} />
      {shouldShowAdminPanels ? (
        <>
          <button
            type="button"
            onClick={onOpenBoardSettings}
            className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            aria-label="보드 설정"
            title="보드 설정"
          >
            ⚙️
          </button>
          <button
            type="button"
            onClick={onOpenDrawer}
            className="flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            aria-label="관리 패널"
            title="관리 패널"
          >
            ☰
          </button>
        </>
      ) : null}
      <div className={showSecondaryActions ? "" : "opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"}>{presentationToggleButton}</div>
    </div>
  );
}
