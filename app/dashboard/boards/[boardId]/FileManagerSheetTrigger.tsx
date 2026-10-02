"use client";

import { useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { FileManagerSheet } from "@/components/files/FileManagerSheet";

type FileManagerSheetTriggerProps = {
  boardId: string;
  variant?: "manage" | "insert";
};

export default function FileManagerSheetTrigger({ boardId, variant = "insert" }: FileManagerSheetTriggerProps) {
  const [open, setOpen] = useState(false);
  const title = variant === "insert" ? "파일 삽입" : "파일 관리";
  const description =
    variant === "insert"
      ? "보드에 넣을 파일을 선택하세요."
      : "업로드한 파일을 관리하고 보드에 바로 추가하세요.";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          buttonTone("secondary", { size: "sm" }),
          variant === "insert" ? "min-h-[36px]" : "min-h-[40px]",
        )}
      >
        {title}
      </button>
      <FileManagerSheet
        open={open}
        onClose={() => setOpen(false)}
        initialBoardId={boardId}
        title={title}
        description={description}
      />
    </>
  );
}
