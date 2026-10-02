"use client";

import { useState } from "react";

type SessionSummaryCopyButtonProps = {
  text: string;
  label?: string;
  className?: string;
};

export default function SessionSummaryCopyButton({
  text,
  label = "요약 복사",
  className = "",
}: SessionSummaryCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy session summary", error);
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 ${className}`}
    >
      {copied ? "복사됨" : label}
    </button>
  );
}
