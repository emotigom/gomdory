"use client";

import Link from "next/link";

import CardTile from "@/app/_components/CardTile";
import { getCardPreviewLines, getCardPreviewTone, type FeedCard } from "../useFeedData";
import type { FeedCardSize } from "../useFeedCardSize";

type FeedCardPreviewProps = {
  card: FeedCard;
  shareCode: string;
  wallId: string;
  cardSize: FeedCardSize;
  safeMode?: boolean;
};

export function FeedCardPreview({ card, shareCode, wallId, cardSize, safeMode = false }: FeedCardPreviewProps) {
  const target = `/s/${shareCode}/walls/${wallId}?card=${card.id}`;
  const isLarge = cardSize === "large";
  const previewText = getCardPreviewLines(card.text, isLarge ? 5 : 4);
  const hasMedia = (card.files?.length ?? 0) > 0 || (card.externalAttachments?.length ?? 0) > 0;
  const attachmentLabel =
    card.files?.[0]?.filename ?? card.externalAttachments?.[0]?.filename ?? "첨부 파일";

  return (
    <CardTile
      as="div"
      interactive
      variant="default"
      subdued
      calm={safeMode}
      className={`relative h-full text-left ${getCardPreviewTone(card)} ${isLarge ? "gap-4" : "gap-3"} ${safeMode ? "border-gray-300 shadow-none" : ""}`}
    >
      <Link
        href={target}
        aria-label="카드 상세 보기"
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      />
      <div className={`relative z-10 flex h-full flex-col ${isLarge ? "gap-4" : "gap-3"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className={`${isLarge ? "text-base" : "text-sm"} font-semibold text-gray-900`}>
              {card.authorName ?? "익명"}
            </p>
            <p className={`${isLarge ? "text-[12px]" : "text-[11px]"} text-gray-500`}>
              {new Date(card.createdAt).toLocaleString("ko-KR")}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border bg-white px-3 py-1 text-[11px] font-semibold ${safeMode ? "border-gray-400 text-gray-800" : "border-gray-200 text-gray-700"}`}
          >
            {card.isFeatured ? "대표" : card.isPinned ? "핀" : "카드"}
          </span>
        </div>
        <p
          className={`whitespace-pre-wrap font-medium text-gray-900 ${isLarge ? "text-[17px] leading-7 line-clamp-5" : "text-[15px] leading-6 line-clamp-4"}`}
        >
          {previewText}
        </p>
        {hasMedia ? (
          <div
            className={`mt-auto overflow-hidden rounded-xl border border-dashed ${safeMode ? "border-gray-300 bg-gray-100" : "border-gray-200 bg-gray-50"} ${isLarge ? "px-4 py-3" : "px-3 py-2.5"}`}
          >
            <div className="flex items-center gap-3 text-xs font-semibold text-gray-700">
              <span
                className={`inline-flex items-center justify-center rounded-xl bg-gray-900 text-white shadow-sm ${isLarge ? "h-12 w-12 text-base" : "h-10 w-10 text-sm"}`}
                aria-hidden
              >
                📎
              </span>
              <div className="flex flex-col text-left">
                <span className={`${isLarge ? "text-[13px]" : "text-[12px]"} font-semibold text-gray-800`}>
                  첨부 파일 / 링크
                </span>
                <span className={`${isLarge ? "text-[12px]" : "text-[11px]"} text-gray-500`}>
                  {attachmentLabel}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div
        className={`relative z-10 flex items-center justify-between rounded-xl border border-dashed border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 ${isLarge ? "text-[12px]" : "text-[11px]"}`}
      >
        <span className="truncate text-[11px] text-gray-600">
          {card.authorType === "teacher" ? "교사 카드" : "학생 카드"}
        </span>
        <span className="text-[11px] text-gray-700">자세히 보기 →</span>
      </div>
    </CardTile>
  );
}
