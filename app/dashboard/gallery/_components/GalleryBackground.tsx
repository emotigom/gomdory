"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/app/_components/uiTokens";
import { usePrefersReducedMotion } from "@/lib/ui/motion";

type GalleryBackgroundProps = {
  tvMode?: boolean;
};

export function GalleryBackground({ tvMode = false }: GalleryBackgroundProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const handleMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * (tvMode ? 10 : 7);
      const y = (event.clientY / window.innerHeight - 0.5) * (tvMode ? 8 : 5);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setOffset({ x, y }));
    };

    window.addEventListener("pointermove", handleMove);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointermove", handleMove);
    };
  }, [prefersReducedMotion, tvMode]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const handleScroll = () => {
      const progress = window.scrollY / window.innerHeight;
      const y = -progress * 5;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setOffset((previous) => ({ x: previous.x, y })));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [prefersReducedMotion]);

  return (
    <div
      data-gallery-paper-background
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[var(--theme-bg)]"
      aria-hidden
    >
      <div
        className={cn("absolute inset-[-4rem] transition-transform duration-500", prefersReducedMotion ? "transition-none" : "")}
        style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
      >
        <span className="absolute left-[3%] top-36 h-28 w-16 -rotate-6 border-2 border-[var(--theme-border-strong)] bg-[var(--theme-warning)] opacity-[0.08]" />
        <span className="absolute right-[4%] top-[26rem] h-20 w-32 rotate-3 border-2 border-[var(--theme-border-strong)] bg-[var(--theme-accent)] opacity-[0.08]" />
        <span className="absolute bottom-24 left-[14%] h-16 w-40 -rotate-2 border-2 border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] opacity-40" />
        <span className="absolute bottom-[30%] right-[18%] h-24 w-20 rotate-6 border-2 border-[var(--theme-border)] bg-[var(--theme-bg-elevated)] opacity-50" />
      </div>
      <div className="absolute inset-y-0 left-[7%] border-l-2 border-dashed border-[var(--theme-border)] opacity-20" />
      <div className="absolute inset-y-0 right-[7%] border-r-2 border-dashed border-[var(--theme-border)] opacity-20" />
    </div>
  );
}
