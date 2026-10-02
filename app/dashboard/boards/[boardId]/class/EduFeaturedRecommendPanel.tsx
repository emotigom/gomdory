"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";

type RecommendItem = {
  slug: string;
  title: string;
  authorName: string;
  lessonId: number | null;
  viewCount: number;
  stamp: string | null;
  createdAt: string;
  score: number;
  reasons: string[];
  thumbUrl?: string | null;
};

type RecommendResponse = {
  items: RecommendItem[];
};

type ApplyResponse = {
  ok?: boolean;
  appliedCount?: number;
  mode?: "append" | "replace";
  message?: string;
};

type EduFeaturedRecommendPanelProps = {
  boardId: string;
};

const LESSON_LABELS: Record<number, string> = {
  1: "1교시",
  2: "2교시",
  3: "3교시",
  4: "4교시",
};

function buildThumbUrl(slug: string) {
  const publicOrigin = process.env.NEXT_PUBLIC_EDUVIEW_ORIGIN ?? "https://eduview.gkrry.com";
  return `${publicOrigin}/v1/${slug}/thumb.png`;
}

export default function EduFeaturedRecommendPanel({ boardId }: EduFeaturedRecommendPanelProps) {
  const [items, setItems] = useState<RecommendItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleRecommend = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(
        apiV1Path(`edu/projects/recommend?boardId=${encodeURIComponent(boardId)}&limit=12`),
      );
      const payload = (await response.json()) as RecommendResponse;
      if (!response.ok) {
        setError("추천 목록을 불러오지 못했습니다.");
        return;
      }
      const nextItems = payload.items ?? [];
      setItems(nextItems);
      setSelected(new Set(nextItems.map((item) => item.slug)));
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "추천 목록을 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  const handleToggle = useCallback((slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  const selectedSlugs = useMemo(
    () => items.filter((item) => selected.has(item.slug)).map((item) => item.slug),
    [items, selected],
  );

  const handleApply = useCallback(
    async (mode: "append" | "replace") => {
      if (selectedSlugs.length === 0) {
        setError("선택된 추천이 없습니다.");
        return;
      }
      if (mode === "replace") {
        const confirmed = window.confirm("대표작 큐를 추천으로 교체할까요? 기존 순서는 사라집니다.");
        if (!confirmed) return;
      }
      setIsApplying(true);
      setError(null);
      setNotice(null);
      try {
        const response = await apiFetch(apiV1Path("edu/projects/featured/apply-recommendation"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId, mode, slugs: selectedSlugs }),
        });
        const payload = (await response.json().catch(() => null)) as ApplyResponse | null;
        if (!response.ok || !payload?.ok) {
          setError(payload?.message ?? "대표작 적용에 실패했습니다.");
          return;
        }
        setNotice(
          mode === "replace"
            ? "추천으로 대표작 큐를 교체했습니다."
            : "선택한 추천을 대표작 큐에 추가했습니다.",
        );
        window.dispatchEvent(new CustomEvent("edu:featured-updated"));
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "대표작 적용에 실패했습니다.";
        setError(message);
      } finally {
        setIsApplying(false);
      }
    },
    [boardId, selectedSlugs],
  );

  const hasItems = items.length > 0;
  const disabledApply = isApplying || selectedSlugs.length === 0;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-800">대표작 자동 추천</p>
          <p className="text-xs text-slate-500">
            조회수, 선생님 스탬프, 최신성을 기준으로 추천합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRecommend}
          disabled={loading}
          className="rounded-full border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-300"
        >
          {loading ? "추천 불러오는 중..." : "대표작 자동 추천"}
        </button>
      </div>

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {notice ? <p className="text-xs text-emerald-600">{notice}</p> : null}

      {!hasItems ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4 text-xs text-slate-400">
          버튼을 눌러 추천을 확인해 주세요.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const checked = selected.has(item.slug);
            const lessonLabel = item.lessonId ? LESSON_LABELS[item.lessonId] : "자유";
            const thumbUrl = item.thumbUrl ?? buildThumbUrl(item.slug);
            return (
              <label
                key={item.slug}
                className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggle(item.slug)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  <div className="h-16 w-24 overflow-hidden rounded-md border border-slate-200 bg-white">
                    {thumbUrl ? (
                      <Image
                        src={thumbUrl}
                        alt={`${item.title} 썸네일`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        width={96}
                        height={64}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                        썸네일
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.authorName} · {lessonLabel}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      {item.reasons.map((reason, index) => (
                        <span key={`${item.slug}-reason-${index}`}>{reason}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 sm:justify-end">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    점수 {item.score.toFixed(1)}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleApply("append")}
          disabled={disabledApply}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
        >
          선택한 것 대표작에 추가
        </button>
        <button
          type="button"
          onClick={() => handleApply("replace")}
          disabled={disabledApply}
          className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-800 disabled:cursor-not-allowed disabled:border-rose-100 disabled:text-rose-300"
        >
          대표작 큐 교체(12개)
        </button>
        {hasItems ? (
          <span className="text-xs text-slate-400">{selectedSlugs.length}개 선택됨</span>
        ) : null}
      </div>
    </div>
  );
}
