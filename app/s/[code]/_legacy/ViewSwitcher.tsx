"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/app/_components/uiTokens";
import type { StudentView } from "@/lib/student/view";

const VIEW_OPTIONS: StudentView[] = ["wall", "columns", "gallery", "stream"];

const VIEW_LABELS: Record<StudentView, string> = {
  wall: "Wall",
  columns: "Columns",
  gallery: "Gallery",
  stream: "Stream",
};

export const updateViewSearchParams = (params: URLSearchParams, view: StudentView) => {
  const next = new URLSearchParams(params);
  next.set("view", view);
  return next;
};

type ViewSwitcherProps = {
  value: StudentView;
  tvMode: boolean;
};

export default function ViewSwitcher({ value, tvMode }: ViewSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50/70 p-2 ring-1 ring-slate-200/70 backdrop-blur",
        tvMode ? "text-base" : "text-sm",
      )}
      role="tablist"
      aria-label="보드 뷰 전환"
    >
      {VIEW_OPTIONS.map((key) => (
        <Link
          key={key}
          href={`${pathname}?${updateViewSearchParams(searchParams, key).toString()}`}
          replace
          scroll={false}
          role="tab"
          aria-selected={value === key}
          aria-current={value === key ? "page" : undefined}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey) {
              return;
            }
            event.preventDefault();
            const nextParams = updateViewSearchParams(searchParams, key);
            router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
          }}
          className={cn(
            "flex min-h-[44px] items-center gap-2 rounded-xl px-5 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
            tvMode ? "min-h-[52px] px-6" : "min-h-[44px]",
            value === key
              ? "bg-white text-indigo-700 shadow-[0_16px_80px_-60px_rgba(79,70,229,0.55)] ring-1 ring-indigo-100"
              : "text-slate-700 ring-1 ring-transparent hover:bg-white hover:ring-slate-200",
          )}
        >
          <span>{VIEW_LABELS[key]}</span>
        </Link>
      ))}
    </div>
  );
}
