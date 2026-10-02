"use client";

import type { HTMLAttributes } from "react";

import BoardCardTile from "@/components/student/BoardCardTile";
import type { StudentBoardItem } from "@/lib/student/normalizeStudentItems";

const sortByDate = (a: StudentBoardItem, b: StudentBoardItem) => {
  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return timeB - timeA;
};

type StreamListProps = {
  items: StudentBoardItem[];
  onOpen: (item: StudentBoardItem) => void;
} & HTMLAttributes<HTMLDivElement>;

export default function StreamList({ items, onOpen, ...props }: StreamListProps) {
  if (!items.length) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500" data-view="stream" {...props}>
        아직 카드가 없어요. 첫 참여를 기다리고 있어요.
      </div>
    );
  }

  const ordered = [...items].sort(sortByDate);

  return (
    <div className="space-y-4" data-view="stream" {...props}>
      {ordered.map((item) => (
        <BoardCardTile key={item.id} item={item} onOpen={onOpen} variant="stream" />
      ))}
    </div>
  );
}
