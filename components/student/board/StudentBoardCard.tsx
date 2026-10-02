"use client";

import { cn } from "@/app/_components/uiTokens";
import CardAttachments from "@/app/_components/CardAttachments";
import { classifyAttachment } from "@/lib/cards/attachmentPresentation";
import type { StudentBoardItem, StudentBoardItemKind } from "@/lib/student/normalizeStudentItems";
import {
  getCardColorToneClasses,
  normalizeCardColorTone,
} from "@/lib/ui/cardColors";
import type { HTMLAttributes } from "react";

const KIND_LABEL: Record<StudentBoardItemKind, string> = {
  note: "메모",
  image: "이미지",
  file: "파일",
  poll: "투표",
  question: "질문",
  help: "도움",
  link: "링크",
  notice: "공지",
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

type StudentBoardCardProps = {
  item: StudentBoardItem;
  variant: "wall" | "columns" | "gallery" | "stream";
  tvMode: boolean;
  tone?: "default" | "showcase";
  onOpen: (item: StudentBoardItem) => void;
} & HTMLAttributes<HTMLButtonElement>;

export default function StudentBoardCard({
  item,
  variant,
  tvMode,
  tone = "default",
  onOpen,
  className,
  ...props
}: StudentBoardCardProps) {
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
  const dateLabel = formatDate(item.createdAt);
  const showImage = variant === "gallery" || (variant === "wall" && imageAttachment);
  const isShowcase = tone === "showcase";
  const cardColorTone = normalizeCardColorTone(item.cardColorToken);
  const bodyText = item.body?.trim() || "내용이 없습니다.";
  const trimmedBody =
    !isShowcase && bodyText.length > 220 ? `${bodyText.slice(0, 220)}…` : bodyText;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      data-student-card-id={item.id}
      data-card-color-tone={cardColorTone}
      className={cn(
        "group flex h-full w-full flex-col border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        cardColorTone === "default"
          ? "border-white/80 bg-white/95"
          : getCardColorToneClasses(cardColorTone),
        isShowcase
          ? "rounded-[32px] shadow-[0_24px_120px_-80px_rgba(15,23,42,0.35)] hover:-translate-y-1 hover:shadow-[0_36px_140px_-90px_rgba(15,23,42,0.45)]"
          : "rounded-[28px] shadow-[0_20px_80px_-55px_rgba(15,23,42,0.35)] hover:-translate-y-1 hover:shadow-[0_32px_120px_-70px_rgba(15,23,42,0.45)]",
        tvMode ? "p-6" : "p-5",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-700">
            {KIND_LABEL[item.kind]}
          </span>
          <h3
            className={cn(
              "text-slate-900",
              tvMode ? "text-2xl" : "text-lg",
              isShowcase && "line-clamp-2 leading-snug",
            )}
          >
            {item.title ?? "새로운 카드"}
          </h3>
        </div>
        {item.pinned ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            📌 고정
          </span>
        ) : null}
      </div>

      {showImage ? (
        imageAttachment ? (
          <div className={cn("mt-4 overflow-hidden rounded-2xl bg-slate-100", tvMode ? "min-h-[200px]" : "min-h-[160px]")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageAttachment.url}
              alt={item.title ?? "카드 이미지"}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className={cn("mt-4 flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400", tvMode ? "min-h-[200px]" : "min-h-[160px]")}>이미지 없음</div>
        )
      ) : null}

      <p
        className={cn(
          "mt-4 text-slate-700",
          tvMode ? "text-lg" : "text-base",
          isShowcase && "line-clamp-4 leading-relaxed",
        )}
      >
        {trimmedBody}
      </p>

      <CardAttachments
        attachments={renderAttachments}
        mode="student"
        disabledReason="학생 화면에서는 첨부를 제거할 수 없어요."
        className="mt-3"
      />
      <div className={cn("mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-slate-500", tvMode ? "text-base" : "text-sm")}>
        <span className="font-semibold text-slate-700">{item.author ?? "익명"}</span>
        {dateLabel ? <span>{dateLabel}</span> : null}
      </div>
    </button>
  );
}
