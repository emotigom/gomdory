"use client";

import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "@/lib/ui/motion";

type PresentGuideOverlayProps = {
  open: boolean;
  shareCode: string;
  onClose: () => void;
  onRequestExpandJoinDock?: () => void;
};

const focusableSelectors = [
  "button",
  "[href]",
  "input",
  "select",
  "textarea",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function PresentGuideOverlay({ open, shareCode, onClose, onRequestExpandJoinDock }: PresentGuideOverlayProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const getFocusableElements = () => {
    if (!overlayRef.current) return [];
    return Array.from(overlayRef.current.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
      (node) => !node.hasAttribute("disabled"),
    );
  };

  useEffect(() => {
    if (!open) return;
    const focusableElements = getFocusableElements();
    const firstFocusable = focusableElements[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      const focusableElements = getFocusableElements();
      if (event.key === "Tab" && focusableElements.length > 0) {
        const active = document.activeElement as HTMLElement | null;
        const currentIndex = active ? focusableElements.indexOf(active) : -1;
        const nextIndex = event.shiftKey
          ? currentIndex <= 0
            ? focusableElements.length - 1
            : currentIndex - 1
          : currentIndex < 0 || currentIndex === focusableElements.length - 1
            ? 0
            : currentIndex + 1;
        focusableElements[nextIndex]?.focus();
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="발표 가이드"
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6 ${prefersReducedMotion ? "" : "transition-opacity duration-300"} bg-black/70 backdrop-blur`}
    >
      <div
        ref={overlayRef}
        className={`relative w-full max-w-3xl rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 via-gray-900 to-black p-6 text-white shadow-2xl ${
          prefersReducedMotion ? "" : "animate-[fadeIn_240ms_ease-out]"
        }`}
      >
        <div className="flex flex-wrap items-start gap-3">
          <span className="rounded-full border border-emerald-200/70 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-50">
            초보자 안내
          </span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
            코드 {shareCode}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto h-11 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition hover:border-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            닫기
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">3단계 안내</p>
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">프로젝터를 켜면 바로 이렇게 안내하세요</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: "Step 1", body: "학생은 gkrry.com에 접속 → 공유 코드를 입력합니다." },
              { title: "Step 2", body: "질문/도움 요청은 오른쪽 요청 패널에 실시간으로 쌓입니다." },
              { title: "Step 3", body: "교사는 Focus 화면에서 승인/숨김/핀으로 제어합니다." },
            ].map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-white/15 bg-white/5 p-4 shadow-inner shadow-white/5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">{step.title}</p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-white/90">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onRequestExpandJoinDock?.();
              }}
              className="h-12 rounded-xl bg-white px-4 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              QR 크게 보기
            </button>
            <p className="text-sm text-white/80">Focus는 교사용 대시보드에서 제어합니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
