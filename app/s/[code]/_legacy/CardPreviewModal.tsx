"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, type SVGProps } from "react";
import { cn, surface } from "@/app/_components/uiTokens";
import type { StudentCard } from "@/lib/student/boardModel";

const ArrowLeftIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
  </svg>
);

const ArrowRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
  </svg>
);

const NoSymbolIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 5.5l13 13" />
  </svg>
);

const XMarkIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
  </svg>
);

export type CardPreviewModalProps = {
  items: StudentCard[];
  activeId: string | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  tvMode: boolean;
};

const isImageCard = (card: StudentCard) => card.meta?.hasImage || Boolean(card.thumbUrl);

const getFocusableElements = (container: HTMLElement | null) => {
  if (!container) return [];
  const focusable = container.querySelectorAll<HTMLElement>(
    "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
  );
  return Array.from(focusable);
};

export default function CardPreviewModal({
  items,
  activeId,
  onClose,
  onNext,
  onPrev,
  tvMode,
}: CardPreviewModalProps) {
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const activeCard = useMemo(
    () => (activeId ? items.find((card) => card.id === activeId) ?? null : null),
    [activeId, items],
  );

  useEffect(() => {
    if (!activeCard) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight") {
        onNext();
      } else if (event.key === "ArrowLeft") {
        onPrev();
      } else if (event.key === "Tab") {
        const focusable = getFocusableElements(dialogRef.current);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    const focusable = getFocusableElements(dialogRef.current);
    focusable[0]?.focus();

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [activeCard, onClose, onNext, onPrev]);

  const joinToken = searchParams.get("jt")?.trim() ?? "";
  const linkUrl = activeCard?.meta?.linkUrl ?? null;
  const resolvedLinkUrl = useMemo(() => {
    if (!linkUrl || !joinToken) return linkUrl;
    try {
      const parsed = new URL(linkUrl, window.location.origin);
      const isEduLesson = parsed.pathname.startsWith("/edu/lesson");
      if (!isEduLesson) return linkUrl;
      if (!parsed.searchParams.get("jt")) {
        parsed.searchParams.set("jt", joinToken);
      }
      const isRelative = !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(linkUrl);
      return isRelative ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString();
    } catch {
      return linkUrl;
    }
  }, [joinToken, linkUrl]);

  if (!activeCard) return null;

  const title = activeCard.title ?? "카드 프리뷰";
  const body = activeCard.text?.trim() || "내용이 없는 카드입니다.";
  const authorLabel = activeCard.authorLabel ?? "학생";
  const createdAt = activeCard.createdAt
    ? new Date(activeCard.createdAt).toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;
  const mediaUrl = activeCard.thumbUrl;
  const showImage = mediaUrl && isImageCard(activeCard);
  const fileUrl = activeCard.meta?.fileUrl;
  const isLink = activeCard.kind === "link" && linkUrl;
  const isFile = activeCard.kind === "file" && fileUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="카드 프리뷰"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={cn("relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-slate-100/80 bg-white/98 shadow-[0_36px_160px_-110px_rgba(15,23,42,0.7)]", tvMode ? "p-8" : "p-6")}
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">카드 프리뷰</p>
            <h2 className={cn("font-semibold text-slate-900", tvMode ? "text-3xl" : "text-2xl")}>{title}</h2>
            <p className={cn("text-slate-500", tvMode ? "text-base" : "text-sm")}>
              {authorLabel}
              {createdAt ? ` · ${createdAt}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              className={cn(
                "flex items-center justify-center gap-2 rounded-full border border-slate-200/90 px-4 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50",
                tvMode ? "h-12 text-base" : "h-10 text-sm",
              )}
            >
              <ArrowLeftIcon className="h-5 w-5" aria-hidden />
              이전
            </button>
            <button
              type="button"
              onClick={onNext}
              className={cn(
                "flex items-center justify-center gap-2 rounded-full border border-slate-200/90 px-4 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50",
                tvMode ? "h-12 text-base" : "h-10 text-sm",
              )}
            >
              다음
              <ArrowRightIcon className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex items-center justify-center rounded-full border border-slate-200/90 text-xl text-slate-500 transition hover:border-slate-300 hover:bg-slate-50",
                tvMode ? "h-12 w-12" : "h-10 w-10",
              )}
              aria-label="닫기"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            {showImage ? (
              <div className="overflow-hidden rounded-3xl bg-slate-100 ring-1 ring-slate-200/80">
                <Image
                  src={mediaUrl}
                  alt={title}
                  width={1200}
                  height={800}
                  className="h-full w-full object-contain"
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  loading="lazy"
                  unoptimized
                />
              </div>
            ) : isLink || isFile ? (
              <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50/80 px-4 py-5 text-slate-700">
                <NoSymbolIcon className="h-6 w-6 text-slate-400" aria-hidden />
                <div>
                  <p className="font-semibold text-slate-900">첨부 미리보기가 없습니다</p>
                  <p className="text-sm text-slate-600">아래 첨부 영역에서 파일이나 링크를 확인하세요.</p>
                </div>
              </div>
            ) : null}
            <div className={cn("rounded-3xl bg-slate-50/80 text-slate-800 ring-1 ring-slate-100", tvMode ? "p-6 text-lg" : "p-5 text-base")}>
              <p className="whitespace-pre-line leading-relaxed">{body}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_60px_-50px_rgba(15,23,42,0.35)]">
              <p className="text-sm font-semibold text-slate-700">카드 정보</p>
              <dl className="mt-3 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">타입</dt>
                  <dd className="font-semibold uppercase text-slate-800">{activeCard.kind}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">작성자</dt>
                  <dd className="font-semibold text-slate-800">{authorLabel}</dd>
                </div>
                {createdAt ? (
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">작성 시각</dt>
                    <dd className="font-semibold text-slate-800">{createdAt}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {(isLink || isFile) && (fileUrl || linkUrl) ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_60px_-50px_rgba(15,23,42,0.35)]">
                <p className="text-sm font-semibold text-slate-700">{isFile ? "첨부 파일" : "외부 링크"}</p>
                <p className="mt-2 break-all text-sm text-slate-600">{fileUrl ?? linkUrl}</p>
                {isFile && fileUrl ? (
                  <Link
                    href={fileUrl}
                    className={cn(
                      "mt-3 inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-700",
                      tvMode ? "h-11 text-base" : "h-10 text-sm",
                    )}
                  >
                    파일 열기
                  </Link>
                ) : null}
                {isLink && resolvedLinkUrl ? (
                  <Link
                    href={resolvedLinkUrl}
                    className={cn(
                      "mt-3 inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-700",
                      tvMode ? "h-11 text-base" : "h-10 text-sm",
                    )}
                  >
                    링크 열기
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5">
              <p className="text-sm font-semibold text-indigo-800">무엇을 도와드릴까요?</p>
              <p className="mt-2 text-sm text-indigo-700">질문/도움/이해도 입력은 아래 액션 바에서 바로 열립니다.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="#student-action-bar" className={cn(surface.card, "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-indigo-700 shadow-none ring-1 ring-indigo-100")}>
                  액션 바로 이동
                </Link>
                <button
                  type="button"
                  className="rounded-2xl border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50"
                  onClick={() => document.getElementById("student-action-bar")?.scrollIntoView({ behavior: "smooth" })}
                >
                  질문/도움 요청
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
