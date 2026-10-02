import assert from "node:assert/strict";
import test from "node:test";

import type { BrowserStudentRow, RecordGenerationOptions } from "@/lib/student-records/contracts";
import { createExportRows, createExportSettings, EXPORT_HEADERS, summarizeExportRows } from "@/lib/student-records/exportRows";
import { buildStudentRecordsWorkbook } from "@/lib/student-records/exportXlsx.client";

const options: RecordGenerationOptions = { recordType: "subject-detail", tone: "concise", targetLength: 200 };
const makeRow = (overrides: Partial<BrowserStudentRow> = {}): BrowserStudentRow => ({
  rowId: "private-row-id",
  studentNumber: 7,
  studentName: "홍길동",
  activity: "토론",
  strength: "근거 제시",
  attitude: "성실함",
  observation: "질문에 답함",
  generatedText: "교사가 고친 최신 문구🙂",
  teacherMemo: "추가 확인",
  useInExport: true,
  ...overrides,
});

test("export row mapping excludes unselected and empty rows while preserving final browser values", () => {
  const empty = makeRow({ rowId: "empty", studentNumber: 1, studentName: "", activity: "", strength: "", attitude: "", observation: "", generatedText: "", teacherMemo: "" });
  const included = makeRow();
  const excluded = makeRow({ rowId: "excluded", studentNumber: 8, useInExport: false, generatedText: "=HYPERLINK(\"https://example.com\")" });
  const rows = createExportRows([empty, included, excluded]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].useStatus, "사용");
  assert.equal(rows[0].studentNumber, 7);
  assert.equal(rows[0].studentName, "홍길동");
  assert.equal(rows[0].generatedText, "교사가 고친 최신 문구🙂");
  assert.equal(rows[0].teacherMemo, "추가 확인");
  assert.equal(rows[0].characterCount, 13);
  assert.equal(rows[0].utf8Bytes, new TextEncoder().encode(rows[0].generatedText).length);
  assert.equal("rowId" in rows[0], false);
  assert.deepEqual(summarizeExportRows(rows), { total: 1, included: 1, excluded: 0, emptyGeneratedText: 0 });
});

test("25 selected rows preserve their input order for XLSX export", () => {
  const rows = createExportRows(Array.from({ length: 25 }, (_, index) => makeRow({ rowId: `row-${index}`, studentNumber: index + 1, generatedText: `최종 문구 ${index}` })));
  assert.equal(rows.length, 25);
  assert.deepEqual(rows.map((row) => row.studentNumber), Array.from({ length: 25 }, (_, index) => index + 1));
});

test("export settings use readable Korean labels", () => {
  assert.deepEqual(createExportSettings(options), { recordType: "교과 세부능력 및 특기사항", tone: "간결한 기록체", targetLength: "200자" });
});

test("workbook has exactly two styled sheets and supports 200 rows", async () => {
  const rows = Array.from({ length: 200 }, (_, index) => makeRow({ rowId: `row-${index}`, studentNumber: index + 1 }));
  const workbook = await buildStudentRecordsWorkbook(rows, options);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["작업용_전체", "사용안내"]);
  const work = workbook.getWorksheet("작업용_전체");
  assert.ok(work);
  assert.deepEqual(work.getRow(1).values.slice(1), [...EXPORT_HEADERS]);
  assert.equal(work.rowCount, 201);
  assert.equal(work.views[0]?.state, "frozen");
  assert.equal(work.views[0]?.ySplit, 1);
  assert.deepEqual(work.autoFilter, { from: { row: 1, column: 1 }, to: { row: 1, column: 11 } });
  assert.equal(work.getColumn(10).width, 50);
  assert.equal(work.getCell("J2").alignment.wrapText, true);
  assert.equal(work.getCell("B2").type, 2);
  assert.equal(work.getCell("H2").type, 2);
  assert.equal(work.getRow(1).font.bold, true);
  assert.ok(workbook.getWorksheet("사용안내"));
  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 0);
});

test("formula-like input stays plain text without formula or hyperlink metadata", async () => {
  const values = ["=HYPERLINK(\"https://example.com\")", "+SUM(A1:A2)", "-1+2", "@command"];
  const workbook = await buildStudentRecordsWorkbook(values.map((value, index) => makeRow({ rowId: `safe-${index}`, studentNumber: index + 1, generatedText: value })), options);
  const work = workbook.getWorksheet("작업용_전체");
  assert.ok(work);
  values.forEach((value, index) => {
    const cell = work.getCell(index + 2, 10);
    assert.equal(cell.value, value);
    assert.equal(cell.formula, undefined);
    assert.equal(cell.hyperlink, undefined);
  });
});

test("guide sheet records settings, counts, review, and safe-storage guidance without student details", async () => {
  const workbook = await buildStudentRecordsWorkbook([makeRow(), makeRow({ rowId: "two", studentName: "비공개이름", useInExport: false, generatedText: "" })], options);
  const guide = workbook.getWorksheet("사용안내");
  assert.ok(guide);
  const text = guide.getSheetValues().flat().join(" ");
  for (const expected of ["교과 세부능력 및 특기사항", "간결한 기록체", "200자", "전체 내보낸 행 수", "사용 행 수", "제외 행 수", "교사가 최종 검토", "안전하게 보관"]) assert.match(text, new RegExp(expected));
  assert.doesNotMatch(text, /홍길동|비공개이름|질문에 답함/);
});
