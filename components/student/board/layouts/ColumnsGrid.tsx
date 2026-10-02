"use client";

import type { HTMLAttributes } from "react";
import StudentBoardCard from "@/components/student/board/StudentBoardCard";
import type { StudentBoardItem, StudentBoardModel } from "@/lib/student/normalizeStudentItems";

export default function ColumnsGrid({
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
        data-view="columns"
        {...props}
      >
        <p className="font-semibold text-slate-800">아직 도착한 카드가 없어요.</p>
        <p className="mt-2 text-sm text-slate-500">질문을 남기면 컬럼으로 정리됩니다.</p>
      </div>
    );
  }

  return (
    <div
      className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3"
      data-view="columns"
      {...props}
    >
      {model.columns.map((column) => (
        <section key={column.id} className="flex flex-col gap-4">
          <div className="rounded-3xl border border-white/80 bg-white/90 px-5 py-4 shadow-[0_16px_60px_-45px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-2">
              <h3 className={tvMode ? "text-2xl font-semibold text-slate-900" : "text-lg font-semibold text-slate-900"}>
                {column.title}
              </h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {column.items.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">컬럼별로 카드를 정리했어요.</p>
          </div>
          <div className="flex flex-col gap-4">
            {column.items.map((item) => (
              <StudentBoardCard key={item.id} item={item} onOpen={onOpen} variant="columns" tvMode={tvMode} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
