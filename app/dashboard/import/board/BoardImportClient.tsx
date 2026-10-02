"use client";

import ImportBoardsShell from "../ImportBoardsShell";
import BoardImportPreview from "./BoardImportPreview";
import { routes } from "@/lib/standards/routes";

export default function BoardImportClient() {
  return (
    <ImportBoardsShell
      returnTo={routes.page.dashboard.import.board()}
      title="보드 가져오기"
      description="gom-board-zip-v1 ZIP 파일을 업로드하면 미리보기와 경고를 확인할 수 있습니다."
    >
      {(boards) => <BoardImportPreview boards={boards} />}
    </ImportBoardsShell>
  );
}
