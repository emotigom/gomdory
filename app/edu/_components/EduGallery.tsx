"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import EduGalleryCard, { type GalleryProject } from "@/app/edu/_components/EduGalleryCard";
import { apiV1Path } from "@/lib/standards/pathTypes";

const SORT_OPTIONS = [
  { value: "newest", label: "최신" },
  { value: "popular", label: "인기" },
  { value: "featured_first", label: "대표 먼저" },
] as const;

const RANGE_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "today", label: "오늘" },
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
] as const;

const LESSON_OPTIONS = [
  { value: 0, label: "전체" },
  { value: 1, label: "1교시" },
  { value: 2, label: "2교시" },
  { value: 3, label: "3교시" },
  { value: 4, label: "4교시" },
] as const;

const DEFAULT_LIMIT = 12;

type FeaturedResponse = {
  items: GalleryProject[];
  canManage: boolean;
  boardId: string | null;
};

type GalleryResponse = {
  items: GalleryProject[];
  nextCursor?: string | null;
};

type EduGalleryProps = {
  initialShareCode?: string;
  allowCodeInput?: boolean;
};

function buildRangeFilters(value: string) {
  if (value === "today") {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: new Date().toISOString() };
  }
  if (value === "7d") {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return { from: from.toISOString(), to: new Date().toISOString() };
  }
  if (value === "30d") {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString(), to: new Date().toISOString() };
  }
  return { from: null, to: null };
}

