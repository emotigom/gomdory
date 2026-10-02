"use client";

import { useEffect, useRef } from "react";

import useDismissableLayer from "@/app/_components/useDismissableLayer";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import { FileLibraryClient } from "@/app/dashboard/files/FileLibraryClient";

type FileManagerSheetProps = {
  open: boolean;
  onClose: () => void;
  initialBoardId?: string | null;
  title?: string;
  description?: string;
};

export function FileManagerSheet({
  open,
  onClose,
  initialBoardId = null,
  title = "파일 관리",
  description = "파일을 업로드하고 보드에 바로 삽입하세요.",
}: FileManagerSheetProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useDismissableLayer({
    isOpen: open,
    setIsOpen: (next) => {
      if (!next) {
        onClose();
      }
    },
    layerRef,
  });

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-3 py-6">
      <div
        ref={layerRef}
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">File Manager</p>
            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
          >
            닫기
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <FileLibraryClient embedded initialBoardId={initialBoardId} />
        </div>
      </div>
    </div>
  );
}
