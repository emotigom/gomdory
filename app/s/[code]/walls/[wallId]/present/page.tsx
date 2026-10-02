import LinkifiedText from "@/app/_components/LinkifiedText";
import { apiV1Path } from "@/lib/standards/pathTypes";

import Link from "next/link";
import { headers } from "next/headers";

import { listCardsForSharePaged } from "@/lib/data/share";
import { listReadyFilesForCards } from "@/lib/data/files";
import {
  getHost,
  redirectToHostIfNeeded,
  STUDENT_HOST,
  TEACHER_HOST,
} from "@/lib/http/hosts";
import type { ExternalAttachment } from "@/lib/types/attachments";
import { resolvePublicShareWall } from "@/lib/share/public/access";
import { getCardColorClass } from "@/lib/ui/cardColors";
import { CardDetailOverlayWithQuery } from "@/app/_components/CardDetailOverlay";

import ProjectorControls from "./ProjectorControls";
import WallRealtimeRefresh from "./WallRealtimeRefresh";
import ClassBanner from "../../../components/ClassBanner";
import ClassEndedOverlay from "../../../components/ClassEndedOverlay";
import RulesOverlay from "../../../components/RulesOverlay";

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function ExternalAttachmentList({
  attachments,
  className,
  noteClassName,
}: {
  attachments: ExternalAttachment[];
  className: string;
  noteClassName: string;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-1">
      <p className={`${className} text-xs font-semibold`}>외부 링크</p>
      <ul className={`space-y-1 text-xs ${className}`}>
        {attachments.map((file, index) => (
          <li key={`${file.filename}-${index}`} className="flex items-center gap-2">
            {file.downloadPath ? (
              <a href={file.downloadPath} className="underline underline-offset-2">
                {file.filename}
              </a>
            ) : (
              <span>{file.filename}</span>
            )}
            {file.byteSize ? <span className={noteClassName}>{formatFileSize(file.byteSize)}</span> : null}
          </li>
        ))}
      </ul>
      <p className={`text-[11px] ${noteClassName}`}>외부 링크</p>
    </div>
  );
}

