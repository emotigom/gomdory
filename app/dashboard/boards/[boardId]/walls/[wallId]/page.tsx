import { apiV1Path } from "@/lib/standards/pathTypes";

import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { listCardsForWallPaged } from "@/lib/data/cards";
import { listFilesByCardIds } from "@/lib/data/files";
import { getWall } from "@/lib/data/walls";
import { CARD_COLOR_OPTIONS, getCardColorClass } from "@/lib/ui/cardColors";
import { isCardColorToken } from "@/lib/types/cards";
import { getBoardPolicy } from "@/lib/data/boardPolicies";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import CardMoreMenu from "../../CardMoreMenu";
import CollapsibleCardText from "@/app/_components/CollapsibleCardText";
import { CardForm } from "./CardForm";
import { FileUploader } from "./FileUploader";

export const metadata: Metadata = {
  other: {
    "gom:layout": "dashboard",
    "gom:page": "dashboard_wall",
    "gom:panel:wall_header": "1",
    "gom:panel:card_list": "1",
    "gom:panel:composer": "1",
  },
};

function formatFileSize(size: number): string {
  const kilobyte = 1024;
  const megabyte = kilobyte * 1024;

  if (size >= megabyte) {
    return `${(size / megabyte).toFixed(1)} MB`;
  }

  if (size >= kilobyte) {
    return `${(size / kilobyte).toFixed(1)} KB`;
  }

  return `${size} B`;
}

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("ko-KR");
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length <= 1) {
    return "FILE";
  }
  return parts.pop()?.toUpperCase() ?? "FILE";
}

function isImageType(type?: string | null): boolean {
  return Boolean(type && type.startsWith("image/"));
}

