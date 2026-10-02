"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { StudentView } from "@/lib/student/view";
import type { StudentBoardItem, StudentBoardModel } from "@/lib/student/normalizeStudentItems";
import ColumnsWall from "@/components/student/ColumnsWall";
import GalleryGrid from "@/components/student/GalleryGrid";
import StreamList from "@/components/student/StreamList";

const VIEW_LIMITS: Record<StudentView, number> = {
  wall: 60,
  columns: 80,
  gallery: 60,
  stream: 100,
};

const LOAD_STEP = 40;

export default function StudentBoardLayout({
  view,
  model,
  onOpenPreview,
  totalCount,
  isFiltered,
  resetKey,
}: {
  view: StudentView;
  model: StudentBoardModel;
  onOpenPreview: (item: StudentBoardItem) => void;
  totalCount: number;
  isFiltered: boolean;
  resetKey: string;
}) {
  const isGuardActive = totalCount > 300 && !isFiltered;
  const baseLimit = useMemo(() => (isGuardActive ? 40 : VIEW_LIMITS[view] ?? 60), [isGuardActive, view]);
  const [renderLimit, setRenderLimit] = useState(baseLimit);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRenderLimit(baseLimit);
  }, [baseLimit, resetKey]);

  const limitedItems = useMemo(() => model.items.slice(0, renderLimit), [model.items, renderLimit]);
  const limitedIds = useMemo(() => new Set(limitedItems.map((item) => item.id)), [limitedItems]);
  const limitedColumns = useMemo(
    () =>
      model.columns.map((column) => ({
        ...column,
        items: column.items.filter((item) => limitedIds.has(item.id)),
      })),
    [limitedIds, model.columns],
  );
  const limitedModel = useMemo(
    () => ({
      ...model,
      items: limitedItems,
      columns: limitedColumns,
    }),
    [limitedColumns, limitedItems, model],
  );

  const hasMore = model.items.length > limitedItems.length;
  const shouldAutoLoad = !isGuardActive;

  useEffect(() => {
    if (!shouldAutoLoad) return undefined;
    if (!hasMore) return undefined;
    const element = sentinelRef.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setRenderLimit((prev) => Math.min(prev + LOAD_STEP, model.items.length));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, model.items.length, shouldAutoLoad]);

  const renderView = (): ReactNode => {
    switch (view) {
      case "columns":
        return <ColumnsWall model={limitedModel} onOpen={onOpenPreview} />;
      case "wall":
        return <GalleryGrid model={limitedModel} onOpen={onOpenPreview} />;
      case "stream":
        return <StreamList items={limitedItems} onOpen={onOpenPreview} />;
      case "gallery":
      default:
        return <GalleryGrid model={limitedModel} onOpen={onOpenPreview} />;
    }
  };

  return (
    <div className="space-y-6">
      {totalCount > 300 ? (
        <div className="rounded-3xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-700">
          카드가 많아 일부만 표시합니다. 검색을 사용하거나 스트림 보기를 추천해요.
        </div>
      ) : null}
      {renderView()}
      {hasMore ? (
        <div className="flex flex-col items-center gap-3">
          {isGuardActive ? (
            <button
              type="button"
              onClick={() => setRenderLimit((prev) => Math.min(prev + LOAD_STEP, model.items.length))}
              className="flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              더 보기
            </button>
          ) : (
            <div ref={sentinelRef} className="h-8 w-full" aria-hidden />
          )}
          <p className="text-xs text-slate-400">
            {limitedItems.length} / {model.items.length}개 표시 중
          </p>
        </div>
      ) : null}
    </div>
  );
}
