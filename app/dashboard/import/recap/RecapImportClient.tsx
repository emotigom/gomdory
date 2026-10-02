"use client";

import ImportBoardsShell from "../ImportBoardsShell";
import RecapImportPreview from "./RecapImportPreview";
import { routes } from "@/lib/standards/routes";

export default function RecapImportClient() {
  return (
    <ImportBoardsShell
      returnTo={routes.page.dashboard.import.recap()}
      title="리캡 가져오기"
      description="gom-recap JSON v1 또는 ZIP 파일을 업로드하면 템플릿별 미리보기를 확인할 수 있습니다."
    >
      {(boards) => <RecapImportPreview boards={boards} />}
    </ImportBoardsShell>
  );
}
