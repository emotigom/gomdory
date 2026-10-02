"use client";

import { useEffect, useMemo, useRef, type SVGProps } from "react";
import { cn } from "@/app/_components/uiTokens";
import { classifyAttachment } from "@/lib/cards/attachmentPresentation";
import type { StudentBoardItem } from "@/lib/student/normalizeStudentItems";

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

const XMarkIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
  </svg>
);

const isImageAttachment = (attachment: StudentBoardItem["attachments"][number]) =>
  classifyAttachment({ contentType: attachment.contentType, name: attachment.label }) === "image";

const getFocusableElements = (container: HTMLElement | null) => {
  if (!container) return [];
  const focusable = container.querySelectorAll<HTMLElement>(
    "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
  );
  return Array.from(focusable);
};

const formatDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export type PreviewModalProps = {
  items: StudentBoardItem[];
  activeId: string | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  tvMode: boolean;
};

export default function PreviewModal({
  items,
  activeId,
  onClose,
  onNext,
  onPrev,
  tvMode,
}: PreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const activeItem = useMemo(
    () => (activeId ? items.find((item) => item.id === activeId) ?? null : null),
    [activeId, items],
  );

  useEffect(() => {
    if (!activeItem) return undefined;
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
  }, [activeItem, onClose, onNext, onPrev]);

  if (!activeItem) return null;

  const createdAt = formatDate(activeItem.createdAt);
  const imageAttachment = activeItem.attachments.find(isImageAttachment);
  const attachments = activeItem.attachments.filter((attachment) => attachment !== imageAttachment);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label="카드 프리뷰"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={cn(
          "relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[32px] border border-slate-100/80 bg-white/98 shadow-[0_36px_160px_-110px_rgba(15,23,42,0.7)]",
          tvMode ? "p-8" : "p-6",
        )}
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Preview</p>
            <h2 className={cn("font-semibold text-slate-900", tvMode ? "text-3xl" : "text-2xl")}>
              {activeItem.title ?? "카드 프리뷰"}
            </h2>
            <p className={cn("text-slate-500", tvMode ? "text-base" : "text-sm")}>
              {activeItem.author ?? "익명"}
              {createdAt ? ` · ${createdAt}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPrev}
              className={cn(
                "flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-slate-200/90 px-4 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50",
                tvMode ? "text-base" : "text-sm",
              )}
            >
              <ArrowLeftIcon className="h-5 w-5" aria-hidden />
              이전
            </button>
            <button
              type="button"
              onClick={onNext}
              className={cn(
                "flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-slate-200/90 px-4 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50",
                tvMode ? "text-base" : "text-sm",
              )}
            >
              다음
              <ArrowRightIcon className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/90 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
              aria-label="닫기"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {imageAttachment ? (
              <div className="overflow-hidden rounded-3xl bg-slate-100 ring-1 ring-slate-200/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageAttachment.url}
                  alt={activeItem.title ?? "카드 이미지"}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </div>
            ) : null}
            <div className={cn("rounded-3xl bg-slate-50/80 text-slate-800 ring-1 ring-slate-100", tvMode ? "p-6 text-lg" : "p-5 text-base")}>
              <p className="whitespace-pre-line leading-relaxed">{activeItem.body?.trim() || "내용이 없는 카드입니다."}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_60px_-50px_rgba(15,23,42,0.35)]">
              <p className="text-sm font-semibold text-slate-700">카드 정보</p>
              <dl className="mt-3 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">타입</dt>
                  <dd className="font-semibold uppercase text-slate-800">{activeItem.kind}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">작성자</dt>
                  <dd className="font-semibold text-slate-800">{activeItem.author ?? "익명"}</dd>
                </div>
                {createdAt ? (
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">작성 시각</dt>
                    <dd className="font-semibold text-slate-800">{createdAt}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {attachments.length ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_60px_-50px_rgba(15,23,42,0.35)]">
                <p className="text-sm font-semibold text-slate-700">첨부</p>
                <div className="mt-3 space-y-3">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-sm font-semibold text-slate-800">{attachment.label}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{attachment.url}</p>
                      {attachment.type === "file" ? (
                        <a
                          href={attachment.url}
                          className={cn(
                            "mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-700",
                            tvMode ? "text-base" : "text-sm",
                          )}
                        >
                          다운로드
                        </a>
                      ) : (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => {
                            if (!window.confirm("외부 링크로 이동할까요?")) {
                              event.preventDefault();
                            }
                          }}
                          className={cn(
                            "mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-indigo-200 bg-white px-4 font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50",
                            tvMode ? "text-base" : "text-sm",
                          )}
                        >
                          링크 열기
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
