"use client";

import { useState } from "react";

import { buildJoinUrl, buildShareUrl } from "@/lib/http/publicLinks";

function CopyButton({ value, disabled }: { value: string; disabled: boolean }) {
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
      className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-gray-400"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

type ShareLinksProps = {
  code: string | null;
  boardViewType: "grid" | "wall" | "mindmap" | "gen";
};

export default function ShareLinks({ code, boardViewType }: ShareLinksProps) {
  const entryUrl = buildJoinUrl();
  const directUrl = code ? buildShareUrl(code) : "";
  const directLabel = boardViewType === "grid" ? "학생 바로 입장 (그리드 기준)" : "학생 바로 입장";

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">학생 입장 페이지</p>
          <p className="text-sm text-gray-700">{entryUrl}</p>
          <a href={entryUrl} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            입장 코드로 열기
          </a>
        </div>
        <CopyButton value={entryUrl} disabled={false} />
      </div>

      <div className="h-px bg-gray-200" />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">{directLabel}</p>
          {code ? (
            <p className="text-sm text-gray-700">{directUrl}</p>
          ) : (
            <p className="text-sm text-gray-500">공유 코드를 생성하면 표시됩니다.</p>
          )}
        </div>
        <CopyButton value={directUrl} disabled={!code} />
      </div>
    </div>
  );
}
