import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { StudentRecordsXlsxExport } from "@/app/dashboard/tools/student-records/_components/StudentRecordsXlsxExport";
import type { BrowserStudentRow, RecordGenerationOptions } from "@/lib/student-records/contracts";

const options: RecordGenerationOptions = { recordType: "subject-detail", tone: "concise", targetLength: 200 };
const row: BrowserStudentRow = { rowId: "row-1", studentNumber: 1, studentName: "홍길동", activity: "토론", strength: "", attitude: "", observation: "", generatedText: "최종 문구", teacherMemo: "메모", useInExport: false };

test("XLSX export safely explains when no rows are selected", () => {
  const html = renderToStaticMarkup(<StudentRecordsXlsxExport rows={[row]} options={options} running={false} />);
  assert.match(html, /내보낼 행을 하나 이상 선택해주세요/);
  assert.match(html, /disabled=""/);
});
