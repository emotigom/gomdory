"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/app/_components/uiTokens";
import type { StudentView } from "@/lib/student/view";
import type { StudentBoardFilter, StudentBoardSort } from "@/lib/student/studentBoardFilters";

const VIEW_OPTIONS: StudentView[] = ["wall", "columns", "gallery", "stream"];

const VIEW_LABELS: Record<StudentView, string> = {
  wall: "Wall",
  columns: "Columns",
  gallery: "Gallery",
  stream: "Stream",
};

const updateViewSearchParams = (params: URLSearchParams, view: StudentView) => {
  const next = new URLSearchParams(params);
  next.set("view", view);
  return next;
};

export default function StudentBoardTopBar({
  title,
  shareCode,
  view,
  tvMode,
  query,
  filter,
  sort,
  onQueryChange,
  onFilterChange,
  onSortChange,
  onJumpToFirstResult,
}: {
  title: string;
  shareCode: string;
  view: StudentView;
  tvMode: boolean;
  query: string;
  filter: StudentBoardFilter;
  sort: StudentBoardSort;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: StudentBoardFilter) => void;
  onSortChange: (value: StudentBoardSort) => void;
  onJumpToFirstResult?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inputValue, setInputValue] = useState(query);

  const filterOptions: Array<{ value: StudentBoardFilter; label: string }> = useMemo(
    () => [
      { value: "all", label: "전체" },
      { value: "text", label: "텍스트" },
      { value: "image", label: "이미지" },
      { value: "file", label: "파일" },
      { value: "question", label: "질문" },
      { value: "notice", label: "공지" },
    ],
    [],
  );

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onQueryChange(inputValue);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [inputValue, onQueryChange]);

  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_120px_-80px_rgba(15,23,42,0.35)] backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
            공유 보드
          </span>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            코드 {shareCode.toUpperCase()}
          </span>
        </div>
        <div>
          <h1 className={cn("font-semibold leading-tight text-slate-900", tvMode ? "text-3xl" : "text-2xl")}>{
            title
          }</h1>
          <p className={cn("text-slate-500", tvMode ? "text-base" : "text-sm")}>학생 카드가 모이는 공유 화면입니다.</p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 lg:w-auto">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50/70 p-2 ring-1 ring-slate-200/70",
              tvMode ? "text-base" : "text-sm",
            )}
            role="tablist"
            aria-label="보드 뷰 전환"
          >
            {VIEW_OPTIONS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => {
                  const nextParams = updateViewSearchParams(searchParams, key);
                  router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
                }}
                className={cn(
                  "flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                  tvMode ? "min-h-[52px] px-6" : "min-h-[44px]",
                  view === key
                    ? "bg-white text-indigo-700 shadow-[0_16px_80px_-60px_rgba(79,70,229,0.55)] ring-1 ring-indigo-100"
                    : "text-slate-700 ring-1 ring-transparent hover:bg-white hover:ring-slate-200",
                )}
              >
                {VIEW_LABELS[key]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => document.getElementById("student-action-bar")?.scrollIntoView({ behavior: "smooth" })}
            className={cn(
              "flex min-h-[44px] items-center justify-center rounded-full bg-indigo-600 px-5 font-semibold text-white transition hover:bg-indigo-700",
              tvMode ? "text-base" : "text-sm",
            )}
          >
            질문/도움요청
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1">
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onJumpToFirstResult?.();
                }
              }}
              placeholder="검색…"
              className={cn(
                "h-11 w-full rounded-full border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 shadow-sm transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200",
                tvMode ? "text-base" : "text-sm",
              )}
              aria-label="카드 검색"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFilterChange(option.value)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold transition",
                  tvMode ? "text-sm" : "text-xs",
                  filter === option.value
                    ? "bg-indigo-600 text-white shadow-[0_12px_40px_-26px_rgba(79,70,229,0.7)]"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as StudentBoardSort)}
            className={cn(
              "h-11 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200",
              tvMode ? "text-sm" : "text-xs",
            )}
            aria-label="정렬"
          >
            <option value="new">최신</option>
            <option value="old">오래된</option>
          </select>
        </div>
      </div>
    </div>
  );
}
