"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";

import { cn, hairlineBorderClass } from "@/app/_components/uiTokens";

export type GalleryTemplate = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  coverUrl: string | null;
  installCount?: number;
  createdAt?: string;
  accessLevel?: "free" | "pro";
  badge?: string | null;
  gradeBand?: string | null;
  subject?: string | null;
  isFeatured?: boolean;
};

type GalleryCardProps = {
  template: GalleryTemplate;
  onPreview: () => void;
  onPrimary: () => void;
  onUpgrade?: () => void;
  onReport?: () => void;
  locked?: boolean;
  installing?: boolean;
  reporting?: boolean;
  tone?: "indigo" | "emerald" | "sky";
};

const MAX_TILT = 6;

const templateControlBase =
  "templates-control inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold";
const templateSecondaryControl = `${templateControlBase} templates-control-secondary`;
const templatePrimaryControl = `${templateControlBase} templates-control-primary`;
const templateLockedControl = `${templateControlBase} templates-control-locked cursor-pointer`;

export function GalleryCard({
  template,
  onPreview,
  onPrimary,
  onUpgrade,
  onReport,
  locked = false,
  installing = false,
  reporting = false,
  tone = "indigo",
}: GalleryCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event: MediaQueryListEvent | MediaQueryList) => setPrefersReducedMotion(!!event.matches);
    handler(media);
    const listener = (event: MediaQueryListEvent) => handler(event);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  useEffect(() => () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
  }, []);

  const applyTilt = (x: number, y: number) => {
    if (!cardRef.current) return;
    cardRef.current.style.setProperty("--tilt-x", `${x}deg`);
    cardRef.current.style.setProperty("--tilt-y", `${y}deg`);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || keyboardFocus) return;
    const node = cardRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = Math.max(Math.min(((offsetX - centerX) / centerX) * MAX_TILT, MAX_TILT), -MAX_TILT);
    const rotateX = Math.max(Math.min(((centerY - offsetY) / centerY) * MAX_TILT, MAX_TILT), -MAX_TILT);

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = requestAnimationFrame(() => applyTilt(rotateX, rotateY));
  };

  const handlePointerLeave = () => {
    if (!cardRef.current) return;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    applyTilt(0, 0);
  };

  const coverToneClass = useMemo(() => {
    if (tone === "emerald") return "from-emerald-500/70 via-emerald-400/60 to-emerald-300/60";
    if (tone === "sky") return "from-sky-500/70 via-sky-400/60 to-sky-300/60";
    return "from-indigo-500/70 via-indigo-400/60 to-indigo-300/60";
  }, [tone]);

  const badgeLabel = template.accessLevel === "pro" ? "PRO" : template.badge ?? null;

  const badgeToneClass =
    template.accessLevel === "pro"
      ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200/70"
      : "bg-white/80 text-slate-900 ring-1 ring-white/70";

  return (
    <article
      ref={cardRef}
      className={cn(
        "templates-card",
        "relative flex h-full flex-col overflow-hidden rounded-3xl bg-white/95",
        hairlineBorderClass,
        "shadow-[0_24px_120px_-88px_rgba(15,23,42,0.65)]",
        "transition-transform duration-300 will-change-transform",
      )}
      style={{
        transform: prefersReducedMotion || keyboardFocus ? undefined : "perspective(1200px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
      onFocus={() => setKeyboardFocus(true)}
      onBlur={() => setKeyboardFocus(false)}
      tabIndex={0}
      data-templates-interaction-scope
      data-motion={prefersReducedMotion ? "static" : "interactive"}
      data-template-id={template.id}
    >
      <div className="relative h-52 overflow-hidden">
        <div className={cn("absolute inset-0 bg-gradient-to-br", coverToneClass)} aria-hidden />
        {template.coverUrl && !coverFailed ? (
          <Image
            src={template.coverUrl}
            alt={`${template.title} 커버 이미지`}
            fill
            sizes="(min-width: 1280px) 420px, 100vw"
            className={cn("object-cover transition-opacity duration-300", coverLoaded ? "opacity-100" : "opacity-0")}
            onLoadingComplete={() => setCoverLoaded(true)}
            onError={() => {
              setCoverFailed(true);
              setCoverLoaded(true);
            }}
            priority={template.isFeatured}
          />
        ) : null}
        {!coverLoaded ? <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
          {badgeLabel ? (
            <span className={cn("rounded-full px-3 py-1", badgeToneClass)}>{badgeLabel}</span>
          ) : null}
          {template.gradeBand ? (
            <span className="rounded-full bg-white/80 px-3 py-1 text-slate-900 ring-1 ring-white/70">
              {template.gradeBand === "elem" ? "초등" : template.gradeBand === "middle" ? "중등" : "혼합"}
            </span>
          ) : null}
          {template.subject ? (
            <span className="rounded-full bg-white/80 px-3 py-1 text-slate-900 ring-1 ring-white/70">{template.subject}</span>
          ) : null}
        </div>
        <div className="absolute bottom-4 left-4 right-4 space-y-2 text-white drop-shadow">
          <h3 className="text-2xl font-semibold leading-tight line-clamp-2">{template.title}</h3>
          {template.description ? (
            <p className="text-sm leading-snug text-slate-100/90 line-clamp-2">{template.description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-3 p-5">
        <div className="flex flex-wrap gap-2 text-[12px] font-semibold text-slate-600">
          {typeof template.installCount === "number" ? (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {template.installCount.toLocaleString()}명 사용
            </span>
          ) : null}
          {template.createdAt ? (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {new Date(template.createdAt).toLocaleDateString("ko-KR")}
            </span>
          ) : null}
          {template.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-slate-50 px-3 py-1 text-slate-700">
              #{tag}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {template.tags.slice(3, 6).map((tag) => (
            <span key={`${template.id}-${tag}`} className="rounded-full bg-slate-50 px-2 py-1 font-semibold">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/70 p-4 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-interactive="true"
            data-testid={`gallery-preview-${template.id}`}
            onClick={onPreview}
            className={templateSecondaryControl}
          >
            미리보기
          </button>
          <button
            type="button"
            data-interactive="true"
            data-testid={`gallery-install-${template.id}`}
            aria-disabled={locked}
            onClick={() => (locked ? onUpgrade?.() : onPrimary())}
            className={cn(
              locked ? templateLockedControl : templatePrimaryControl,
              !locked ? `templates-control-${tone}` : "",
              installing ? "opacity-70" : "",
            )}
          >
            {locked ? "잠금 해제" : installing ? "복제 중..." : "복제"}
          </button>
          {onReport ? (
            <button
              type="button"
              data-interactive="true"
              onClick={onReport}
              className="templates-control templates-control-danger ml-auto inline-flex min-h-[36px] items-center justify-center rounded-xl border border-transparent px-3 py-2 text-xs font-semibold"
              disabled={reporting}
            >
              {reporting ? "신고 중..." : "신고"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
