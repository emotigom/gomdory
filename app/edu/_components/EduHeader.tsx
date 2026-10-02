"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const CoachBackIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className="h-5 w-5"
    aria-hidden="true"
  >
    <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function EduHeader() {
  const pathname = usePathname();
  const isCoachRoute = pathname?.startsWith("/edu/coach");
  const isWebLLMLabRoute = pathname?.startsWith("/edu/ai-lab");

  const headerLabel = isWebLLMLabRoute ? "곰도리 EDU 실험실" : "곰도리 수업";
  const headerTitle = isWebLLMLabRoute ? "WebLLM Lab 진단" : "AI 웹사이트 스튜디오";

  if (isCoachRoute) {
    return (
      <header className="mx-auto flex w-full max-w-[1800px] items-center px-4 py-4 sm:px-6 lg:px-8 2xl:max-w-none 2xl:px-10">
        <Link
          href="/edu/lesson"
          aria-label="뒤로가기"
          className="theme-focus-ring flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] shadow-sm transition hover:-translate-y-0.5"
        >
          <CoachBackIcon />
        </Link>
      </header>
    );
  }

  return (
    <header className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8 2xl:max-w-none 2xl:px-10">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--theme-accent)] text-sm font-black text-white shadow-[0_14px_28px_-18px_rgba(49,87,213,0.8)]">
          곰
        </div>
        <div className="leading-tight">
          <p className="text-xs font-bold text-[var(--theme-accent)]">{headerLabel}</p>
          <h1 className="text-base font-semibold text-[var(--theme-text)]">{headerTitle}</h1>
        </div>
      </div>
      <Link
        href="/"
        className="theme-focus-ring inline-flex min-h-12 items-center rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-2 text-sm font-semibold text-[var(--theme-text)] shadow-sm transition hover:-translate-y-0.5"
      >
        홈
      </Link>
    </header>
  );
}