export default function EduGallery({ initialShareCode = "", allowCodeInput = false }: EduGalleryProps) {
  const router = useRouter();
  const [shareCode, setShareCode] = useState(initialShareCode.trim().toUpperCase());
  const [codeInput, setCodeInput] = useState(initialShareCode.trim().toUpperCase());
  const [lessonId, setLessonId] = useState(0);
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["value"]>("newest");
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]["value"]>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<GalleryProject[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [featuredItems, setFeaturedItems] = useState<GalleryProject[]>([]);
  const [featuredSlugs, setFeaturedSlugs] = useState<Set<string>>(new Set());
  const [canManageFeatured, setCanManageFeatured] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);

  useEffect(() => {
    setShareCode(initialShareCode.trim().toUpperCase());
    setCodeInput(initialShareCode.trim().toUpperCase());
  }, [initialShareCode]);

  useEffect(() => {
    const handler = window.setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => window.clearTimeout(handler);
  }, [query]);

  const rangeFilters = useMemo(() => buildRangeFilters(range), [range]);

  const fetchFeatured = useCallback(async (targetShareCode: string) => {
    if (!targetShareCode) return;
    try {
      const params = new URLSearchParams({ shareCode: targetShareCode });
      const response = await fetch(`${apiV1Path("edu/projects/featured")}?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as FeaturedResponse | null;
      if (!response.ok || !payload) return;
      setFeaturedItems(payload.items ?? []);
      setFeaturedSlugs(new Set((payload.items ?? []).map((item) => item.slug)));
      setCanManageFeatured(payload.canManage ?? false);
      setBoardId(payload.boardId ?? null);
    } catch {
      // ignore
    }
  }, []);

  const fetchGallery = useCallback(
    async ({ cursor, append }: { cursor?: string | null; append?: boolean }) => {
      if (!shareCode) return;
      const params = new URLSearchParams();
      params.set("shareCode", shareCode);
      params.set("limit", String(DEFAULT_LIMIT));
      params.set("sort", sort);
      if (canManageFeatured) params.set("includeHidden", "1");
      if (cursor) params.set("cursor", cursor);
      if (lessonId) params.set("lessonId", String(lessonId));
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (rangeFilters.from) params.set("from", rangeFilters.from);
      if (rangeFilters.to) params.set("to", rangeFilters.to);

      const response = await fetch(`${apiV1Path("edu/projects/list")}?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as GalleryResponse | null;

      if (!response.ok || !payload) {
        setError("갤러리를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
        return;
      }

      setError(null);
      setNextCursor(payload.nextCursor ?? null);
      setItems((prev) => (append ? [...prev, ...(payload.items ?? [])] : payload.items ?? []));
    },
    [canManageFeatured, debouncedQuery, lessonId, rangeFilters.from, rangeFilters.to, shareCode, sort],
  );

  useEffect(() => {
    if (!shareCode) {
      setItems([]);
      setFeaturedItems([]);
      setFeaturedSlugs(new Set());
      setNextCursor(null);
      return;
    }

    setIsLoading(true);
    setItems([]);
    setNextCursor(null);

    Promise.all([fetchGallery({}), fetchFeatured(shareCode)]).finally(() => setIsLoading(false));
  }, [debouncedQuery, fetchFeatured, fetchGallery, lessonId, range, shareCode, sort]);

  const handleLoadMore = async () => {
    if (!nextCursor || isFetchingMore) return;
    setIsFetchingMore(true);
    await fetchGallery({ cursor: nextCursor, append: true });
    setIsFetchingMore(false);
  };

  const handleShareCodeApply = () => {
    const trimmed = codeInput.trim().toUpperCase();
    setShareCode(trimmed);
    if (allowCodeInput) {
      router.replace(`/edu/gallery?code=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleToggleFeatured = async (slug: string) => {
    if (!boardId) return;
    const next = !featuredSlugs.has(slug);
    try {
      const response = await fetch(apiV1Path("edu/projects/feature"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, slug, featured: next }),
      });
      if (!response.ok) return;
      await fetchFeatured(shareCode);
    } catch {
      // ignore
    }
  };

  const handleToggleHidden = async (slug: string, isHidden: boolean) => {
    if (!boardId) return;
    let reason: string | undefined;
    if (!isHidden) {
      const promptReason = window.prompt("숨김 사유를 입력해주세요. (선택)", "");
      reason = promptReason?.trim() || undefined;
    }
    try {
      const response = await fetch(apiV1Path("edu/projects/hide"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, slug, hidden: !isHidden, reason }),
      });
      if (!response.ok) return;
      await Promise.all([fetchGallery({}), fetchFeatured(shareCode)]);
    } catch {
      // ignore
    }
  };

  const canShowFeatured = featuredItems.length > 0;
  const emptyState = !isLoading && items.length === 0 && shareCode;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 shadow-lg ring-1 ring-emerald-100">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-emerald-500">프로젝트 갤러리</p>
          <h1 className="text-2xl font-bold text-slate-900">친구들의 작품을 구경해요</h1>
          <p className="text-sm text-slate-600">
            클래스 코드로 공유된 작품을 한눈에 모아보고, 인기 순으로 정렬해요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {allowCodeInput ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
                placeholder="클래스 코드"
                className="h-10 w-40 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 shadow-sm focus:border-emerald-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleShareCodeApply}
                className="h-10 rounded-full bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              >
                적용
              </button>
            </div>
          ) : (
            <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              클래스 {shareCode}
            </span>
          )}
          <Link
            href="/edu/lesson"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-600"
          >
            교시 목록으로
          </Link>
        </div>
      </header>

      <section className="grid gap-4 rounded-3xl bg-white/90 p-6 shadow-md ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          {LESSON_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setLessonId(option.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                lessonId === option.value
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
            <span className="text-xs font-semibold text-slate-400">검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목 또는 작성자"
              className="flex-1 text-sm font-semibold text-slate-700 focus:outline-none"
            />
          </div>
          <select
            value={range}
            onChange={(event) => setRange(event.target.value as (typeof RANGE_OPTIONS)[number]["value"])}
            className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as (typeof SORT_OPTIONS)[number]["value"])}
            className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {canShowFeatured ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">대표작</h2>
            <span className="text-xs font-semibold text-amber-600">선생님이 고른 작품</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {featuredItems.map((project) => (
              <div key={project.slug} className="min-w-[260px] max-w-[280px] flex-1">
                <EduGalleryCard
                  project={project}
                  isFeatured
                  isHidden={project.isHidden}
                  canManage={canManageFeatured}
                  boardId={boardId}
                  shareCode={shareCode}
                  onToggleFeatured={() => handleToggleFeatured(project.slug)}
                  onToggleHidden={() => handleToggleHidden(project.slug, project.isHidden)}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="rounded-3xl bg-rose-50 p-6 text-sm text-rose-700 ring-1 ring-rose-100">
          {error}
        </section>
      ) : null}

      {!shareCode && allowCodeInput ? (
        <section className="rounded-3xl bg-white/90 p-10 text-center shadow-lg ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-600">클래스 코드를 입력하면 갤러리가 열려요.</p>
          <p className="mt-2 text-xs text-slate-500">상단 입력창에 공유 코드를 입력해주세요.</p>
        </section>
      ) : null}

      {isLoading ? (
        <section className="rounded-3xl bg-white/90 p-10 text-center text-sm text-slate-500 shadow-lg ring-1 ring-slate-200">
          갤러리를 불러오는 중이에요...
        </section>
      ) : null}

      {emptyState ? (
        <section className="rounded-3xl bg-white/90 p-10 text-center shadow-lg ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-slate-600">아직 등록된 작품이 없어요.</p>
          <p className="mt-2 text-xs text-slate-500">게시 후 잠시 기다리면 카드가 보여요.</p>
        </section>
      ) : null}

      {items.length > 0 ? (
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((project) => (
            <EduGalleryCard
              key={project.slug}
              project={project}
              isFeatured={featuredSlugs.has(project.slug)}
              isHidden={project.isHidden}
              canManage={canManageFeatured}
              boardId={boardId}
              shareCode={shareCode}
              onToggleFeatured={() => handleToggleFeatured(project.slug)}
              onToggleHidden={() => handleToggleHidden(project.slug, project.isHidden)}
            />
          ))}
        </section>
      ) : null}

      {nextCursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isFetchingMore}
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {isFetchingMore ? "불러오는 중..." : "더 보기"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
