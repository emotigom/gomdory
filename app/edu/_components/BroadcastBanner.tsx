"use client";

import { useCallback, useEffect, useMemo } from "react";

import { useBroadcast } from "@/lib/edu/broadcast/useBroadcast";

type BroadcastBannerProps = {
  boardId: string | null;
  onFocus?: () => void;
  onGenerate?: () => void;
  onPresent?: () => void;
};

const CTA_LABELS: Record<string, string> = {
  generate: "웹사이트 만들기",
  focus: "집중 모드 켜기",
  present: "발표 모드 보기",
};

export default function BroadcastBanner({ boardId, onFocus, onGenerate, onPresent }: BroadcastBannerProps) {
  const { data, dismiss, visible } = useBroadcast(boardId);

  const ctaLabel = useMemo(() => {
    if (!data?.ctaType) return null;
    return data.ctaLabel || CTA_LABELS[data.ctaType] || null;
  }, [data?.ctaLabel, data?.ctaType]);

  const handleCta = useCallback(() => {
    if (!data?.ctaType) return;
    if (data.ctaType === "focus") {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("edu:focus:broadcast", "1");
        window.dispatchEvent(new Event("edu:focus-broadcast"));
      }
      onFocus?.();
      dismiss();
      return;
    }

    if (data.ctaType === "generate") {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("edu:generate:broadcast", "1");
        window.dispatchEvent(new Event("edu:generate-broadcast"));
      }
      onGenerate?.();
      dismiss();
      return;
    }

    if (data.ctaType === "present") {
      if (typeof window !== "undefined") {
        const maybeUrl = data.ctaLabel?.startsWith("http") ? data.ctaLabel : null;
        if (maybeUrl) {
          window.open(maybeUrl, "_blank", "noopener,noreferrer");
        }
      }
      onPresent?.();
      dismiss();
    }
  }, [data?.ctaLabel, data?.ctaType, dismiss, onFocus, onGenerate, onPresent]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      dismiss();
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [dismiss, visible]);

  if (!visible || !data?.message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-[920px] rounded-xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500/80">공지</span>
          <p className="flex-1 text-sm text-slate-700">{data.message}</p>
          {data.ctaType && ctaLabel ? (
            <button
              type="button"
              onClick={handleCta}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
            >
              {ctaLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-transparent px-2 py-1 text-sm text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600"
            aria-label="방송 메시지 닫기"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
