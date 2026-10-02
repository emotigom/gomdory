"use client";

import { useState } from "react";

import type { ShareColumnCount, ShareSortOrder } from "./useShareViewPrefs";

type ShareHeaderProps = {
  title: string;
  description?: string | null;
  shareCode?: string | null;
  shareUrl: string;
  totalCount: number;
  tvMode: boolean;
  onToggleTv: () => void;
  columnCount: ShareColumnCount;
  onColumnChange: (value: ShareColumnCount) => void;
  sortOrder: ShareSortOrder;
  onSortChange: (value: ShareSortOrder) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
};

const columnOptions: Array<{ label: string; value: ShareColumnCount }> = [
  { label: "자동", value: "auto" },
  { label: "1열", value: 1 },
  { label: "2열", value: 2 },
  { label: "3열", value: 3 },
  { label: "4열", value: 4 },
];

export default function ShareHeader({
  title,
  description,
  shareCode,
  shareUrl,
  totalCount,
  tvMode,
  onToggleTv,
  columnCount,
  onColumnChange,
  sortOrder,
  onSortChange,
  searchQuery,
  onSearchChange,
}: ShareHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy link", error);
      setCopied(false);
    }
  };

  const handleColumnChange = (value: string) => {
    if (value === "auto") {
      onColumnChange("auto");
      return;
    }
    const parsed = Number(value);
    if (parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4) {
      onColumnChange(parsed);
    }
  };

  return (
    <header
      className={`sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur ${
        tvMode ? "py-2" : "py-3"
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className={`truncate font-semibold text-slate-900 ${
                  tvMode ? "text-2xl" : "text-xl"
                }`}
              >
                {title}
              </h1>
              {shareCode ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  코드 {shareCode}
                </span>
              ) : null}
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600">
                {totalCount}개
              </span>
            </div>
            {description ? (
              <p className="truncate text-sm text-slate-500" title={description}>
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {copied ? "링크 복사됨" : "링크 복사"}
            </button>
            <button
              type="button"
              onClick={onToggleTv}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                tvMode
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              TV 모드
            </button>
            <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
              열
              <select
                value={columnCount}
                onChange={(event) => handleColumnChange(event.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
              >
                {columnOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
              정렬
              <select
                value={sortOrder}
                onChange={(event) =>
                  onSortChange(event.target.value === "oldest" ? "oldest" : "latest")
                }
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="latest">최신</option>
                <option value="oldest">오래된</option>
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <span className="text-xs text-slate-400">검색</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="작성자나 내용 검색"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