export default async function WallDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string; wallId: string }>;
  searchParams?: Promise<{
    q?: string;
    includeHidden?: string;
    color?: string;
    sort?: string;
    offset?: string;
    card?: string;
  }>;
}) {
  const [{ boardId, wallId }, query] = await Promise.all([params, searchParams]);
  const supabase = createSupabaseServerClient();
  const wall = await getWall(boardId, wallId);

  if (!wall) {
    return notFound();
  }

  const includeHidden = query?.includeHidden === "1";
  const searchQuery = query?.q?.trim() ?? "";
  const sort = query?.sort === "oldest" ? "oldest" : "recent";
  const color = query?.color && isCardColorToken(query.color) ? query.color : undefined;
  const offset = Number.isFinite(Number(query?.offset)) ? Number(query?.offset) : 0;
  const pageLimit = 40;

  const [featuredCardsResult, pinnedCardsResult, normalCardsResult, totalCountResult] =
    await Promise.all([
      listCardsForWallPaged({
        wallId: wall.id,
        includeHidden,
        query: searchQuery,
        color,
        section: "featured",
        limit: 50,
      }),
      listCardsForWallPaged({
        wallId: wall.id,
        includeHidden,
        query: searchQuery,
        color,
        section: "pinned",
        limit: 50,
      }),
      listCardsForWallPaged({
        wallId: wall.id,
        includeHidden,
        query: searchQuery,
        color,
        sort,
        section: "normal",
        limit: pageLimit,
        offset,
      }),
      listCardsForWallPaged({
        wallId: wall.id,
        includeHidden,
        query: searchQuery,
        color,
        includeTotalCount: true,
        limit: 1,
      }),
    ]);

  const featuredCards = featuredCardsResult.items;
  const pinnedCards = pinnedCardsResult.items;
  const normalCards = normalCardsResult.items;
  const totalCount = totalCountResult.totalCount ?? 0;
  const allCards = [...featuredCards, ...pinnedCards, ...normalCards];
  const filesByCard = await listFilesByCardIds(allCards.map((card) => card.id));

  const [{ data: boardRoleData }, policy] = await Promise.all([
    supabase.rpc("board_role", { bid: boardId }),
    getBoardPolicy(boardId, supabase),
  ]);

  const boardRole = normalizeBoardRole(boardRoleData);
  const canSoftDelete = boardRole === "owner" || (boardRole === "editor" && policy.editorsCanSoftDelete);
  const deleteDisabledReason = canSoftDelete ? undefined : "보드 정책으로 삭제가 제한되어 있습니다.";

  const buildParams = (nextOffset?: number | null) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (includeHidden) params.set("includeHidden", "1");
    if (color) params.set("color", color);
    if (sort !== "recent") params.set("sort", sort);
    if (nextOffset) params.set("offset", String(nextOffset));
    return params.toString();
  };

  const prevOffset = offset > 0 ? Math.max(0, offset - pageLimit) : null;
  const nextOffset = normalCardsResult.nextOffset;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900">{wall.title}</h1>
            {wall.description ? (
              <p className="text-gray-700">{wall.description}</p>
            ) : null}
          </div>
          <span className="text-sm text-gray-600">
            {new Date(wall.created_at).toLocaleDateString("ko-KR")}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">카드 작성</h2>
          <CardForm boardId={boardId} wallId={wall.id} />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">카드 목록</h2>
            <span className="text-sm text-gray-600">총 {totalCount}개</span>
          </div>
          <form method="get" className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-1 items-center gap-2">
                <span className="whitespace-nowrap text-gray-700">검색</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="본문 또는 작성자 검색"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="includeHidden"
                  value="1"
                  defaultChecked={includeHidden}
                  className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                />
                숨김 포함
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                정렬
                <select
                  name="sort"
                  defaultValue={sort}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
                >
                  <option value="recent">최신순</option>
                  <option value="oldest">오래된순</option>
                </select>
              </label>
              <button
                type="submit"
                className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                필터 적용
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-700">색상</span>
              <label className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                <input
                  type="radio"
                  name="color"
                  value=""
                  defaultChecked={!color}
                  className="h-3 w-3 text-black focus:ring-black"
                />
                전체
              </label>
              {CARD_COLOR_OPTIONS.map((option) => (
                <label
                  key={option.token}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${option.className}`}
                >
                  <input
                    type="radio"
                    name="color"
                    value={option.token}
                    defaultChecked={color === option.token}
                    className="h-3 w-3 text-black focus:ring-black"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </form>
          {allCards.length === 0 ? (
            <p className="text-sm text-gray-600">아직 등록된 카드가 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {featuredCards.length > 0 ? (
                <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-purple-800">대표 카드</h3>
                    <span className="text-xs text-purple-700">{featuredCards.length}개</span>
                  </div>
                  <ul className="grid gap-4 md:grid-cols-2">
                    {featuredCards.map((card) => (
                      <li
                        key={card.id}
                        className={`flex h-full flex-col justify-between rounded-lg border border-gray-200 p-4 shadow-sm ${getCardColorClass(
                          card.card_color_token,
                        )}`}
                      >
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <CollapsibleCardText text={card.text} collapsedLines={5} className="whitespace-pre-wrap text-sm text-gray-900" />
                              <CardMoreMenu
                                boardId={boardId}
                                wallId={wall.id}
                                card={card}
                                disableDelete={!canSoftDelete}
                                deleteDisabledReason={deleteDisabledReason}
                              />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{new Date(card.created_at).toLocaleString("ko-KR")}</span>
                              {card.is_hidden ? (
                                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                                  숨김
                                </span>
                              ) : null}
                              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                                대표
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2 rounded-md bg-gray-50 p-3">
                            <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
                              <span>첨부파일</span>
                              <FileUploader
                                cardId={card.id}
                                inputId={`wall-card-${card.id}-file-input`}
                              />
                            </div>
                            <div className="space-y-3">
                              {filesByCard[card.id]?.length ? (
                                <div className="space-y-2">
                                  {card.external_attachments.length > 0 ? (
                                    <p className="text-xs font-semibold text-gray-600">첨부파일</p>
                                  ) : null}
                                  <ul className="space-y-2 text-sm text-gray-800">
                                    {filesByCard[card.id]?.map((file) => (
                                      <li
                                        key={file.id}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2"
                                      >
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                          {isImageType(file.content_type) ? (
                                            <Image
                                              src={apiV1Path(`files/${file.id}/download`)}
                                              alt={file.filename}
                                              width={40}
                                              height={40}
                                              unoptimized
                                              className="h-10 w-10 rounded-md border border-gray-200 object-cover"
                                            />
                                          ) : (
                                            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
                                              {getFileExtension(file.filename)}
                                            </span>
                                          )}
                                          <div className="min-w-0 space-y-0.5">
                                            <p className="truncate text-sm font-medium text-gray-900">
                                              {file.filename}
                                            </p>
                                            <p className="text-xs text-gray-600">
                                              {formatFileSize(file.size_bytes)}
                                              {file.content_type ? ` · ${file.content_type}` : ""}
                                              {file.created_at ? ` · ${formatTimestamp(file.created_at)}` : ""}
                                            </p>
                                          </div>
                                        </div>
                                        <a
                                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                                          href={apiV1Path(`files/${file.id}/download`)}
                                          aria-label={`${file.filename} 다운로드`}
                                        >
                                          다운로드
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {card.external_attachments.length > 0 ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-gray-600">외부 링크</p>
                                  <ul className="space-y-2 text-sm text-gray-800">
                                    {card.external_attachments.map((file, index) => (
                                      <li
                                        key={`${card.id}-featured-external-${index}`}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2"
                                      >
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
                                            {getFileExtension(file.filename)}
                                          </span>
                                          <div className="min-w-0 space-y-0.5">
                                            <p className="truncate text-sm font-medium text-gray-900">
                                              {file.filename}
                                            </p>
                                            {file.byteSize ? (
                                              <p className="text-xs text-gray-600">
                                                {formatFileSize(file.byteSize)}
                                              </p>
                                            ) : null}
                                          </div>
                                        </div>
                                        {file.downloadPath ? (
                                          <a
                                            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                                            href={file.downloadPath}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={`${file.filename} 열기`}
                                          >
                                            열기
                                          </a>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {!filesByCard[card.id]?.length &&
                              card.external_attachments.length === 0 ? (
                                <div className="rounded-md border border-dashed border-gray-200 bg-white px-4 py-4 text-center">
                                  <p className="text-sm font-semibold text-gray-800">
                                    아직 첨부가 없어요.
                                  </p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    파일을 업로드해 학생들과 공유해 보세요.
                                  </p>
                                  <div className="mt-3 flex justify-center">
                                    <label
                                      htmlFor={`wall-card-${card.id}-file-input`}
                                      className="inline-flex h-8 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                                    >
                                      파일 추가
                                    </label>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {pinnedCards.length > 0 ? (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-amber-800">고정 카드</h3>
                    <span className="text-xs text-amber-700">{pinnedCards.length}개</span>
                  </div>
                  <ul className="grid gap-4 md:grid-cols-2">
                    {pinnedCards.map((card) => (
                      <li
                        key={card.id}
                        className={`flex h-full flex-col justify-between rounded-lg border border-gray-200 p-4 shadow-sm ${getCardColorClass(
                          card.card_color_token,
                        )}`}
                      >
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <CollapsibleCardText text={card.text} collapsedLines={5} className="whitespace-pre-wrap text-sm text-gray-900" />
                              <CardMoreMenu
                                boardId={boardId}
                                wallId={wall.id}
                                card={card}
                                disableDelete={!canSoftDelete}
                                deleteDisabledReason={deleteDisabledReason}
                              />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{new Date(card.created_at).toLocaleString("ko-KR")}</span>
                              {card.is_hidden ? (
                                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                                  숨김
                                </span>
                              ) : null}
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                고정
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2 rounded-md bg-gray-50 p-3">
                            <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
                              <span>첨부파일</span>
                              <FileUploader
                                cardId={card.id}
                                inputId={`wall-card-${card.id}-file-input`}
                              />
                            </div>
                            <div className="space-y-3">
                              {filesByCard[card.id]?.length ? (
                                <div className="space-y-2">
                                  {card.external_attachments.length > 0 ? (
                                    <p className="text-xs font-semibold text-gray-600">첨부파일</p>
                                  ) : null}
                                  <ul className="space-y-2 text-sm text-gray-800">
                                    {filesByCard[card.id]?.map((file) => (
                                      <li
                                        key={file.id}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2"
                                      >
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                          {isImageType(file.content_type) ? (
                                            <Image
                                              src={apiV1Path(`files/${file.id}/download`)}
                                              alt={file.filename}
                                              width={40}
                                              height={40}
                                              unoptimized
                                              className="h-10 w-10 rounded-md border border-gray-200 object-cover"
                                            />
                                          ) : (
                                            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
                                              {getFileExtension(file.filename)}
                                            </span>
                                          )}
                                          <div className="min-w-0 space-y-0.5">
                                            <p className="truncate text-sm font-medium text-gray-900">
                                              {file.filename}
                                            </p>
                                            <p className="text-xs text-gray-600">
                                              {formatFileSize(file.size_bytes)}
                                              {file.content_type ? ` · ${file.content_type}` : ""}
                                              {file.created_at ? ` · ${formatTimestamp(file.created_at)}` : ""}
                                            </p>
                                          </div>
                                        </div>
                                        <a
                                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                                          href={apiV1Path(`files/${file.id}/download`)}
                                          aria-label={`${file.filename} 다운로드`}
                                        >
                                          다운로드
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {card.external_attachments.length > 0 ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-gray-600">외부 링크</p>
                                  <ul className="space-y-2 text-sm text-gray-800">
                                    {card.external_attachments.map((file, index) => (
                                      <li
                                        key={`${card.id}-pinned-external-${index}`}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2"
                                      >
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
                                            {getFileExtension(file.filename)}
                                          </span>
                                          <div className="min-w-0 space-y-0.5">
                                            <p className="truncate text-sm font-medium text-gray-900">
                                              {file.filename}
                                            </p>
                                            {file.byteSize ? (
                                              <p className="text-xs text-gray-600">
                                                {formatFileSize(file.byteSize)}
                                              </p>
                                            ) : null}
                                          </div>
                                        </div>
                                        {file.downloadPath ? (
                                          <a
                                            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                                            href={file.downloadPath}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={`${file.filename} 열기`}
                                          >
                                            열기
                                          </a>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {!filesByCard[card.id]?.length &&
                              card.external_attachments.length === 0 ? (
                                <div className="rounded-md border border-dashed border-gray-200 bg-white px-4 py-4 text-center">
                                  <p className="text-sm font-semibold text-gray-800">
                                    아직 첨부가 없어요.
                                  </p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    파일을 업로드해 학생들과 공유해 보세요.
                                  </p>
                                  <div className="mt-3 flex justify-center">
                                    <label
                                      htmlFor={`wall-card-${card.id}-file-input`}
                                      className="inline-flex h-8 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                                    >
                                      파일 추가
                                    </label>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {normalCards.length > 0 ? (
                <ul className="grid gap-4 md:grid-cols-2">
                  {normalCards.map((card) => (
                    <li
                      key={card.id}
                      className={`flex h-full flex-col justify-between rounded-lg border border-gray-200 p-4 shadow-sm ${getCardColorClass(
                        card.card_color_token,
                      )}`}
                    >
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <CollapsibleCardText text={card.text} collapsedLines={5} className="whitespace-pre-wrap text-sm text-gray-900" />
                            <CardMoreMenu
                              boardId={boardId}
                              wallId={wall.id}
                              card={card}
                              disableDelete={!canSoftDelete}
                              deleteDisabledReason={deleteDisabledReason}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{new Date(card.created_at).toLocaleString("ko-KR")}</span>
                            {card.is_hidden ? (
                              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                                숨김
                              </span>
                            ) : null}
                            {card.is_featured ? (
                              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                                대표
                              </span>
                            ) : null}
                            {card.is_pinned ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                고정
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="space-y-2 rounded-md bg-gray-50 p-3">
                          <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
                            <span>첨부파일</span>
                            <FileUploader
                              cardId={card.id}
                              inputId={`wall-card-${card.id}-file-input`}
                            />
                          </div>
                          <div className="space-y-3">
                            {filesByCard[card.id]?.length ? (
                              <div className="space-y-2">
                                {card.external_attachments.length > 0 ? (
                                  <p className="text-xs font-semibold text-gray-600">첨부파일</p>
                                ) : null}
                                <ul className="space-y-2 text-sm text-gray-800">
                                  {filesByCard[card.id]?.map((file) => (
                                    <li
                                      key={file.id}
                                      className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2"
                                    >
                                      <div className="flex min-w-0 flex-1 items-center gap-3">
                                        {isImageType(file.content_type) ? (
                                          <Image
                                            src={apiV1Path(`files/${file.id}/download`)}
                                            alt={file.filename}
                                            width={40}
                                            height={40}
                                            unoptimized
                                            className="h-10 w-10 rounded-md border border-gray-200 object-cover"
                                          />
                                        ) : (
                                          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
                                            {getFileExtension(file.filename)}
                                          </span>
                                        )}
                                        <div className="min-w-0 space-y-0.5">
                                          <p className="truncate text-sm font-medium text-gray-900">
                                            {file.filename}
                                          </p>
                                          <p className="text-xs text-gray-600">
                                            {formatFileSize(file.size_bytes)}
                                            {file.content_type ? ` · ${file.content_type}` : ""}
                                            {file.created_at ? ` · ${formatTimestamp(file.created_at)}` : ""}
                                          </p>
                                        </div>
                                      </div>
                                      <a
                                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                                        href={apiV1Path(`files/${file.id}/download`)}
                                        aria-label={`${file.filename} 다운로드`}
                                      >
                                        다운로드
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {card.external_attachments.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-gray-600">외부 링크</p>
                                <ul className="space-y-2 text-sm text-gray-800">
                                  {card.external_attachments.map((file, index) => (
                                    <li
                                      key={`${card.id}-external-${index}`}
                                      className="flex flex-wrap items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2"
                                    >
                                      <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
                                          {getFileExtension(file.filename)}
                                        </span>
                                        <div className="min-w-0 space-y-0.5">
                                          <p className="truncate text-sm font-medium text-gray-900">
                                            {file.filename}
                                          </p>
                                          {file.byteSize ? (
                                            <p className="text-xs text-gray-600">
                                              {formatFileSize(file.byteSize)}
                                            </p>
                                          ) : null}
                                        </div>
                                      </div>
                                      {file.downloadPath ? (
                                        <a
                                          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                                          href={file.downloadPath}
                                          target="_blank"
                                          rel="noreferrer"
                                          aria-label={`${file.filename} 열기`}
                                        >
                                          열기
                                        </a>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                            {!filesByCard[card.id]?.length &&
                            card.external_attachments.length === 0 ? (
                              <div className="rounded-md border border-dashed border-gray-200 bg-white px-4 py-4 text-center">
                                <p className="text-sm font-semibold text-gray-800">
                                  아직 첨부가 없어요.
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                  파일을 업로드해 학생들과 공유해 보세요.
                                </p>
                                <div className="mt-3 flex justify-center">
                                  <label
                                    htmlFor={`wall-card-${card.id}-file-input`}
                                    className="inline-flex h-8 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                                  >
                                    파일 추가
                                  </label>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {prevOffset !== null ? (
                  <a
                    href={`?${buildParams(prevOffset)}`}
                    className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:border-gray-300"
                  >
                    이전
                  </a>
                ) : null}
                {nextOffset !== null ? (
                  <a
                    href={`?${buildParams(nextOffset)}`}
                    className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:border-gray-300"
                  >
                    다음
                  </a>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
