"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/app/_components/uiTokens";
import { usePrefersReducedMotion } from "@/lib/ui/motion";

type GalleryAction = {
  label: string;
  href?: string;
  tone?: "primary" | "secondary" | "ghost";
  target?: string;
  onClick?: () => void;
  disabled?: boolean;
};

type GalleryCardProps = {
  title: string;
  description: string;
  subtitle?: string;
  shareCode?: string | null;
  badge?: string;
  tag?: string;
  coverMark: string;
  coverLabel: string;
  coverTone: "accent" | "success" | "warning" | "ink";
  actions: GalleryAction[];
  tvMode?: boolean;
  spotlighted?: boolean;
  tileIndex: number;
};

function resolveToneClass(tone: GalleryAction["tone"]) {
  if (tone === "secondary") {
    return "bg-[var(--theme-surface)] text-[var(--theme-text)] shadow-[3px_3px_0_var(--theme-border)] hover:bg-[var(--theme-surface-muted)] hover:shadow-[4px_4px_0_var(--theme-border-strong)]";
  }
  if (tone === "ghost") {
    return "bg-transparent text-[var(--theme-text)] shadow-none hover:bg-[var(--theme-surface-muted)]";
  }
  return "bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-[3px_3px_0_var(--theme-border-strong)] hover:-translate-y-0.5 hover:bg-[var(--theme-accent-strong)] hover:shadow-[4px_4px_0_var(--theme-border-strong)]";
}

function resolveCoverToneClass(tone: GalleryCardProps["coverTone"]) {
  if (tone === "success") {
    return "border-l-[12px] border-l-[var(--theme-success)] bg-[color-mix(in_srgb,var(--theme-success)_12%,var(--theme-bg-elevated))]";
  }
  if (tone === "warning") {
    return "border-l-[12px] border-l-[var(--theme-warning)] bg-[color-mix(in_srgb,var(--theme-warning)_12%,var(--theme-bg-elevated))]";
  }
  if (tone === "ink") {
    return "border-l-[12px] border-l-[var(--theme-text)] bg-[var(--theme-bg-elevated)]";
  }
  return "border-l-[12px] border-l-[var(--theme-accent)] bg-[color-mix(in_srgb,var(--theme-accent)_12%,var(--theme-bg-elevated))]";
}

function resolveCoverStripClass(tone: GalleryCardProps["coverTone"]) {
  if (tone === "success") return "bg-[var(--theme-success)]";
  if (tone === "warning") return "bg-[var(--theme-warning)]";
  if (tone === "ink") return "bg-[var(--theme-text)]";
  return "bg-[var(--theme-accent)]";
}

