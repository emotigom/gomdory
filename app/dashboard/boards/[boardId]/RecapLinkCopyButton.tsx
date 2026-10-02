"use client";

import { useState } from "react";

type RecapLinkCopyButtonProps = {
  url: string;
  className?: string;
};

export default function RecapLinkCopyButton({
  url,
  className = "",
}: RecapLinkCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy recap link", error);
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 ${className}`}
    >
      {copied ? "복사됨" : "링크 복사"}
    </button>
  );
}
