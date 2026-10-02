"use client";

import type { HTMLAttributes } from "react";

import BoardCardTile from "@/components/student/BoardCardTile";
import type { StudentBoardItem, StudentBoardModel } from "@/lib/student/normalizeStudentItems";

const isTeacherHighlight = (item: StudentBoardItem) => item.kind === "notice";

const sortByDate = (a: StudentBoardItem, b: StudentBoardItem) => {
  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return timeB - timeA;
};

type GalleryGridProps = {
  model: StudentBoardModel;
  onOpen: (item: StudentBoardItem) => void;
} & HTMLAttributes<HTMLDivElement>;

export default function GalleryGrid({ model, onOpen, ...props }: GalleryGridProps) {
  const pinnedIds = new Set(model.pinnedItems.map((item) => item.id));
  const highlightItems = model.items.filter((item) => isTeacherHighlight(item) && !pinnedIds.has(item.id));
  const pinnedItems = model.items.filter((item) => pinnedIds.has(item.id));
  const remainingItems = model.items.filter(
    (item) => !pinnedIds.has(item.id) && !isTeacherHighlight(item),
  );

  const sections = [
    pinnedItems.length ? { id: "pinned", label: "고정", items: pinnedItems } : null,
    highlightItems.length ? { id: "notice", label: "교사 강조", items: highlightItems } : null,
    remainingItems.length ? { id: "recent", label: "최근", items: [...remainingItems].sort(sortByDate) } : null,
  ].filter(Boolean) as Array<{ id: string; label: string; items: StudentBoardItem[] }>;

  if (!model.items.length) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" data-view="gallery" {...props}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="student-skeleton h-[220px] rounded-[28px]"
            aria-hidden
          />
        ))}
        <div className="col-span-full rounded-[28px] border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">
          아직 카드가 없어요. 첫 참여를 기다리고 있어요.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-view="gallery" {...props}>
      {sections.map((section) => (
        <section key={section.id} className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <span className="h-2 w-2 rounded-full bg-indigo-400" aria-hidden />
            <span>{section.label}</span>
            <span className="text-xs text-slate-400">{section.items.length}개</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {section.items.map((item) => (
              <BoardCardTile
                key={item.id}
                item={item}
                onOpen={onOpen}
                prominent={section.id !== "recent"}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
