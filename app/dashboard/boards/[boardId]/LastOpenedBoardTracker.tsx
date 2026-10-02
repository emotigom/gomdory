"use client";

import { useEffect } from "react";

import { setLastOpenedBoardId } from "@/lib/dashboard/lastOpenedBoard";

type LastOpenedBoardTrackerProps = {
  boardId: string;
};

export default function LastOpenedBoardTracker({ boardId }: LastOpenedBoardTrackerProps) {
  useEffect(() => {
    void setLastOpenedBoardId(boardId);
  }, [boardId]);

  return null;
}
