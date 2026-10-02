"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { BrowserStudentRow, RecordGenerationOptions } from "@/lib/student-records/contracts";
import { createExportRows, summarizeExportRows } from "@/lib/student-records/exportRows";
import { buildStudentRecordsXlsxBlob, downloadStudentRecordsXlsx, studentRecordsXlsxFileName } from "@/lib/student-records/exportXlsx.client";
import { GoogleDriveSaveButton } from "@/app/_components/google-drive/GoogleDriveSaveButton";

export function StudentRecordsXlsxExport({ rows, options, running }: { rows: BrowserStudentRow[]; options: RecordGenerationOptions; running: boolean }) {
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);
  const [exportError, setExportError] = useState("");
  const summary = useMemo(() => summarizeExportRows(createExportRows(rows)), [rows]);
  const exportXlsx = useCallback(async () => {
    if (running || exportingRef.current || summary.total === 0) return;
    exportingRef.current = true; setExporting(true); setExportError("");
    try { await downloadStudentRecordsXlsx(rows.map((row) => ({ ...row })), { ...options }); }
    catch { setExportError("XLSX 파일을 만들지 못했습니다. 잠시 후 다시 시도해주세요."); }
    finally { exportingRef.current = false; setExporting(false); }
  }, [options, rows, running, summary.total]);
  const disabled = running || exporting || summary.total === 0;
  return <section className="rounded-xl border border-neutral-200 bg-white p-4"><h2 className="font-semibold">XLSX 내보내기</h2><p className="mt-1 text-sm text-neutral-600">현재 브라우저에 있는 최종 수정 내용을 작업용 파일로 저장합니다. 학생 정보는 서버로 전송되지 않습니다.</p><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-4"><div><dt className="text-neutral-500">선택한 내용 행</dt><dd className="font-semibold">{summary.total}개</dd></div><div><dt className="text-neutral-500">사용 행</dt><dd className="font-semibold">{summary.included}개</dd></div><div><dt className="text-neutral-500">제외 행</dt><dd className="font-semibold">{rows.filter((row) => !row.useInExport && row.generatedText.trim()).length}개</dd></div><div><dt className="text-neutral-500">최종 문구가 빈 행</dt><dd className="font-semibold">{summary.emptyGeneratedText}개</dd></div></dl>{summary.total === 0 ? <p className="mt-3 text-sm text-amber-800">내보낼 행을 하나 이상 선택해주세요.</p> : summary.emptyGeneratedText > 0 ? <p className="mt-3 text-sm text-amber-800">최종 문구가 비어 있는 행이 {summary.emptyGeneratedText}개 있습니다. 내려받은 파일에서 다시 확인해주세요.</p> : null}<div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={disabled} aria-disabled={disabled} onClick={() => void exportXlsx()} className="rounded bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">XLSX 내려받기</button><GoogleDriveSaveButton purpose="student-records" defaultFolderName="학생 문구" buttonLabel="Google Drive에 저장" disabled={disabled} createFile={async () => ({ blob: await buildStudentRecordsXlsxBlob(rows, options), fileName: studentRecordsXlsxFileName(), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", appProperties: { gomdoryArtifactType: "student-records-xlsx", gomdoryVersion: "1" } })}/><p aria-live="polite" className={exportError ? "text-sm text-red-700" : "text-sm text-neutral-600"}>{exporting ? "파일을 준비하고 있습니다…" : exportError}</p></div></section>;
}
