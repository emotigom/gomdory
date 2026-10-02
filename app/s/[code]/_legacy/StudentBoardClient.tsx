"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn, pill } from "@/app/_components/uiTokens";
import useTvMode from "./useTvMode";
import ViewSwitcher, { updateViewSearchParams } from "./ViewSwitcher";
import CardPreviewModal from "./CardPreviewModal";
import StudentCardComposerModal from "./StudentCardComposerModal";
import WallView from "../_components/layouts/WallView";
import ColumnsView from "../_components/layouts/ColumnsView";
import GalleryView from "../_components/layouts/GalleryView";
import StreamView from "../_components/layouts/StreamView";
import type { StudentBoardModel, StudentCard } from "@/lib/student/boardModel";
import { isStudentView, parseStudentView, type StudentView } from "@/lib/student/view";
import { WRITE_LOCK_COPY, type WriteLockReason } from "@/lib/student/writeLockReason";

export default function StudentBoardClient({
  model,
  title,
  shareCode,
  view,
  writeLocked,
  writeLockedReason = null,
  demoMode = false,
}: {
  model: StudentBoardModel;
  title: string;
  shareCode: string;
  view: StudentView;
  writeLocked: boolean;
  writeLockedReason?: WriteLockReason | null;
  demoMode?: boolean;
}) {
  const tvMode = useTvMode();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [composeWallId, setComposeWallId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement | null>(null);

  const safeDefaultView = view ?? "wall";
  const rawViewParam = searchParams.get("view");
  const viewParam = parseStudentView(rawViewParam);
  const currentView = viewParam ?? safeDefaultView;
  const shouldSyncView = !rawViewParam || !isStudentView(rawViewParam);

  useEffect(() => {
    if (!shouldSyncView) return;
    const next = updateViewSearchParams(searchParams, currentView);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [currentView, pathname, router, searchParams, shouldSyncView]);

  const allCards = useMemo(() => [...model.pinnedCards, ...model.cards], [model.cards, model.pinnedCards]);

  useEffect(() => {
    if (!activeCardId) return;
    if (allCards.some((card) => card.id === activeCardId)) return;
    setActiveCardId(allCards[0]?.id ?? null);
  }, [activeCardId, allCards]);

  const activeIndex = useMemo(
    () => allCards.findIndex((card) => card.id === activeCardId),
    [activeCardId, allCards],
  );

  const handleNext = () => {
    if (!allCards.length) return;
    const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % allCards.length : 0;
    setActiveCardId(allCards[nextIndex]?.id ?? null);
  };

  const handlePrev = () => {
    if (!allCards.length) return;
    const prevIndex = activeIndex >= 0 ? (activeIndex - 1 + allCards.length) % allCards.length : 0;
    setActiveCardId(allCards[prevIndex]?.id ?? null);
  };

  const handleOpenPreview = (item: StudentCard) => {
    if (demoMode) return;
    setActiveCardId(item.id);
  };

  const handleOpenComposer = (wallId: string) => {
    if (writeLocked || demoMode) return;
    const targetColumn = model.columns.find((column) => column.key === wallId);
    if (targetColumn?.studentWriteEnabled === false) return;
    setComposeWallId(wallId);
    setIsComposerOpen(true);
  };

  const handleCloseComposer = () => {
    setIsComposerOpen(false);
  };

  const handleComposeClick = () => {
    if (writeLocked || demoMode) return;
    const columns = model.columns;
    const writableColumns = columns.filter((column) => column.studentWriteEnabled !== false);
    if (writableColumns.length === 1 && writableColumns[0]) {
      handleOpenComposer(writableColumns[0].key);
      return;
    }
    if (writableColumns.length > 1) {
      setIsColumnPickerOpen((prev) => !prev);
    }
  };

  const handleSelectColumn = (wallId: string) => {
    handleOpenComposer(wallId);
    setIsColumnPickerOpen(false);
  };

  useEffect(() => {
    if (!isColumnPickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!columnPickerRef.current) return;
      if (!columnPickerRef.current.contains(event.target as Node)) {
        setIsColumnPickerOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsColumnPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isColumnPickerOpen]);

  const activeColumnTitle = composeWallId
    ? model.columns.find((column) => column.key === composeWallId)?.title
    : null;
  const lockCopy = writeLockedReason ? WRITE_LOCK_COPY[writeLockedReason] : null;

  const renderView = () => {
    switch (currentView) {
      case "columns":
        return (
          <ColumnsView
            model={model}
            onOpen={handleOpenPreview}
            onCompose={handleOpenComposer}
            tvMode={tvMode}
            writeLocked={writeLocked}
          />
        );
      case "gallery":
        return <GalleryView model={model} onOpen={handleOpenPreview} tvMode={tvMode} />;
      case "stream":
        return <StreamView model={model} onOpen={handleOpenPreview} tvMode={tvMode} />;
      case "wall":
      default:
        return <WallView model={model} onOpen={handleOpenPreview} tvMode={tvMode} />;
    }
  };

  return (
    <div data-page-marker="student-board" data-view={currentView} className="relative space-y-6 text-slate-800">
      <div
        className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-slate-50 via-white to-white"
        aria-hidden
      />
      <div className="space-y-4 rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_24px_120px_-80px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-indigo-500">Student Share</p>
            <div className={cn("font-semibold text-slate-900", tvMode ? "text-3xl" : "text-2xl")}>
              {title}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>코드 {shareCode.toUpperCase()}</span>
              <span className="text-slate-300">·</span>
              <span className={cn(pill.badge, writeLocked ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
                {writeLocked ? lockCopy?.badge ?? "읽기 전용" : "작성 가능"}
              </span>
            </div>
          </div>

          <div className="flex flex-1 justify-center">
            <ViewSwitcher value={currentView} tvMode={tvMode} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative" ref={columnPickerRef}>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={handleComposeClick}
                  disabled={writeLocked || demoMode || model.columns.every((column) => column.studentWriteEnabled === false)}
                  className={cn(
                    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 font-semibold text-white shadow-[0_12px_30px_-18px_rgba(79,70,229,0.9)] transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300",
                    tvMode ? "min-h-[52px] text-base" : "text-sm",
                  )}
                >
                  <span aria-hidden>+</span>
                  카드 작성
                </button>
                {writeLocked ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    {lockCopy?.badge ?? "작성 잠김"}
                  </span>
                ) : null}
                {writeLocked && lockCopy ? (
                  <span className="text-xs font-medium text-amber-700">{lockCopy.message}</span>
                ) : null}
              </div>

              {isColumnPickerOpen && model.columns.length > 1 ? (
                <div className="absolute right-0 top-full z-20 mt-3 w-[260px] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">컬럼 선택</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">어느 컬럼에 작성할까요?</p>
                  <div className="mt-3 space-y-2">
                    {model.columns.map((column) => (
                      <button
                        key={column.key}
                        type="button"
                        onClick={() => handleSelectColumn(column.key)}
                        disabled={column.studentWriteEnabled === false}
                        className={cn(
                          "flex w-full items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400",
                        )}
                      >
                        <span>{column.title}</span>
                        <span className="text-xs text-slate-400">
                          {column.studentWriteEnabled === false ? "잠김" : "작성하기"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <Link
              href={`/?code=${shareCode}`}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 font-semibold text-slate-700 transition hover:border-slate-300",
                tvMode ? "min-h-[52px] text-base" : "text-sm",
              )}
            >
              코드 다시 입력
            </Link>
            <Link
              href={`/?code=${shareCode}`}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 px-4 font-semibold text-indigo-700 transition hover:border-indigo-300",
                tvMode ? "min-h-[52px] text-base" : "text-sm",
              )}
            >
              도움
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-6">{renderView()}</div>

      <CardPreviewModal
        items={allCards}
        activeId={activeCardId}
        onClose={() => setActiveCardId(null)}
        onNext={handleNext}
        onPrev={handlePrev}
        tvMode={tvMode}
      />
      <StudentCardComposerModal
        isOpen={isComposerOpen}
        onClose={handleCloseComposer}
        shareCode={shareCode}
        wallId={composeWallId}
        wallTitle={activeColumnTitle}
        writeLocked={writeLocked}
        writeLockedReason={writeLockedReason}
      />
    </div>
  );
}
