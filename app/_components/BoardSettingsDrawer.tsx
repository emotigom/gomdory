"use client";

import { useEffect, useRef, useState } from "react";

type BoardSettingsDrawerProps = {
  title?: string;
  children: React.ReactNode;
  /** When true, render an icon-only trigger (no visible text). */
  iconOnly?: boolean;
  /** Tooltip + aria-label for the trigger button. */
  triggerLabel?: string;
  /** Extra classes applied to the trigger button. */
  triggerClassName?: string;
};

export function CopyTextButton({ value, disabled = false }: { value: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy", error);
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:text-gray-400"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

export function ConfirmSubmitButton({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      className={className}
    >
      {children}
    </button>
  );
}

export default function BoardSettingsDrawer({
  title = "보드 설정",
  children,
  iconOnly = false,
  triggerLabel = "설정",
  triggerClassName,
}: BoardSettingsDrawerProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (path.includes(panel)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={triggerLabel}
        aria-label={triggerLabel}
        className={
          "flex items-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 " +
          (iconOnly ? "px-2" : "") +
          (triggerClassName ? " " + triggerClassName : "")
        }
      >
        {iconOnly ? null : <span>{triggerLabel}</span>}
        <span aria-hidden>⚙️</span>
      </button>

      {open ? (
        <div className="pointer-events-none fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" aria-hidden />
          <div
            ref={panelRef}
            data-no-compose-open
            className="pointer-events-auto absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
