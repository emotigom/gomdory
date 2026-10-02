"use client";

import { useEffect, useMemo, useState } from "react";

import type { StudentView } from "@/lib/student/view";
import type { StudentBoardItem, StudentBoardModel } from "@/lib/student/normalizeStudentItems";
import ColumnsWall from "@/components/student/ColumnsWall";
import GalleryGrid from "@/components/student/GalleryGrid";
import StreamList from "@/components/student/StreamList";

const VIEW_LIMITS: Record<StudentView, number> = {
  wall: 36,
  columns: 48,
  gallery: 36,
  stream: 48,
};

const LOAD_STEP = 24;

export default function ShowcaseBody({
  view,
  model,
  onOpenPreview,
}: {
  view: StudentView;
  model: StudentBoardModel;
  onOpenPreview: (item: StudentBoardItem) => void;
}) {
  const baseLimit = useMemo(() => VIEW_LIMITS[view] ?? 48, [view]);
  const [renderLimit, setRenderLimit] = useState(baseLimit);

  useEffect(() => {
    setRenderLimit(baseLimit);
  }, [baseLimit]);

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
      pinnedItems: limitedItems.filter((item) => item.pinned),
    }),
    [limitedColumns, limitedItems, model],
  );

  const hasMore = model.items.length > limitedItems.length;

  const renderView = () => {
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-500">
          {limitedItems.length.toLocaleString()} / {model.items.length.toLocaleString()}개 표시 중
        </div>
        {hasMore ? (
          <button
            type="button"
            onClick={() => setRenderLimit((prev) => Math.min(prev + LOAD_STEP, model.items.length))}
            className="min-h-[44px] rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            더 보기
          </button>
        ) : null}
      </div>
      {renderView()}
    </div>
  );
}
