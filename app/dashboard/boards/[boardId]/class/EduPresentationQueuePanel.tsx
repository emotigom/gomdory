"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";

type FeaturedProject = {
  slug: string;
  title: string;
  authorName: string;
  lessonId: number | null;
  thumbUrl?: string | null;
  sortOrder?: number | null;
};

type FeaturedResponse = {
  items: FeaturedProject[];
  canManage: boolean;
  boardId: string | null;
};

type ReorderResponse = {
  ok?: boolean;
  message?: string;
};

type TrimResponse = {
  ok?: boolean;
  message?: string;
  keptCount?: number;
  trimmedCount?: number;
};

type StartMode = "auto" | "selected";

type PresentationSettingsResponse = {
  autoplayDefault: boolean;
  intervalSecDefault: number;
  startMode: StartMode;
  startSlug: string | null;
};

type EduPresentationQueuePanelProps = {
  boardId: string;
};

const LESSON_LABELS: Record<number, string> = {
  1: "1교시",
  2: "2교시",
  3: "3교시",
  4: "4교시",
};
const FEATURED_ORDER_SORT = ["featured", "order"].join("_");
const FEATURED_LIMIT = 12;

export default function EduPresentationQueuePanel({ boardId }: EduPresentationQueuePanelProps) {
  const [items, setItems] = useState<FeaturedProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [canManage, setCanManage] = useState(true);
  const [copiedTeacher, setCopiedTeacher] = useState(false);
  const [copiedStudent, setCopiedStudent] = useState(false);
  const [settings, setSettings] = useState<PresentationSettingsResponse>({
    autoplayDefault: false,
    intervalSecDefault: 20,
    startMode: "auto",
    startSlug: null,
  });

  const loadFeatured = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(
        apiV1Path(`edu/projects/featured?boardId=${encodeURIComponent(boardId)}&limit=50`),
      );
      const payload = (await response.json()) as FeaturedResponse;
      if (!response.ok) {
        setError("대표작 목록을 불러오지 못했습니다.");
        return;
      }
      setItems(payload.items ?? []);
      setCanManage(Boolean(payload.canManage));
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "대표작 목록을 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void loadFeatured();
  }, [loadFeatured]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadFeatured();
    };
    window.addEventListener("edu:featured-updated", handleRefresh);
    return () => {
      window.removeEventListener("edu:featured-updated", handleRefresh);
    };
  }, [loadFeatured]);

  const loadPresentationSettings = useCallback(async () => {
    if (!boardId) return;
    try {
      const response = await apiFetch(
        apiV1Path(`edu/presentation/settings?boardId=${encodeURIComponent(boardId)}`),
      );
      const payload = (await response.json()) as PresentationSettingsResponse;
      if (!response.ok) return;
      setSettings({
        autoplayDefault: Boolean(payload.autoplayDefault),
        intervalSecDefault: [10, 20, 30, 60].includes(payload.intervalSecDefault)
          ? payload.intervalSecDefault
          : 20,
        startMode: payload.startMode === "selected" ? "selected" : "auto",
        startSlug: payload.startSlug ?? null,
      });
    } catch {
      // ignore
    }
  }, [boardId]);

  useEffect(() => {
    void loadPresentationSettings();
  }, [loadPresentationSettings]);

  const handleMove = useCallback(
    async (slug: string, direction: "up" | "down" | "top") => {
      if (!canManage) return;
      setBusySlug(slug);
      setError(null);
      setNotice(null);
      try {
        const response = await apiFetch(apiV1Path("edu/projects/featured/reorder"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId, slug, direction }),
        });
        const payload = (await response.json().catch(() => null)) as ReorderResponse | null;
        if (!response.ok || !payload?.ok) {
          setError(payload?.message ?? "순서를 저장하지 못했습니다.");
          return;
        }
        setNotice("순서가 저장되었습니다.");
        await loadFeatured();
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "순서를 저장하지 못했습니다.";
        setError(message);
      } finally {
        setBusySlug(null);
      }
    },
    [boardId, canManage, loadFeatured],
  );

  const handleTrim = useCallback(async () => {
    if (!canManage) return;
    setIsTrimming(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(apiV1Path("edu/projects/featured/trim"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, limit: FEATURED_LIMIT }),
      });
      const payload = (await response.json().catch(() => null)) as TrimResponse | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.message ?? "대표작을 정리하지 못했습니다.");
        return;
      }
      setNotice("대표작을 12개로 정리했습니다.");
      await loadFeatured();
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "대표작을 정리하지 못했습니다.";
      setError(message);
    } finally {
      setIsTrimming(false);
    }
  }, [boardId, canManage, loadFeatured]);

  const disabledAll = loading || !canManage;

  const hasItems = items.length > 0;
  const featuredCount = items.length;
  const isOverLimit = featuredCount > FEATURED_LIMIT;
  const firstSlug = items[0]?.slug ?? "";
  const presentationLink = useMemo(() => {
    const startSlug = settings.startMode === "selected" && settings.startSlug ? settings.startSlug : "";
    const baseSlug = startSlug || firstSlug;
    if (!baseSlug) return "";
    const params = new URLSearchParams({
      present: "1",
      gallery: "1",
      teacher: "1",
      sort: FEATURED_ORDER_SORT,
      boardId,
    });
    if (!startSlug) {
      params.set("i", "0");
    }
    if (settings.autoplayDefault) {
      params.set("autoplay", "1");
      params.set("interval", String(settings.intervalSecDefault));
    }
    return `https://www.gomdory.com/edu/view/${baseSlug}/?${params.toString()}`;
  }, [
    boardId,
    firstSlug,
    settings.autoplayDefault,
    settings.intervalSecDefault,
    settings.startMode,
    settings.startSlug,
  ]);

  const studentLink = useMemo(() => {
    if (!firstSlug) return "";
    const params = new URLSearchParams({
      present: "1",
      gallery: "1",
      sort: FEATURED_ORDER_SORT,
      i: "0",
      boardId,
    });
    return `https://www.gomdory.com/edu/view/${firstSlug}/?${params.toString()}`;
  }, [boardId, firstSlug]);

  const handleCopyLink = useCallback(async (link: string, setCopied: (value: boolean) => void) => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("링크를 복사하세요.", link);
    }
  }, []);

  const summary = useMemo(() => {
    if (!canManage) return "권한이 없습니다.";
    if (loading) return "대표작을 불러오는 중입니다.";
    if (!hasItems) return "대표작이 아직 없습니다.";
    return null;
  }, [canManage, hasItems, loading]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-slate-700">발표 큐</p>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
              {featuredCount}/{FEATURED_LIMIT}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">발표 모드 슬라이드쇼 순서에 반영됩니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopyLink(presentationLink, setCopiedTeacher)}
            disabled={!presentationLink}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-300"
          >
            {copiedTeacher ? "복사됨" : "발표 링크 복사"}
          </button>
          <button
            type="button"
            onClick={() => handleCopyLink(studentLink, setCopiedStudent)}
            disabled={!studentLink}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
          >
            {copiedStudent ? "복사됨" : "학생용 링크"}
          </button>
        </div>
      </div>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
        {summary ? <p className="text-xs text-slate-400">{summary}</p> : null}
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {notice ? <p className="text-xs text-emerald-600">{notice}</p> : null}
        {isOverLimit ? (
          <div className="space-y-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-[11px] text-amber-700">
            <p>대표작은 최대 12개를 권장합니다. 나머지는 자동으로 해제할 수 있어요.</p>
            <button
              type="button"
              onClick={handleTrim}
              disabled={disabledAll || isTrimming}
              className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold text-amber-700 transition hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:border-amber-100 disabled:text-amber-300"
            >
              {isTrimming ? "정리 중..." : "12개로 자동 정리"}
            </button>
          </div>
        ) : null}
        <div className="space-y-3">
          {items.map((item, index) => {
            const isBusy = busySlug === item.slug;
            const isFirst = index === 0;
            const isLast = index === items.length - 1;
            const lessonLabel = item.lessonId ? LESSON_LABELS[item.lessonId] : "자유";
            return (
              <div
                key={item.slug}
                className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-16 overflow-hidden rounded-md border border-slate-200 bg-white">
                    {item.thumbUrl ? (
                      <Image
                        src={item.thumbUrl}
                        alt={`${item.title} 썸네일`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        width={64}
                        height={48}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                        썸네일
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.authorName} · {lessonLabel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleMove(item.slug, "top")}
                    disabled={disabledAll || isBusy || isFirst}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                  >
                    ⤒
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(item.slug, "up")}
                    disabled={disabledAll || isBusy || isFirst}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(item.slug, "down")}
                    disabled={disabledAll || isBusy || isLast}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                  >
                    ↓
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
