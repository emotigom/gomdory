"use client";

import type { HTMLAttributes } from "react";
import StudentBoardCard from "@/components/student/board/StudentBoardCard";
import type { StudentBoardItem, StudentBoardModel } from "@/lib/student/normalizeStudentItems";

export default function GalleryGrid({
  model,
  onOpen,
  tvMode,
  ...props
}: {
  model: StudentBoardModel;
  onOpen: (item: StudentBoardItem) => void;
  tvMode: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  if (!model.items.length) {
    return (
      <div
        className="rounded-[28px] border border-dashed border-slate-200 bg-white/70 p-10 text-center text-slate-600"
        data-view="gallery"
        {...props}
      >
        <p className="font-semibold text-slate-800">아직 도착한 카드가 없어요.</p>
        <p className="mt-2 text-sm text-slate-500">사진이나 자료가 도착하면 갤러리로 보여드릴게요.</p>
      </div>
    );
  }

  return (
    <div
      className="grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      data-view="gallery"
      {...props}
    >
      {model.items.map((item) => (
        <StudentBoardCard key={item.id} item={item} onOpen={onOpen} variant="gallery" tvMode={tvMode} />
      ))}
    </div>
  );
}
