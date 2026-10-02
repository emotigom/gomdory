"use client";

import { forwardRef, useEffect, useState } from "react";

import { cn } from "@/app/_components/uiTokens";

type ShareGuideCtaButtonProps = {
  variant: "collapsed" | "expanded";
  onClick: () => void;
};

const ShareGuideCtaButton = forwardRef<HTMLButtonElement, ShareGuideCtaButtonProps>(function ShareGuideCtaButton(
  { variant, onClick },
  ref,
) {
  const [attention, setAttention] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (variant !== "collapsed" || prefersReducedMotion) {
      setAttention(false);
      return;
    }
    setAttention(true);
    const timer = window.setTimeout(() => setAttention(false), 6000);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion, variant]);

  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label="공유링크 열기"
      title="공유링크"
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-md border border-[var(--ui-border)] bg-white text-slate-700 shadow-sm transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-focus)] focus-visible:ring-offset-2",
        variant === "collapsed"
          ? "h-7 w-7 text-sm hover:bg-[var(--bg-cream)] group-hover:scale-105"
          : "h-10 px-4 text-sm font-semibold hover:bg-[var(--bg-cream)]",
      )}
    >
      {attention && variant === "collapsed" ? (
        <span className="pointer-events-none absolute -inset-1 rounded-md bg-[conic-gradient(from_0deg,#f472b6,#a78bfa,#60a5fa,#34d399,#fbbf24,#f472b6)] opacity-80 animate-[spin_1.2s_linear_infinite]">
          <span className="absolute inset-[2px] rounded-md bg-slate-50/95" />
        </span>
      ) : null}
      <span className="relative z-10 flex h-5 w-5 items-center justify-center translate-x-[50px]text-base leading-none shrink-0" aria-hidden>
        🔗
      </span>
      <span
        className={cn(
          "relative z-10 whitespace-nowrap font-semibold transition",
          variant === "collapsed"
            ? "max-w-0 overflow-hidden opacity-0 group-hover:ml-1 group-hover:max-w-[120px] group-hover:opacity-100"
            : "opacity-100",
        )}
      >
        공유링크
      </span>
    </button>
  );
});

ShareGuideCtaButton.displayName = "ShareGuideCtaButton";

export default ShareGuideCtaButton;
