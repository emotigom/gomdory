"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type OverlayModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

const getFocusableElements = (container: HTMLElement | null) => {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute("disabled") && element.tabIndex >= 0,
  );
};

export default function OverlayModal({ open, onClose, title, actions, children }: OverlayModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const ariaLabel = title ?? "발표 모드";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousActiveRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      previousActiveRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!activeElement || activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const modalContent = useMemo(
    () => (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-2 py-3 backdrop-blur-sm sm:px-3"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          className="max-h-[90vh] w-[calc(100vw-12px)] overflow-auto rounded-2xl border border-slate-200 bg-white/95 shadow-sm sm:w-[calc(100vw-16px)] 2xl:w-[min(2400px,calc(100vw-24px))] mx-auto"
        >
          <div className="sticky top-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/95 px-2 py-2 backdrop-blur-sm sm:px-3 sm:py-3">
            {title ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-700">{title}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                닫기
              </button>
            </div>
          </div>
          <div className="px-2 py-2 sm:px-3 sm:py-3">{children}</div>
        </div>
      </div>
    ),
    [actions, ariaLabel, children, onClose, title],
  );

  if (!open || !mounted) {
    return null;
  }

  return createPortal(modalContent, document.body);
}
