"use client";

import Image from "next/image";
import type { SVGProps } from "react";
import LinkifiedText from "@/app/_components/LinkifiedText";
import { cn } from "@/app/_components/uiTokens";
import type { StudentCard } from "@/lib/student/boardModel";
import {
  getCardColorToneClasses,
  normalizeCardColorTone,
} from "@/lib/ui/cardColors";

const ArrowUpRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
  </svg>
);

const PaperClipIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 12.5l6.8-6.8a3.5 3.5 0 015 5l-7.5 7.5a5 5 0 01-7.1-7.1l7.4-7.4"
    />
  </svg>
);

export type CardTileProps = {
  card: StudentCard;
  onOpen: (card: StudentCard) => void;
  variant?: "wall" | "columns" | "gallery" | "stream";
  tvMode: boolean;
};

const TYPE_LABELS: Record<StudentCard["kind"], string> = {
  note: "메모",
  file: "파일",
  question: "질문",
  help: "도움",
  poll: "투표",
  pulse: "이해도",
  link: "링크",
};

const TYPE_BADGE: Record<StudentCard["kind"], string> = {
  note: "student-board-pill",
  file: "student-board-pill",
  question: "student-board-pill",
  help: "student-board-pill",
  poll: "student-board-pill",
  pulse: "student-board-pill",
  link: "student-board-pill",
};

const TYPE_ACCENT: Record<StudentCard["kind"], string> = {
  note: "border-[var(--theme-border)]",
  file: "border-emerald-200",
  question: "border-sky-200",
  help: "border-rose-200",
  poll: "border-amber-200",
  pulse: "border-indigo-200",
  link: "border-[var(--theme-border-strong)]",
};

const isImageCard = (card: StudentCard) => card.meta?.hasImage || Boolean(card.thumbUrl);

const formatDate = (value?: string) => {
  if (!value) return null;
  return new Date(value).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export default function CardTile({ card, onOpen, variant = "wall", tvMode }: CardTileProps) {
  const text = card.text?.trim() ?? "";
  const [firstLine, ...restLines] = text.split("\n");
  const title = card.title ?? firstLine ?? "내용 없음";
  const body = restLines.join(" ").trim() || (firstLine !== text ? text : "");
  const mediaUrl = card.thumbUrl;
  const showImage = mediaUrl && isImageCard(card);
  const isGallery = variant === "gallery";
  const isStream = variant === "stream";
  const hasFile = Boolean(card.meta?.fileUrl);
  const hasLinkOnly = Boolean(card.meta?.linkUrl) && !showImage;
  const hasAttachment = hasFile || hasLinkOnly;
  const cardColorTone = normalizeCardColorTone(card.cardColorToken);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(card)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(card);
        }
      }}
      data-card-color-tone={cardColorTone}
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden rounded-3xl border text-left shadow-[0_24px_90px_-70px_rgba(15,23,42,0.5)] transition hover:-translate-y-[6px] hover:shadow-[0_32px_100px_-70px_rgba(79,70,229,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--theme-bg)]",
        cardColorTone === "default"
          ? "border-[var(--theme-border)] bg-[var(--theme-card)]"
          : getCardColorToneClasses(cardColorTone),
        isStream ? `border-l-4 ${TYPE_ACCENT[card.kind]}` : "border",
        tvMode ? "min-h-[280px]" : "min-h-[240px]",
      )}
    >
      {showImage ? (
        <div
          className={cn(
            "relative w-full overflow-hidden",
            isGallery ? "aspect-[4/3]" : "aspect-[5/3]",
          )}
        >
          <Image
            src={mediaUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            unoptimized
          />
        </div>
      ) : (
        <div
            className={cn(
              "theme-card-muted-copy flex w-full items-center justify-center bg-[var(--theme-card-muted)] px-6 text-center font-semibold",
            isGallery ? "aspect-[4/3]" : "aspect-[5/3]",
            tvMode ? "text-lg" : "text-base",
          )}
        >
          <span className="line-clamp-3">{title.slice(0, 80)}</span>
        </div>
      )}
      <div className={cn("flex h-full flex-col justify-between gap-4", tvMode ? "p-6" : "p-5")}>
        <div className="space-y-3">
          <div
            className={cn(
              "theme-card-muted-copy flex flex-wrap items-center gap-2 text-[13px] font-semibold",
              tvMode ? "text-sm" : "text-xs",
            )}
          >
            <span>{card.authorLabel ?? "학생"}</span>
            <span className="text-[var(--theme-text-subtle)]">·</span>
            <span>{formatDate(card.createdAt) ?? ""}</span>
          </div>
          <div className="space-y-2">
            <h3 className={cn("theme-card-copy line-clamp-2 font-semibold leading-snug", tvMode ? "text-xl" : "text-lg")}>
              {title}
            </h3>
            {body ? (
              <p className={cn("theme-card-muted-copy line-clamp-3 break-words [overflow-wrap:anywhere]", tvMode ? "text-lg" : "text-base")}>
                <LinkifiedText
                  text={body}
                  compact
                  linkClassName="theme-card-link-copy focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-[var(--theme-bg)]"
                />
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                TYPE_BADGE[card.kind],
                tvMode ? "text-sm" : "text-xs",
              )}
            >
              {TYPE_LABELS[card.kind]}
            </span>
            {card.meta?.pinned ? (
              <span className={cn("student-board-pill rounded-full px-3 py-1 text-xs font-semibold", tvMode ? "text-sm" : "text-xs")}>
                고정
              </span>
            ) : null}
            {hasAttachment ? (
              <span className={cn("student-board-pill inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold", tvMode ? "text-sm" : "text-xs")}>
                <PaperClipIcon className="h-4 w-4" aria-hidden />
                첨부 있음
              </span>
            ) : null}
          </div>
          <span className="theme-card-link-copy inline-flex items-center gap-1 text-xs font-semibold">
            미리보기
            <ArrowUpRightIcon className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </div>
    </article>
  );
}
