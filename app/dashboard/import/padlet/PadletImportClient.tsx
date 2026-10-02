"use client";

import ImportBoardsShell from "../ImportBoardsShell";
import PadletImportPreview from "./PadletImportPreview";
import { routes } from "@/lib/standards/routes";

export default function PadletImportClient() {
  return (
    <ImportBoardsShell
      returnTo={routes.page.dashboard.import.padlet()}
      title="Padlet 가져오기"
      description="Padlet CSV 또는 ZIP을 업로드하면 곰도리 보드용 미리보기를 확인할 수 있습니다."
    >
      {(boards) => <PadletImportPreview boards={boards} />}
    </ImportBoardsShell>
  );
}
