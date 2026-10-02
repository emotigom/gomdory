import type { BrowserStudentRow } from "./contracts";

export function clearGeneratedTextForTargetRows(rows: ReadonlyArray<BrowserStudentRow>, targetRowIds: ReadonlySet<string>): BrowserStudentRow[] {
  return rows.map((row) => targetRowIds.has(row.rowId) ? { ...row, generatedText: "" } : row);
}
