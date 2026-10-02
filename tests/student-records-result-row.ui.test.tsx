import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { autoGrowResultTextarea, StudentResultRow } from "@/app/dashboard/tools/student-records/_components/StudentResultRow";
import type { BrowserStudentRow } from "@/lib/student-records/contracts";

const row: BrowserStudentRow = { rowId: "row-1", studentNumber: 1, studentName: "홍길동", activity: "", strength: "", attitude: "", observation: "", generatedText: "가".repeat(93), teacherMemo: "", useInExport: true };

test("result row renders readable four-line auto-growing textarea and text length status", () => {
  const html = renderToStaticMarkup(<table><tbody><StudentResultRow row={row} targetLength={200} similarity={0} disabled={false} onChange={() => {}} /></tbody></table>);
  assert.match(html, /rows="4"/);
  assert.match(html, /min-h-24/);
  assert.match(html, /resize-y/);
  assert.match(html, /목표 범위: 160~220자 · 목표보다 짧음/);
  assert.match(html, /93자 · 279 bytes/);
});

test("result textarea grows to its current content height", () => {
  const textarea = document.createElement("textarea");
  Object.defineProperty(textarea, "scrollHeight", { value: 144 });
  textarea.style.height = "33px";
  autoGrowResultTextarea(textarea);
  assert.equal(textarea.style.height, "144px");
});
