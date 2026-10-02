"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useTvMode from "./useTvMode";
import { isStudentView, parseStudentView, type StudentView } from "@/lib/student/view";
import type { StudentBoardItem, StudentBoardModel } from "@/lib/student/normalizeStudentItems";
import { applyStudentBoardFilters, sortStudentBoardItems } from "@/lib/student/studentBoardFilters";
import StudentBoardLayout from "@/components/student/board/StudentBoardLayout";
import PreviewModal from "@/components/student/board/PreviewModal";
import StudentTopBar from "@/components/student/StudentTopBar";
import ShowcaseTopBar from "@/components/student/show/ShowcaseTopBar";
import ShowcaseBody from "@/components/student/show/ShowcaseBody";
import { useShowHotkeys } from "@/lib/student/showHotkeys";

export default function SharedBoardShell({
  model,
  title,
  shareCode,
  view,
  mode = "default",
  demoMode = false,
}: {
  model: StudentBoardModel;
  title: string;
  shareCode: string;
  view: StudentView;
  mode?: "default" | "show";
  demoMode?: boolean;
}) {
  const safeDefaultView = view ?? "wall";
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const tvMode = useTvMode();
  const isShowcase = mode === "show";
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const query = "";
  const filter = "all";
  const sort = "new";

  const rawViewParam = searchParams.get("view");
  const viewParam = parseStudentView(rawViewParam);
  const currentView = viewParam ?? safeDefaultView;
  const shouldSyncView = !rawViewParam || !isStudentView(rawViewParam);

  useEffect(() => {
    if (!shouldSyncView) return;
    const next = new URLSearchParams(searchParams);
    next.set("view", currentView);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [currentView, pathname, router, searchParams, shouldSyncView]);

  const handleViewChange = (nextView: StudentView) => {
    const next = new URLSearchParams(searchParams);
    next.set("view", nextView);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  useShowHotkeys({
    enabled: isShowcase,
    isModalOpen: Boolean(activeCardId),
    onViewChange: handleViewChange,
  });

  const filteredItems = useMemo(
    () => applyStudentBoardFilters(model.items, { query, filter, sort }),
    [filter, model.items, query, sort],
  );
  const filteredIds = useMemo(() => new Set(filteredItems.map((item) => item.id)), [filteredItems]);
  const filteredColumns = useMemo(
    () =>
      model.columns.map((column) => ({
        ...column,
        items: sortStudentBoardItems(
          column.items.filter((item) => filteredIds.has(item.id)),
          sort,
        ),
      })),
    [filteredIds, model.columns, sort],
  );
  const filteredModel = useMemo(
    () => ({
      items: filteredItems,
      pinnedItems: filteredItems.filter((item) => item.pinned),
      columns: filteredColumns,
    }),
    [filteredColumns, filteredItems],
  );

  const activeCardIndex = useMemo(
    () => filteredItems.findIndex((card) => card.id === activeCardId),
    [activeCardId, filteredItems],
  );

  useEffect(() => {
    if (!activeCardId) return;
    if (filteredItems.some((card) => card.id === activeCardId)) return;
    setActiveCardId(filteredItems[0]?.id ?? null);
  }, [activeCardId, filteredItems]);

  const handleNext = () => {
    if (!filteredItems.length) return;
    const nextIndex = activeCardIndex >= 0 ? (activeCardIndex + 1) % filteredItems.length : 0;
    setActiveCardId(filteredItems[nextIndex]?.id ?? null);
  };

  const handlePrev = () => {
    if (!filteredItems.length) return;
    const prevIndex =
      activeCardIndex >= 0 ? (activeCardIndex - 1 + filteredItems.length) % filteredItems.length : 0;
    setActiveCardId(filteredItems[prevIndex]?.id ?? null);
  };

  const handleOpenPreview = (item: StudentBoardItem) => {
    if (demoMode) return;
    setActiveCardId(item.id);
  };

  return (
    <div
      className={isShowcase ? "relative min-h-screen bg-slate-50 text-slate-900" : "relative space-y-6 text-slate-800"}
      {...(isShowcase ? { "data-page-marker": "student-show" } : {})}
    >
      {isShowcase ? (
        <div className="absolute inset-0 -z-10 bg-slate-50" aria-hidden />
      ) : (
        <div
          className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-slate-50 via-white to-white"
          aria-hidden
        />
      )}
      {isShowcase ? (
        <ShowcaseTopBar
          title={title}
          shareCode={shareCode}
          totalCount={model.items.length}
          questionCount={model.items.filter((item) => item.kind === "question").length}
        />
      ) : (
        <StudentTopBar shareCode={shareCode} view={currentView} onViewChange={handleViewChange} />
      )}
      {isShowcase ? (
        <div className="mx-auto w-full max-w-[1480px] space-y-6 px-6 pb-20 pt-6">
          <ShowcaseBody
            view={currentView}
            model={filteredModel}
            onOpenPreview={handleOpenPreview}
          />
        </div>
      ) : (
        <StudentBoardLayout
          view={currentView}
          model={filteredModel}
          onOpenPreview={handleOpenPreview}
          totalCount={model.items.length}
          isFiltered={Boolean(query.trim()) || filter !== "all"}
          resetKey={`${query.trim()}|${filter}|${sort}`}
        />
      )}
      <PreviewModal
        items={filteredItems}
        activeId={activeCardId}
        onClose={() => setActiveCardId(null)}
        onNext={handleNext}
        onPrev={handlePrev}
        tvMode={tvMode}
      />
    </div>
  );
}
