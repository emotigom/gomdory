"use client";

import { useEffect, useState } from "react";

const coachmarkStorageKey = "gom.dashboard.hints-v1.coachmark-seen";

function HintSparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M10 3.8v2.1M10 14.1v2.1M4.5 10h2.1M13.4 10h2.1M5.9 5.9l1.5 1.5M12.6 12.6l1.5 1.5M14.1 5.9l-1.5 1.5M7.4 12.6l-1.5 1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DashboardInlineHint({ text }: { text: string }) {
  return (
    <span className="group inline-flex items-center gap-1 text-slate-500">
      <span
        tabIndex={0}
        className="inline-flex size-5 items-center justify-center rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] bg-white text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2"
        aria-label="도움말 보기"
      >
        <HintSparkIcon />
      </span>
      <span className="hidden text-xs text-slate-600 group-hover:inline group-focus-within:inline">{text}</span>
    </span>
  );
}

export function DashboardHintsCoachmark() {
  const [showCoachmark, setShowCoachmark] = useState(false);

  useEffect(() => {
    // one-time coachmark for new users; do not block content with overlays.
    const hasSeenCoachmark = window.localStorage.getItem(coachmarkStorageKey) === "1";
    if (!hasSeenCoachmark) {
      setShowCoachmark(true);
      window.localStorage.setItem(coachmarkStorageKey, "1");
    }
  }, []);

  if (!showCoachmark) {
    return null;
  }

  return (
    <div
      data-testid="dashboard-coachmark"
      className="flex items-center gap-2 rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2 text-xs text-slate-600"
    >
      <HintSparkIcon />
      <p className="ui-content-selectable">다음 행동은 1번부터 시작하면 가장 빠릅니다.</p>
      <button
        type="button"
        onClick={() => setShowCoachmark(false)}
        className="ml-auto inline-flex h-7 items-center rounded-[var(--ui-radius-sm)] border border-[var(--ui-border)] px-2 text-[11px] font-medium text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2"
      >
        확인
      </button>
    </div>
  );
}

