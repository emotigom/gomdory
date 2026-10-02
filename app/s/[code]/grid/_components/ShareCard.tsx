"use client";

import LinkifiedText from "@/app/_components/LinkifiedText";
import { useMemo } from "react";
import Image from "next/image";

import type { ExternalAttachment } from "@/lib/types/attachments";
import type { CardColorToken } from "@/lib/types/cards";
import { getCardColorClass } from "@/lib/ui/cardColors";
import CardTile from "@/app/_components/CardTile";
import CardAttachments from "@/app/_components/CardAttachments";
import { classifyAttachment } from "@/lib/cards/attachmentPresentation";
import { getPracticeSubmissionFeedbackUrl } from "@/lib/edu/practiceSubmission";

type ShareCardData = {
  id: string;
  text: string;
  authorName?: string | null;
  createdAt: string;
  isPinned?: boolean;
  isFeatured?: boolean;
  cardColorToken?: CardColorToken | null;
  files?: Array<{
    id: string;
    filename: string;
    contentType?: string | null;
    downloadUrl: string;
  }>;
  externalAttachments?: ExternalAttachment[];
};

type ShareCardProps = {
  card: ShareCardData;
  tvMode: boolean;
  onClick?: () => void;
};

export default function ShareCard({ card, tvMode, onClick }: ShareCardProps) {
  const timestamp = useMemo(
    () =>
      new Date(card.createdAt).toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [card.createdAt],
  );

  const attachmentsCount =
    (card.files?.length ?? 0) + (card.externalAttachments?.length ?? 0);
  const displayAttachments = [
    ...(card.files ?? []).map((file) => ({
      id: file.id,
      type: "file" as const,
      label: file.filename,
      url: file.downloadUrl,
      contentType: file.contentType,
    })),
    ...(card.externalAttachments ?? [])
      .filter((item) => Boolean(item.url))
      .map((item, index) => ({
        id: `${card.id}-external-${index}`,
        type: "url" as const,
        label: item.filename ?? item.url ?? "링크",
        url: item.url ?? "",
        contentType: null,
      })),
  ];

  const feedbackUrl = useMemo(() => getPracticeSubmissionFeedbackUrl({ text: card.text, external_attachments: card.externalAttachments }), [card.externalAttachments, card.text]);

  const preview = useMemo(() => {
    const fileImage = card.files?.find((file) => file.contentType?.startsWith("image/"));
    if (fileImage) {
      return { url: fileImage.downloadUrl, label: fileImage.filename };
    }
    const externalImage = card.externalAttachments?.find((item) =>
      classifyAttachment({ contentType: null, name: item.filename ?? item.url ?? "" }) === "image" && Boolean(item.url),
    );
    if (externalImage?.url) {
      return { url: externalImage.url, label: externalImage.filename };
    }
    return null;
  }, [card.externalAttachments, card.files]);

  return (
    <CardTile
      as="button"
      type="button"
      onClick={onClick}
      interactive
      calm
      className={`w-full break-inside-avoid text-left ${
        tvMode ? "p-6" : "p-5"
      } ${getCardColorClass(card.cardColorToken)}`}
    >
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-semibold text-slate-700">
          {card.authorName?.trim() || "익명"}
        </span>
        <span>{timestamp}</span>
      </div>
      <p
        className={`whitespace-pre-wrap text-slate-900 ${
          tvMode ? "text-lg leading-relaxed" : "text-base leading-relaxed"
        }`}
      >
        <LinkifiedText text={card.text} compact linkClassName="text-blue-700 hover:text-blue-800 focus-visible:ring-blue-500 focus-visible:ring-offset-white" />
      </p>
      {preview ? (
        <div
          className={`relative h-40 w-full overflow-hidden rounded-xl border border-slate-200 sm:h-48 ${
            tvMode ? "sm:h-56" : ""
          }`}
        >
          <Image
            src={preview.url}
            alt={preview.label}
            fill
            sizes="(max-width: 640px) 100vw, 600px"
            className="object-cover"
            unoptimized
          />
          {attachmentsCount > 1 ? (
            <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white">
              +{attachmentsCount - 1}
            </span>
          ) : null}
        </div>
      ) : attachmentsCount > 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-500">
          첨부 {attachmentsCount}개
        </div>
      ) : null}
      <CardAttachments
        attachments={displayAttachments}
        mode="share"
        disabledReason="공유 화면에서는 첨부를 제거할 수 없어요."
      />
      {feedbackUrl ? (
        <a
          href={feedbackUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
        >
          피드백 보기
        </a>
      ) : null}

      {card.isPinned || card.isFeatured ? (
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
          {card.isFeatured ? "대표" : null}
          {card.isPinned ? "핀" : null}
        </div>
      ) : null}
    </CardTile>
  );
}
