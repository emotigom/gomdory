"use client";

import type { BrowserStudentRow, RecordGenerationOptions } from "./contracts";
import { createExportRows, createExportSettings, EXPORT_HEADERS, summarizeExportRows, type StudentRecordExportRow } from "./exportRows";

const LONG_TEXT_COLUMNS = [4, 5, 6, 7, 10, 11];
const COLUMN_WIDTHS = [10, 8, 14, 24, 24, 24, 36, 10, 12, 50, 30];
const INSTRUCTIONS = [
  "생성 문구는 초안이며 교사가 최종 검토해야 합니다.",
  "입력에 없는 사실을 추가하지 않았는지 확인합니다.",
  "학생 이름과 번호는 생성 API payload에 포함되지 않습니다.",
  "다운로드 파일에는 이름과 관찰 내용이 포함되므로 안전하게 보관합니다.",
  "불필요해진 파일은 기기에서 삭제합니다.",
  "‘사용 여부’ 필터로 사용할 행과 제외할 행을 구분할 수 있습니다.",
  "글자 수와 UTF-8 byte는 최종 수정 문구를 기준으로 계산됩니다.",
  "학교 또는 기관의 기록 기준을 최종적으로 확인합니다.",
];

type ExcelJSImport = typeof import("exceljs");
type ExcelJSApi = ExcelJSImport;

function resolveExcelJS(module: ExcelJSImport): ExcelJSApi {
  return ((module as unknown as { default?: ExcelJSApi }).default ?? module) as ExcelJSApi;
}

function addWorkSheet(workbook: InstanceType<ExcelJSApi["Workbook"]>, rows: readonly StudentRecordExportRow[]) {
  const worksheet = workbook.addWorksheet("작업용_전체");
  worksheet.addRow([...EXPORT_HEADERS]);
  for (const row of rows) {
    // Strings are assigned directly so formula-like user input remains plain text.
    worksheet.addRow([row.useStatus, row.studentNumber, row.studentName, row.activity, row.strength, row.attitude, row.observation, row.characterCount, row.utf8Bytes, row.generatedText, row.teacherMemo]);
  }
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXPORT_HEADERS.length } };
  worksheet.columns.forEach((column, index) => { column.width = COLUMN_WIDTHS[index]; });
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 24;
  header.eachCell((cell) => { cell.border = { bottom: { style: "medium", color: { argb: "FF94A3B8" } } }; });
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "top" };
    LONG_TEXT_COLUMNS.forEach((columnNumber) => { row.getCell(columnNumber).alignment = { vertical: "top", wrapText: true }; });
    [2, 8, 9].forEach((columnNumber) => { row.getCell(columnNumber).alignment = { vertical: "top", horizontal: "center" }; });
    row.eachCell((cell) => { cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } }; });
  });
}

function addGuideSheet(workbook: InstanceType<ExcelJSApi["Workbook"]>, options: RecordGenerationOptions, rows: readonly StudentRecordExportRow[]) {
  const worksheet = workbook.addWorksheet("사용안내");
  const settings = createExportSettings(options);
  const summary = summarizeExportRows(rows);
  worksheet.columns = [{ width: 22 }, { width: 68 }];
  worksheet.mergeCells("A1:B1");
  const title = worksheet.getCell("A1");
  title.value = "학생 기록 문구 작업 파일 사용안내";
  title.font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
  title.alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 30;
  worksheet.addRow([]);
  worksheet.addRow(["현재 설정", ""]);
  worksheet.addRow(["기록 유형", settings.recordType]);
  worksheet.addRow(["문체", settings.tone]);
  worksheet.addRow(["목표 길이", settings.targetLength]);
  worksheet.addRow([]);
  worksheet.addRow(["내보내기 요약", ""]);
  worksheet.addRow(["전체 내보낸 행 수", summary.total]);
  worksheet.addRow(["사용 행 수", summary.included]);
  worksheet.addRow(["제외 행 수", summary.excluded]);
  worksheet.addRow(["최종 문구가 빈 행 수", summary.emptyGeneratedText]);
  worksheet.addRow([]);
  worksheet.addRow(["확인 사항", ""]);
  INSTRUCTIONS.forEach((instruction, index) => worksheet.addRow([index + 1, instruction]));
  [3, 8, 14].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF475569" } };
  });
  worksheet.eachRow({ includeEmpty: false }, (row) => { row.alignment = { vertical: "top", wrapText: true }; });
}

export async function buildStudentRecordsWorkbook(rows: readonly BrowserStudentRow[], options: RecordGenerationOptions) {
  const ExcelJS = resolveExcelJS(await import("exceljs"));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gomdory";
  workbook.created = new Date();
  const exportRows = createExportRows(rows);
  addWorkSheet(workbook, exportRows);
  addGuideSheet(workbook, options, exportRows);
  return workbook;
}

export function studentRecordsXlsxFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `학생기록문구_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;
}

export async function buildStudentRecordsXlsxBlob(rows: readonly BrowserStudentRow[], options: RecordGenerationOptions): Promise<Blob> {
  const workbook = await buildStudentRecordsWorkbook(rows.map((row) => ({ ...row })), { ...options });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function downloadStudentRecordsXlsx(rows: readonly BrowserStudentRow[], options: RecordGenerationOptions): Promise<void> {
  const blob = await buildStudentRecordsXlsxBlob(rows, options);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = studentRecordsXlsxFileName();
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
