"use client";

import { useState } from "react";

import { cn } from "@/app/_components/uiTokens";

type LibraryCopyButtonProps = {
  value: string;
  label: string;
  copiedLabel?: string;
  className?: string;
};

export default function LibraryCopyButton({
  value,
  label,
  copiedLabel = "복사됨",
  className,
}: LibraryCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleCopy = async () => {
    setFailed(false);

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable");
      }

      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setFailed(true);
      window.setTimeout(() => setFailed(false), 2200);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-sm border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-xs font-semibold text-[var(--ui-ink)] transition hover:bg-[var(--ui-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-surface)]",
        className,
      )}
      aria-live="polite"
    >
      {failed ? "복사 실패" : copied ? copiedLabel : label}
    </button>
  );
}
