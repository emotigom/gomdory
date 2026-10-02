"use client";

import { useState } from "react";

type RequestIdCopyButtonProps = {
  requestId: string;
};

type CopyState = "idle" | "copied" | "manual";

export default function RequestIdCopyButton({ requestId }: RequestIdCopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");

  const handleCopy = async () => {
    if (!requestId) return;

    try {
      await navigator.clipboard.writeText(requestId);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1400);
    } catch {
      setState("manual");
      window.setTimeout(() => setState("idle"), 2400);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-6 items-center border border-slate-300 px-1.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
        aria-label={`Copy request_id ${requestId}`}
        title="request_id 복사"
      >
        Copy
      </button>
      <span className="select-text" aria-live="polite">
        {state === "copied" ? <span className="text-[10px] text-emerald-700">복사됨</span> : null}
        {state === "manual" ? <span className="text-[10px] text-amber-700">복사 실패 · request_id를 선택해 복사하세요.</span> : null}
      </span>
    </div>
  );
}
