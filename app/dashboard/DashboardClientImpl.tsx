"use client";

import { useMemo } from "react";

import { BoardList } from "./BoardList";

type DashboardClientImplProps = {
  initialClean?: boolean;
  shouldAutoOpenChecklist?: boolean;
  forceOnboarding?: boolean;
};
export default function DashboardClientImpl({
  initialClean,
  shouldAutoOpenChecklist,
  forceOnboarding,
}: DashboardClientImplProps) {
  const initialCleanView = useMemo(() => Boolean(initialClean), [initialClean]);

  return (
    <BoardList
      initialCleanView={initialCleanView}
      shouldAutoOpenChecklist={shouldAutoOpenChecklist}
      forceOnboarding={forceOnboarding}
    />
  );
}
