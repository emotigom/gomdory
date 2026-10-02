"use client";

import { useState } from "react";

import { buttonTone, cn, surface, tvText } from "@/app/_components/uiTokens";

type RulesOverlayProps = {
  rulesText?: string | null;
  notice?: string | null;
};

export default function RulesOverlay({ rulesText, notice }: RulesOverlayProps) {
  const [open, setOpen] = useState(false);
  const hasContent = Boolean(rulesText?.trim() || notice?.trim());

  if (!hasContent) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={buttonTone("primary", { size: "md", tone: "slate" })}
      >
        규칙/공지
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur">
          <div className={cn("w-full max-w-lg space-y-4", surface.overlay)}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className={cn(tvText.heading, "text-[22px]")}>규칙/공지</h2>
                <p className={cn(tvText.caption, "text-gray-600")}>수업 중 꼭 지켜주세요.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={buttonTone("secondary", { size: "sm" })}
              >
                닫기
              </button>
            </div>
            {rulesText ? (
              <div className="space-y-2">
                <h3 className={cn(tvText.caption, "text-gray-800")}>규칙</h3>
                <p className={cn(tvText.body, "whitespace-pre-wrap")}>{rulesText}</p>
              </div>
            ) : null}
            {notice ? (
              <div className="space-y-2">
                <h3 className={cn(tvText.caption, "text-gray-800")}>공지</h3>
                <p className={cn(tvText.body, "whitespace-pre-wrap")}>{notice}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
