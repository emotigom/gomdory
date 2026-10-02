"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";

type AnnouncementBannerProps = {
  shareCode: string;
  variant?: "student" | "present";
};

export default function AnnouncementBanner({ shareCode, variant = "student" }: AnnouncementBannerProps) {
  const { data: liveSnapshot } = useLiveSync({ mode: "viewer", shareCode });
  const announcement =
    liveSnapshot?.controls?.announcement ?? liveSnapshot?.studentHudSettings?.announcement ?? null;
  const updatedAt =
    liveSnapshot?.controls?.updatedAt ?? null;

  const text = useMemo(() => {
    const trimmed = announcement?.trim() ?? "";
    return trimmed.length ? trimmed.slice(0, 200) : "";
  }, [announcement]);

  const [visibleText, setVisibleText] = useState("");
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!text) {
      setVisibleText("");
      return;
    }
    const key = `${text}:${updatedAt ?? ""}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    setVisibleText(text);
    const timer = window.setTimeout(() => setVisibleText(""), 7000);
    return () => window.clearTimeout(timer);
  }, [text, updatedAt]);

  if (!visibleText) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-40 w-full border-b px-4 py-2 text-sm font-semibold",
        variant === "present"
          ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
        <span className="text-base" aria-hidden>
          📣
        </span>
        <span className="truncate md:text-base">{visibleText}</span>
      </div>
    </div>
  );
}
