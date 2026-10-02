"use client";

import type { HTMLAttributes } from "react";
import StudentBoardCard from "@/components/student/board/StudentBoardCard";
import type { StudentBoardItem } from "@/lib/student/normalizeStudentItems";

export default function StreamList({
  items,
  onOpen,
  tvMode,
  ...props
}: {
  items: StudentBoardItem[];
  onOpen: (item: StudentBoardItem) => void;
  tvMode: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  if (!items.length) {
    return (
      <div
        className="rounded-[28px] border border-dashed border-slate-200 bg-white/70 p-10 text-center text-slate-600"
        data-view="stream"
        {...props}
      >
        <p className="font-semibold text-slate-800">아직 도착한 카드가 없어요.</p>
        <p className="mt-2 text-sm text-slate-500">첫 카드가 올라오면 타임라인에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-view="stream" {...props}>
      {items.map((item, index) => (
        <div key={item.id} className="relative">
          {index === 0 ? (
            <span className="absolute -left-2 -top-2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
              최신
            </span>
          ) : null}
          <StudentBoardCard item={item} onOpen={onOpen} variant="stream" tvMode={tvMode} />
        </div>
      ))}
    </div>
  );
}
