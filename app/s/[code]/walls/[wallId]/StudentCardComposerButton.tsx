"use client";

import { useState } from "react";

import StudentCardComposerModal from "./StudentCardComposerModal";
import { cn } from "@/app/_components/uiTokens";

type StudentCardComposerButtonProps = {
  shareCode: string;
  wallId: string;
  wallTitle: string;
  writeAllowed: boolean;
  className?: string;
};

export default function StudentCardComposerButton({
  shareCode,
  wallId,
  wallTitle,
  writeAllowed,
  className,
}: StudentCardComposerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const writeLocked = !writeAllowed;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={writeLocked}
        className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        카드 작성
      </button>
      {writeLocked ? (
        <p className="text-xs text-gray-500">
          수업이 잠겨있어요. 선생님이 열어주시면 작성할 수 있어요.
        </p>
      ) : null}
      <StudentCardComposerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        shareCode={shareCode}
        wallId={wallId}
        wallTitle={wallTitle}
        writeLocked={writeLocked}
      />
    </div>
  );
}