export function GalleryCard({
  title,
  description,
  subtitle,
  shareCode,
  badge,
  tag,
  coverMark,
  coverLabel,
  coverTone,
  actions,
  tvMode = false,
  spotlighted = false,
  tileIndex,
}: GalleryCardProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const frameRef = useRef<number | null>(null);
  const targetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLElement | null>(null);
  const pointerBlockedRef = useRef(false);
  const autoFrameRef = useRef<number | null>(null);

  const commitTilt = useCallback(() => {
    const { x, y } = targetRef.current;
    setTilt({ x, y });
    frameRef.current = null;
  }, []);

  const queueTilt = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(commitTilt);
  }, [commitTilt]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (autoFrameRef.current) cancelAnimationFrame(autoFrameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!tvMode || prefersReducedMotion) return;
    const start = performance.now();
    const tick = (now: number) => {
      const time = (now - start) / 1000;
      targetRef.current = { x: Math.sin(time) * 1.3, y: Math.cos(time * 0.9) * 0.9 };
      queueTilt();
      autoFrameRef.current = requestAnimationFrame(tick);
    };
    autoFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (autoFrameRef.current) cancelAnimationFrame(autoFrameRef.current);
      autoFrameRef.current = null;
    };
  }, [prefersReducedMotion, queueTilt, tvMode]);

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (tvMode || prefersReducedMotion || pointerBlockedRef.current) return;
    const node = cardRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rotateY = ((x - rect.width / 2) / rect.width) * 6;
    const rotateX = -((y - rect.height / 2) / rect.height) * 4;
    targetRef.current = { x: rotateY, y: rotateX };
    queueTilt();
  };

  const handlePointerLeave = () => {
    targetRef.current = { x: 0, y: 0 };
    queueTilt();
    setHovered(false);
  };

  const handlePointerEnter = (event: React.PointerEvent<HTMLElement>) => {
    if (tvMode) return;
    if (event.pointerType === "touch") {
      pointerBlockedRef.current = true;
      return;
    }
    pointerBlockedRef.current = false;
    setHovered(true);
  };

  return (
    <article
      ref={cardRef}
      data-gallery-work-card
      data-gallery-tile-index={tileIndex}
      data-autoplay-spotlight={spotlighted ? "true" : "false"}
      className={cn(
        "group relative flex min-h-[330px] flex-col border-2 border-[var(--theme-border-strong)] bg-[var(--theme-card)] shadow-[6px_6px_0_var(--theme-border)] transition",
        "focus-within:ring-4 focus-within:ring-[var(--theme-focus)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--theme-bg)]",
        tvMode ? "min-h-[390px]" : "",
        prefersReducedMotion ? "transition-none" : "",
        spotlighted ? "ring-4 ring-[var(--theme-focus)] ring-offset-4 ring-offset-[var(--theme-bg)]" : "",
      )}
      style={{
        transform: `perspective(1200px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) translateY(${hovered ? "-3px" : "0"}) ${
          spotlighted ? "scale(1.015)" : ""
        }`,
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerEnter={handlePointerEnter}
      onBlur={handlePointerLeave}
    >
      <div
        className={cn("h-3 w-full border-b-2 border-[var(--theme-border-strong)]", resolveCoverStripClass(coverTone))}
        aria-hidden
      />

      <div className="relative border-b-2 border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] p-4">
        <span
          className="absolute -top-2 left-[18%] z-10 h-5 w-16 -rotate-3 border border-[var(--theme-border)] bg-[var(--theme-bg-elevated)] opacity-80"
          aria-hidden
        />
        <div
          className={cn(
            "relative overflow-hidden border-2 border-[var(--theme-border-strong)]",
            resolveCoverToneClass(coverTone),
            tvMode ? "h-[180px]" : "h-[145px]",
          )}
        >
          <div aria-hidden className="absolute inset-0 opacity-35 [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_27px,var(--theme-border)_28px)]" />
          <div className="absolute inset-4 flex flex-col justify-between border border-[var(--theme-border-strong)] bg-[var(--theme-card)] p-3 shadow-[3px_3px_0_var(--theme-border-strong)]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-black tracking-[0.13em] text-[var(--theme-text-muted)]">수업 기록</span>
              <span className="border-b border-[var(--theme-border-strong)] px-1 text-[10px] font-black text-[var(--theme-text-muted)]">{coverLabel}</span>
            </div>
            <div className="flex min-w-0 items-end justify-between gap-4">
              <span aria-hidden className={cn("shrink-0 font-black leading-none tracking-[-0.08em] text-[var(--theme-text)]", tvMode ? "text-6xl" : "text-5xl")}>{coverMark}</span>
              <p className="line-clamp-2 min-w-0 max-w-[68%] text-right text-sm font-black leading-5 text-[var(--theme-text)]">{title}</p>
            </div>
          </div>
          {badge ? (
            <span className="absolute -bottom-px right-3 border-2 border-[var(--theme-border-strong)] bg-[var(--theme-text)] px-3 py-1 text-[10px] font-black tracking-[0.12em] text-[var(--theme-bg)] shadow-[2px_2px_0_var(--theme-bg-elevated)]">
              {badge}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-5 p-5">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className={cn("font-black leading-tight tracking-[-0.035em] text-[var(--theme-text)]", tvMode ? "text-2xl" : "text-xl")}>
              {title}
            </h3>
            {tag ? (
              <span className="shrink-0 border border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] px-2 py-1 font-mono text-[10px] font-black tracking-[0.08em] text-[var(--theme-text-muted)]">
                {tag}
              </span>
            ) : null}
          </div>
          <p className={cn("mt-3 font-medium leading-6 text-[var(--theme-text-muted)]", tvMode ? "text-base" : "text-sm")}>
            {description}
          </p>

          {(subtitle || shareCode) ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--theme-border)] pt-3 text-xs font-bold text-[var(--theme-text-subtle)]">
              {subtitle ? <span>{subtitle}</span> : null}
              {shareCode ? (
                <span className="border border-[var(--theme-border-strong)] bg-[var(--theme-bg-elevated)] px-2 py-1 font-mono text-[11px] font-black tracking-[0.06em] text-[var(--theme-text)]">
                  공유 코드 {shareCode}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, index) => {
            const actionClass = cn(
              "inline-flex min-h-12 items-center justify-center rounded-[4px] border-2 border-[var(--theme-border-strong)] px-3 text-center text-sm font-black transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-card)]",
              tvMode ? "min-h-14 px-4 text-base" : "",
              resolveToneClass(action.tone),
              action.disabled ? "cursor-not-allowed opacity-60 shadow-none" : "",
              prefersReducedMotion ? "transition-none" : "",
            );

            if (action.onClick) {
              return (
                <button
                  key={`${action.label}-${index}`}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={actionClass}
                  data-interactive="true"
                >
                  {action.label}
                </button>
              );
            }

            if (!action.href) {
              return (
                <button
                  key={`${action.label}-${index}`}
                  type="button"
                  className={cn(actionClass, "cursor-not-allowed bg-[var(--theme-surface-muted)] text-[var(--theme-text-subtle)]")}
                  aria-disabled
                  data-interactive="true"
                >
                  {action.label}
                </button>
              );
            }

            return (
              <Link
                key={`${action.label}-${index}`}
                href={action.href}
                prefetch={false}
                data-interactive="true"
                target={action.target}
                className={actionClass}
              >
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
    </article>
  );
}
