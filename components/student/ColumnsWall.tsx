"use client";

import { useMemo, useRef, type KeyboardEvent } from "react";

import BoardCardTile from "@/components/student/BoardCardTile";
import type { StudentBoardItem, StudentBoardModel } from "@/lib/student/normalizeStudentItems";

const COLUMN_WIDTH = 340;

type ColumnsWallProps = {
  model: StudentBoardModel;
  onOpen: (item: StudentBoardItem) => void;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function ColumnsWall({ model, onOpen }: ColumnsWallProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const columns = useMemo(
    () => model.columns.filter((column) => column.items.length > 0),
    [model.columns],
  );

  const handleScroll = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;
    const delta = direction === "left" ? -COLUMN_WIDTH * 1.2 : COLUMN_WIDTH * 1.2;
    container.scrollBy({ left: delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      handleScroll("left");
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      handleScroll("right");
    }
  };

  if (!columns.length) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500" data-view="columns">
        아직 카드가 없어요. 첫 참여를 기다리고 있어요.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-view="columns">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">컬럼 보기</h2>
          <p className="text-sm text-slate-500">좌우 버튼 또는 트랙패드로 이동하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleScroll("left")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300"
            aria-label="왼쪽으로 이동"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => handleScroll("right")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300"
            aria-label="오른쪽으로 이동"
          >
            ▶
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto pb-4 pr-2"
        onKeyDown={handleKey}
        tabIndex={0}
        aria-label="컬럼 스크롤 영역"
      >
        {columns.map((column) => (
          <section
            key={column.id}
            className="flex w-[340px] flex-none flex-col gap-4 rounded-[28px] border border-white/60 bg-white/80 p-4 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.45)]"
          >
            <header className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{column.title}</h3>
                <p className="text-xs text-slate-500">{column.items.length}개 카드</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">컬럼</span>
            </header>
            <div className="flex flex-col gap-4">
              {column.items.map((item) => (
                <BoardCardTile key={item.id} item={item} onOpen={onOpen} variant="columns" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
