"use client";

import { useState } from "react";

type Props = {
  value: string;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
  className?: string;
};

export function LinkCopyButton({
  value,
  disabled = false,
  label = "복사",
  ariaLabel,
  className,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (disabled) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("copy failed", error);
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`text-xs font-semibold text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-gray-400 ${className ?? ""}`}
    >
      {copied ? "복사됨" : label}
    </button>
  );
}
