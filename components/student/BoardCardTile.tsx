"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/app/_components/uiTokens";
import CardAttachments from "@/app/_components/CardAttachments";
import { classifyAttachment } from "@/lib/cards/attachmentPresentation";
import type { StudentBoardItem } from "@/lib/student/normalizeStudentItems";
import {
  getCardColorToneClasses,
  normalizeCardColorTone,
} from "@/lib/ui/cardColors";

const KIND_LABEL: Record<StudentBoardItem["kind"], string> = {
  note: "메모",
  image: "이미지",
  file: "파일",
  poll: "투표",
  question: "질문",
  help: "도움",
  link: "링크",
  notice: "공지",
};

const KIND_TONE: Record<StudentBoardItem["kind"], string> = {
  note: "student-board-pill",
  image: "student-board-pill",
  file: "student-board-pill",
  poll: "student-board-pill",
  question: "student-board-pill",
  help: "student-board-pill",
  link: "student-board-pill",
  notice: "student-board-pill",
};

const isImageAttachment = (attachment: StudentBoardItem["attachments"][number]) =>
  classifyAttachment({ contentType: attachment.contentType, name: attachment.label }) === "image";

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

type BoardCardTileProps = {
  item: StudentBoardItem;
  onOpen: (item: StudentBoardItem) => void;
  variant?: "gallery" | "columns" | "stream";
  prominent?: boolean;
} & HTMLAttributes<HTMLButtonElement>;

export default function BoardCardTile({
  item,
  onOpen,
  variant = "gallery",
  prominent = false,
  className,
  ...props
}: BoardCardTileProps) {
  const imageAttachment = item.attachments.find(isImageAttachment);
  const renderAttachments = item.attachments
    .filter((attachment) => attachment.type === "file" || attachment.type === "external")
    .map((attachment) => ({
      id: attachment.id,
      type: attachment.type === "file" ? ("file" as const) : ("url" as const),
      label: attachment.label,
      url: attachment.url,
      contentType: attachment.contentType,
    }));
  const showImage = Boolean(imageAttachment);
  const title = item.title ?? "새 카드";
  const body = item.body?.trim() ?? "";
  const dateLabel = formatDate(item.createdAt);
  const ariaLabel = `${title}${item.author ? ` · ${item.author}` : ""}`;
  const isStream = variant === "stream";
  const cardColorTone = normalizeCardColorTone(item.cardColorToken);

  return (
    <button
      type="button"
      role="article"
      aria-label={ariaLabel}
      onClick={() => onOpen(item)}
      onDragStart={(event) => event.preventDefault()}
      draggable={false}
      data-student-card-id={item.id}
      data-card-color-tone={cardColorTone}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border text-left shadow-[var(--surface-shadow)] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)] motion-reduce:transition-none",
        "[transform:translateZ(0)] hover:-translate-y-1 hover:shadow-[0_28px_70px_-40px_rgba(79,70,229,0.35)] active:translate-y-[1px]",
        cardColorTone === "default"
          ? "theme-card-panel"
          : getCardColorToneClasses(cardColorTone),
        prominent ? "min-h-[320px]" : "min-h-[260px]",
        isStream ? "border-l-4 border-l-indigo-300" : "",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2 px-5 pt-5">
        <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold", KIND_TONE[item.kind])}>
          {KIND_LABEL[item.kind]}
        </span>
        {item.pinned ? (
          <span className="student-board-pill rounded-full px-2.5 py-1 text-[11px] font-semibold">
            📌 고정
          </span>
        ) : null}
      </div>

      {showImage ? (
        <div className={cn("mx-5 mt-4 overflow-hidden rounded-2xl bg-slate-100", prominent ? "aspect-[4/3]" : "aspect-[5/3]")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageAttachment?.url}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
      ) : null}

      <div className={cn("flex h-full flex-col gap-3 px-5 pb-5", showImage ? "pt-4" : "pt-5")}
      >
        <div className="space-y-2">
          <h3 className={cn("theme-card-copy font-semibold leading-snug", prominent ? "text-xl" : "text-lg")}
          >
            <span className="line-clamp-2">{title}</span>
          </h3>
          {body ? (
            <p className={cn("theme-card-muted-copy", prominent ? "text-base" : "text-sm")}
            >
              <span className="line-clamp-3">{body}</span>
            </p>
          ) : null}
          <CardAttachments
            attachments={renderAttachments}
            mode="student"
            disabledReason="학생 화면에서는 첨부를 제거할 수 없어요."
            className="max-w-full"
          />
        </div>
        <div className="theme-card-muted-copy mt-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="theme-card-copy font-semibold">{item.author ?? "익명"}</span>
          {dateLabel ? <span>{dateLabel}</span> : null}
        </div>
      </div>
    </button>
  );
}
