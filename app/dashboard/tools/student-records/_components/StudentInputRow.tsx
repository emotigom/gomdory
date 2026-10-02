import { memo } from "react";
import type { BrowserStudentRow } from "@/lib/student-records/contracts";

const fields: Array<{ key: keyof Pick<BrowserStudentRow, "studentName" | "activity" | "strength" | "attitude" | "observation">; label: string }> = [
  { key: "studentName", label: "이름" }, { key: "activity", label: "활동" }, { key: "strength", label: "강점" }, { key: "attitude", label: "참여 태도" }, { key: "observation", label: "관찰 메모" },
];
export const StudentInputRow = memo(function StudentInputRow({ row, onChange, disabled, hideStudentName = false }: { row: BrowserStudentRow; disabled: boolean; hideStudentName?: boolean; onChange: (rowId: string, field: typeof fields[number]["key"], value: string) => void }) {
  return <tr className="border-t border-neutral-200"><td className="p-2 text-center text-sm text-neutral-700">{row.studentNumber}</td>{fields.filter(({ key }) => !hideStudentName || key !== "studentName").map(({ key, label }) => <td className="p-2" key={key}><label className="sr-only" htmlFor={`${row.rowId}-${key}`}>{`${row.studentNumber}번 ${label}`}</label>{key === "observation" ? <textarea id={`${row.rowId}-${key}`} value={row[key]} disabled={disabled} aria-disabled={disabled} onChange={(event) => onChange(row.rowId, key, event.target.value)} className="min-h-16 w-52 rounded border border-neutral-300 bg-white p-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-700" /> : <input id={`${row.rowId}-${key}`} value={row[key]} disabled={disabled} aria-disabled={disabled} onChange={(event) => onChange(row.rowId, key, event.target.value)} className="w-36 rounded border border-neutral-300 bg-white p-2 text-sm text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-700" />}</td>)}</tr>;
});
