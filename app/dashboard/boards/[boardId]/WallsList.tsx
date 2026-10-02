"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import MoreMenu from "@/app/_components/MoreMenu";
import type { Wall } from "@/lib/data/walls";
import { buildStudentUrl } from "@/lib/http/publicLinks";

import { deleteWallAction } from "./actions";

const MAX_RECENT = 8;

const sortOptions = [
  { value: "default", label: "기본순" },
  { value: "latest", label: "최신순" },
  { value: "name", label: "이름순" },
] as const;

type SortOption = (typeof sortOptions)[number]["value"];

type WallsListProps = {
  boardId: string;
  walls: Wall[];
  shareLinksAvailable: boolean;
  shareCode: string | null;
};

function normalize(value: string) {
  return value.toLowerCase();
}

function makeStorageKey(boardId: string) {
  return `dashboard_recent_walls_${boardId}`;
}

function readRecentWalls(boardId: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(makeStorageKey(boardId));
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function WallsList({
  boardId,
  walls,
  shareLinksAvailable,
  shareCode,
}: WallsListProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [recentIds, setRecentIds] = useState<string[]>(() => readRecentWalls(boardId));

  const handleRecent = (wallId: string) => {
    const next = [wallId, ...recentIds.filter((id) => id !== wallId)].slice(0, MAX_RECENT);
    setRecentIds(next);
    try {
      window.localStorage.setItem(makeStorageKey(boardId), JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const handleDeleteConfirm = (event: FormEvent<HTMLFormElement>) => {
    if (!window.confirm("이 담벼락을 삭제할까요? 학생이 작성한 카드도 함께 삭제됩니다.")) {
      event.preventDefault();
    }
  };

  const filteredWalls = useMemo(() => {
    const query = normalize(search.trim());
    const list = query
      ? walls.filter((wall) => normalize(`${wall.title} ${wall.description ?? ""}`).includes(query))
      : [...walls];

    if (sortBy === "name") {
      return list.sort((a, b) => a.title.localeCompare(b.title, "ko-KR"));
    }

    if (sortBy === "latest") {
      return list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    return list.sort((a, b) => a.position - b.position);
  }, [search, sortBy, walls]);

  const recentWalls = useMemo(
    () =>
      recentIds
        .map((id) => walls.find((wall) => wall.id === id))
        .filter((wall): wall is Wall => Boolean(wall)),
    [recentIds, walls],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">담벼락</h2>
          <p className="text-sm text-gray-600">총 {filteredWalls.length}개</p>
        </div>
        {walls.length > 0 ? (
          <button
            type="button"
            onClick={() => document.getElementById("wall-form")?.scrollIntoView({ behavior: "smooth" })}
            className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            새 담벼락 만들기
          </button>
        ) : null}
      </div>

      {walls.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          <p className="font-medium text-gray-800">아직 담벼락이 없습니다.</p>
          <p className="mt-1">수업 활동을 시작하려면 새 담벼락을 만들어보세요.</p>
          <button
            type="button"
            onClick={() => document.getElementById("wall-form")?.scrollIntoView({ behavior: "smooth" })}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            담벼락 만들기
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="wall-search" className="sr-only">
                  담벼락 검색
                </label>
                <div className="relative">
                  <input
                    id="wall-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="담벼락 제목/설명 검색"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      지우기
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="min-w-[160px]">
                <label htmlFor="wall-sort" className="sr-only">
                  담벼락 정렬
                </label>
                <select
                  id="wall-sort"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-sm text-gray-600">표시 {filteredWalls.length}개</p>
          </div>

          {recentWalls.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">최근 사용</h3>
                <span className="text-xs text-gray-500">최근 {recentWalls.length}개</span>
              </div>
              <ul className="grid gap-3 md:grid-cols-3">
                {recentWalls.map((wall) => (
                  <li key={wall.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                    <Link
                      href={`/dashboard/boards/${boardId}/walls/${wall.id}`}
                      onClick={() => handleRecent(wall.id)}
                      className="block space-y-1 rounded-md outline-none transition hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-200"
                    >
                      <p className="text-sm font-semibold text-gray-900">{wall.title}</p>
                      <p className="text-xs text-gray-600 line-clamp-1">
                        {wall.description ?? "설명 없음"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {filteredWalls.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
              <p className="font-medium text-gray-800">검색 결과가 없습니다.</p>
              <p className="mt-1">다른 검색어로 다시 시도해보세요.</p>
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-4 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                검색어 지우기
              </button>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {filteredWalls.map((wall) => (
                <li
                  key={wall.id}
                  className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-within:ring-2 focus-within:ring-indigo-200 focus-within:ring-offset-2 focus-within:ring-offset-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <Link
                          href={`/dashboard/boards/${boardId}/walls/${wall.id}`}
                          onClick={() => handleRecent(wall.id)}
                          className="text-lg font-semibold text-gray-900 transition group-hover:text-indigo-700"
                        >
                          {wall.title}
                        </Link>
                        <span className="rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
                          {new Date(wall.created_at).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {wall.description ?? "설명이 없습니다. 학생들이 참여할 주제를 적어보세요."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/boards/${boardId}/walls/${wall.id}`}
                          onClick={() => handleRecent(wall.id)}
                          className="inline-flex items-center rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          담벼락 열기
                        </Link>
                        {shareLinksAvailable && shareCode ? (
                          <>
                            <a
                            href={buildStudentUrl(`/s/${shareCode}/walls/${wall.id}`)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-800 transition hover:bg-gray-50"
                            >
                              학생 보기
                            </a>
                            <a
                            href={buildStudentUrl(`/s/${shareCode}/walls/${wall.id}/present`)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-800 transition hover:bg-gray-50"
                            >
                              프로젝터 보기
                            </a>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MoreMenu label="담벼락 더보기">
                        <Link
                          href={`/dashboard/boards/${boardId}/walls/${wall.id}/edit`}
                          className="block rounded-md px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
                        >
                          수정
                        </Link>
                        <form action={deleteWallAction} onSubmit={handleDeleteConfirm}>
                          <input type="hidden" name="boardId" value={boardId} />
                          <input type="hidden" name="wallId" value={wall.id} />
                          <button
                            type="submit"
                            className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </form>
                      </MoreMenu>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