export default async function SharedWallProjectorPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string; wallId: string }>;
  searchParams?: Promise<{ card?: string; offset?: string }>;
}) {
  const requestHeaders = await headers();
  const host = await getHost();

  await redirectToHostIfNeeded({
    desiredHost: STUDENT_HOST,
    requestUrl: new URL(
      requestHeaders.get("x-url") ?? "/s",
      `https://${host || TEACHER_HOST}`,
    ),
  });

  const [{ code, wallId }, query] = await Promise.all([params, searchParams]);
  const { normalizedCode, board, wall } = await resolvePublicShareWall({ code, wallId });

  if (!board) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">공유를 찾을 수 없습니다</h1>
        <p className="text-gray-600">올바른 6자리 코드를 확인해주세요.</p>
      </div>
    );
  }

  if (!wall) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">담벼락을 찾을 수 없습니다</h1>
        <p className="text-gray-600">다시 시도해주세요.</p>
      </div>
    );
  }

  const offset = Number.isFinite(Number(query?.offset)) ? Number(query?.offset) : 0;
  const pageLimit = 50;
  const [featuredCardsResult, pinnedCardsResult, normalCardsResult] = await Promise.all([
    listCardsForSharePaged(wall.id, { section: "featured", limit: 50 }),
    listCardsForSharePaged(wall.id, { section: "pinned", limit: 50 }),
    listCardsForSharePaged(wall.id, {
      section: "normal",
      limit: pageLimit,
      offset,
      sort: "recent",
    }),
  ]);
  const featuredCards = featuredCardsResult.items;
  const pinnedCards = pinnedCardsResult.items;
  const normalCards = normalCardsResult.items;
  const cardsForFiles = [...featuredCards, ...pinnedCards, ...normalCards];
  const files = await listReadyFilesForCards(cardsForFiles.map((card) => card.id));
  const filesByCardId = files.reduce<Record<string, typeof files>>((acc, file) => {
    acc[file.cardId] = acc[file.cardId] ?? [];
    acc[file.cardId]?.push(file);
    return acc;
  }, {});
  const orderedCards = [...featuredCards, ...pinnedCards, ...normalCards];

  const cardContainerId = "projector-card-container";

  const buildCardHref = (cardId: string) => {
    const params = new URLSearchParams();
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    params.set("card", cardId);
    return `?${params.toString()}`;
  };

  const cardsIndex = orderedCards.map((card) => ({
    id: card.id,
    text: card.text,
    authorName: card.author_name,
    authorType: card.author_type,
    createdAt: card.created_at,
    isPinned: card.is_pinned,
    isFeatured: card.is_featured,
    cardColorToken: card.card_color_token,
    files: (filesByCardId[card.id] ?? []).map((file) => ({
      id: file.fileId,
      filename: file.filename,
      contentType: file.contentType,
      sizeBytes: file.byteSize,
      downloadUrl: apiV1Path(`share/${normalizedCode}/files/${file.fileId}/download`),
    })),
    externalAttachments: card.external_attachments,
  }));

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
      <WallRealtimeRefresh wallId={wallId} />
      {board.class_state === "ended" ? (
        <ClassEndedOverlay notice={board.class_notice} />
      ) : null}
      <RulesOverlay rulesText={board.rules_text} notice={board.class_notice} />
      <ClassBanner
        state={board.class_state}
        notice={board.class_notice}
        variant="projector"
      />
      <div className="space-y-1 text-center">
        <p className="text-sm font-medium text-gray-700">프로젝터 모드</p>
        <h1 className="text-3xl font-bold text-gray-900">{wall.title}</h1>
        {wall.description ? (
          <p className="text-gray-700">{wall.description}</p>
        ) : null}
        <a
          href={`/s/${normalizedCode}/walls/${wallId}/present/slides`}
          className="inline-flex items-center justify-center text-sm font-semibold text-indigo-600 underline underline-offset-4"
        >
          발표(슬라이드) 보기
        </a>
      </div>

      <ProjectorControls
        cardIds={normalCards.map((card) => card.id)}
        cardContainerId={cardContainerId}
      />

      <div className="space-y-4">
        {featuredCards.length > 0 ? (
          <div className="space-y-3 rounded-2xl border border-purple-200 bg-purple-50/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-purple-700">
                🌟 오늘의 질문(대표)
              </h2>
              <span className="text-base text-purple-600">
                {featuredCards.length}개
              </span>
            </div>
            <ul className="space-y-4">
              {featuredCards.map((card) => (
                <li
                  key={card.id}
                  className={`relative rounded-2xl border border-purple-200 p-6 shadow-sm ${getCardColorClass(
                    card.card_color_token,
                  )}`}
                >
                  <Link
                    href={buildCardHref(card.id)}
                    aria-label="카드 상세 보기"
                    className="absolute inset-0 z-0 rounded-2xl"
                  />
                  <div className="relative z-10">
                    <p className="text-2xl text-gray-900 whitespace-pre-wrap">
                      {card.author_name ? (
                        <span className="mr-2 font-semibold text-gray-800">
                          {card.author_name}:
                        </span>
                      ) : null}
                      <LinkifiedText text={card.text} compact linkClassName="text-blue-700 hover:text-blue-800 focus-visible:ring-blue-500 focus-visible:ring-offset-white" />
                    </p>
                    <p className="mt-3 text-base text-gray-500">
                      {new Date(card.created_at).toLocaleString("ko-KR")}
                    </p>
                    {filesByCardId[card.id]?.length ? (
                      <div className="mt-3 space-y-1">
                        {card.external_attachments.length > 0 ? (
                          <p className="text-xs font-semibold text-purple-700">첨부파일</p>
                        ) : null}
                        <ul className="space-y-1 text-xs text-purple-700">
                          {filesByCardId[card.id]?.map((file) => (
                            <li key={file.fileId} className="flex items-center gap-2">
                              <a
                                href={apiV1Path(`share/${normalizedCode}/files/${file.fileId}/download`)}
                                className="underline underline-offset-2"
                              >
                                {file.filename}
                              </a>
                              <span className="text-purple-500">
                                {formatFileSize(file.byteSize)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <ExternalAttachmentList
                      attachments={card.external_attachments}
                      className="text-purple-700"
                      noteClassName="text-purple-500"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {pinnedCards.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-amber-700">📌 고정</h2>
              <span className="text-sm text-amber-600">
                {pinnedCards.length}개
              </span>
            </div>
            <ul className="space-y-3">
              {pinnedCards.map((card) => (
                <li
                  key={card.id}
                  className={`relative rounded-lg border border-amber-200 p-4 shadow-sm ${getCardColorClass(
                    card.card_color_token,
                  )}`}
                >
                  <Link
                    href={buildCardHref(card.id)}
                    aria-label="카드 상세 보기"
                    className="absolute inset-0 z-0 rounded-lg"
                  />
                  <div className="relative z-10">
                    <p className="text-lg text-gray-900 whitespace-pre-wrap">
                      {card.author_name ? (
                        <span className="mr-1 font-semibold text-gray-800">
                          {card.author_name}:
                        </span>
                      ) : null}
                      <LinkifiedText text={card.text} compact linkClassName="text-blue-700 hover:text-blue-800 focus-visible:ring-blue-500 focus-visible:ring-offset-white" />
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      {new Date(card.created_at).toLocaleString("ko-KR")}
                    </p>
                    {filesByCardId[card.id]?.length ? (
                      <div className="mt-2 space-y-1">
                        {card.external_attachments.length > 0 ? (
                          <p className="text-xs font-semibold text-amber-700">첨부파일</p>
                        ) : null}
                        <ul className="space-y-1 text-xs text-amber-700">
                          {filesByCardId[card.id]?.map((file) => (
                            <li key={file.fileId} className="flex items-center gap-2">
                              <a
                                href={apiV1Path(`share/${normalizedCode}/files/${file.fileId}/download`)}
                                className="underline underline-offset-2"
                              >
                                {file.filename}
                              </a>
                              <span className="text-amber-500">
                                {formatFileSize(file.byteSize)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <ExternalAttachmentList
                      attachments={card.external_attachments}
                      className="text-amber-700"
                      noteClassName="text-amber-500"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div
          id={cardContainerId}
          className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          {normalCards.length === 0 ? (
            <p className="text-sm text-gray-600">아직 작성된 카드가 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {normalCards.map((card) => (
                <li
                  key={card.id}
                  data-card-id={card.id}
                  className={`relative rounded-lg border border-gray-200 p-4 shadow-sm transition-colors ${getCardColorClass(
                    card.card_color_token,
                  )}`}
                >
                  <Link
                    href={buildCardHref(card.id)}
                    aria-label="카드 상세 보기"
                    className="absolute inset-0 z-0 rounded-lg"
                  />
                  <div className="relative z-10">
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {card.author_name ? (
                        <span className="mr-1 font-semibold text-gray-800">
                          {card.author_name}:
                        </span>
                      ) : null}
                      <LinkifiedText text={card.text} compact linkClassName="text-blue-700 hover:text-blue-800 focus-visible:ring-blue-500 focus-visible:ring-offset-white" />
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      {new Date(card.created_at).toLocaleString("ko-KR")}
                    </p>
                    {filesByCardId[card.id]?.length ? (
                      <div className="mt-2 space-y-1">
                        {card.external_attachments.length > 0 ? (
                          <p className="text-xs font-semibold text-gray-600">첨부파일</p>
                        ) : null}
                        <ul className="space-y-1 text-xs text-gray-600">
                          {filesByCardId[card.id]?.map((file) => (
                            <li key={file.fileId} className="flex items-center gap-2">
                              <a
                                href={apiV1Path(`share/${normalizedCode}/files/${file.fileId}/download`)}
                                className="underline underline-offset-2"
                              >
                                {file.filename}
                              </a>
                              <span className="text-gray-400">
                                {formatFileSize(file.byteSize)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <ExternalAttachmentList
                      attachments={card.external_attachments}
                      className="text-gray-600"
                      noteClassName="text-gray-400"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
            {offset > 0 ? (
              <Link
                href={`?offset=${Math.max(0, offset - pageLimit)}`}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:border-gray-300"
              >
                이전
              </Link>
            ) : null}
            {normalCardsResult.nextOffset !== null ? (
              <Link
                href={`?offset=${normalCardsResult.nextOffset}`}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:border-gray-300"
              >
                더 보기
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      </div>
      <CardDetailOverlayWithQuery cardsIndex={cardsIndex} initialCardId={query?.card} readOnly />
    </>
  );
}
