"use client";

import type { HTMLAttributes } from "react";
import StudentBoardCard from "@/components/student/board/StudentBoardCard";
import type { StudentBoardItem, StudentBoardModel } from "@/lib/student/normalizeStudentItems";

export default function WallGrid({
  model,
  onOpen,
  tvMode,
  ...props
}: {
  model: StudentBoardModel;
  onOpen: (item: StudentBoardItem) => void;
  tvMode: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const cards = model.items;

  if (!cards.length) {
    return (
      <div
        className="rounded-[28px] border border-dashed border-slate-200 bg-white/70 p-10 text-center text-slate-600"
        data-view="wall"
        {...props}
      >
        <p className="font-semibold text-slate-800">아직 도착한 카드가 없어요.</p>
        <p className="mt-2 text-sm text-slate-500">첫 질문이나 도움 요청을 남겨보세요.</p>
        <div className="mt-4 flex justify-center">
          <a
            href="#student-action-bar"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            질문하기로 이동
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-view="wall" {...props}>
      {model.pinnedItems.length ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
            <span className="text-lg">📌</span>
            <span>고정 카드</span>
          </div>
          <div
            className={
              tvMode
                ? "grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
            }
          >
            {model.pinnedItems.map((item) => (
              <StudentBoardCard key={item.id} item={item} onOpen={onOpen} variant="wall" tvMode={tvMode} />
            ))}
          </div>
        </section>
      ) : null}
      <div
        className={
          tvMode
            ? "grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        }
      >
        {model.items.map((item) => (
          <StudentBoardCard key={item.id} item={item} onOpen={onOpen} variant="wall" tvMode={tvMode} />
        ))}
      </div>
    </div>
  );
}
