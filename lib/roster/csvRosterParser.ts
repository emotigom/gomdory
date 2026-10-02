import { CSV_ROSTER_ISSUE_CATALOG, type CsvRosterIssueCode, type CsvRosterIssueSeverity } from "@/lib/roster/csvRosterIssueCodes";

export type CsvRosterNormalizedRole = "teacher" | "student";
export type CsvRosterSupportedField = "class_name" | "class_id" | "role" | "display_label" | "external_id" | "email";
export type CsvRosterParsedRow = { rowNumber: number; class_name: string; class_id?: string; role: CsvRosterNormalizedRole; display_label: string; external_id?: string; email?: string };
export type CsvRosterIssue = { code: CsvRosterIssueCode; severity: CsvRosterIssueSeverity; messageKo: string; messageEn?: string; field?: string; rowNumber?: number; columns?: string[] };
export type CsvRosterDryRunResult = { ok: boolean; summary: { totalRows: number; acceptedRows: number; rejectedRows: number; warningCount: number; classCount: number; teacherCount: number; studentCount: number }; rows: CsvRosterParsedRow[]; errors: CsvRosterIssue[]; warnings: CsvRosterIssue[]; detectedColumns: string[]; normalizedColumns: string[]; sensitiveColumns: string[] };
export type CsvRosterParserOptions = { maxRows?: number; maxCellLength?: number; emptyRowAsWarning?: boolean };

const HEADER_ALIASES: Record<string, CsvRosterSupportedField> = { class_name: "class_name", "class name": "class_name", 학급명: "class_name", class_id: "class_id", "class id": "class_id", 학급id: "class_id", role: "role", 역할: "role", display_label: "display_label", "display label": "display_label", 표시명: "display_label", 닉네임: "display_label", external_id: "external_id", "external id": "external_id", 외부id: "external_id", email: "email", 이메일: "email" };
const SENSITIVE_COLUMNS = new Set(["phone", "전화번호", "연락처", "address", "주소", "birth_date", "생일", "생년월일", "national_id", "주민등록번호", "guardian_name", "보호자", "guardian_phone", "보호자연락처", "health", "건강정보", "medical", "민감정보"]);
const ROLE_ALIASES: Record<string, CsvRosterNormalizedRole> = { teacher: "teacher", student: "student", 교사: "teacher", 학생: "student" };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeKey = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
const makeIssue = (code: CsvRosterIssueCode, extras: Omit<Partial<CsvRosterIssue>, "code" | "severity" | "messageKo" | "messageEn"> = {}): CsvRosterIssue => ({ code, severity: CSV_ROSTER_ISSUE_CATALOG[code].severity, messageKo: CSV_ROSTER_ISSUE_CATALOG[code].messageKo, messageEn: CSV_ROSTER_ISSUE_CATALOG[code].messageEn, ...extras });

function parseCsvText(csvText: string): string[][] {
  const rows: string[][] = [];
  const text = csvText.replace(/^\uFEFF/, "");
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i += 1; continue; }
      if (ch === '"') { inQuotes = false; continue; }
      cell += ch; continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\r" && next === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i += 1; continue; }
    if (ch === "\n" || ch === "\r") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    cell += ch;
  }
  if (inQuotes) throw new Error("malformed_csv");
  row.push(cell); rows.push(row); return rows;
}

export function parseCsvRosterDryRun(csvText: string, options: CsvRosterParserOptions = {}): CsvRosterDryRunResult {
  const maxRows = options.maxRows ?? 1000;
  const maxCellLength = options.maxCellLength ?? 200;
  const emptyRowAsWarning = options.emptyRowAsWarning ?? false;
  const errors: CsvRosterIssue[] = [];
  const warnings: CsvRosterIssue[] = [];
  const rows: CsvRosterParsedRow[] = [];

  let csvRows: string[][] = [];
  try { csvRows = parseCsvText(csvText); } catch { return { ok: false, summary: { totalRows: 0, acceptedRows: 0, rejectedRows: 0, warningCount: 0, classCount: 0, teacherCount: 0, studentCount: 0 }, rows: [], errors: [makeIssue("malformed_csv")], warnings: [], detectedColumns: [], normalizedColumns: [], sensitiveColumns: [] }; }
  const detectedColumns = (csvRows[0] ?? []).map((h) => h.trim()).filter(Boolean);
  const normalizedColumns = detectedColumns.map((h) => HEADER_ALIASES[normalizeKey(h)] ?? normalizeKey(h));
  const sensitiveColumns = detectedColumns.filter((h) => SENSITIVE_COLUMNS.has(normalizeKey(h)));
  if (sensitiveColumns.length) errors.push(makeIssue("sensitive_column_detected", { columns: sensitiveColumns }));
  const requiredColumns: CsvRosterSupportedField[] = ["class_name", "role", "display_label"];
  if (!requiredColumns.every((c) => normalizedColumns.includes(c))) errors.push(makeIssue("missing_required_header"));
  const supportedFields = new Set<CsvRosterSupportedField>(["class_name", "class_id", "role", "display_label", "external_id", "email"]);
  normalizedColumns.forEach((c) => {
    if (!supportedFields.has(c as CsvRosterSupportedField)) warnings.push(makeIssue("unknown_column_ignored", { field: c }));
  });

  const externalIdSeen = new Set<string>();
  const classDisplaySeen = new Set<string>();
  const totalRows = Math.max(0, csvRows.length - 1);
  const limitedRows = csvRows.slice(1, maxRows + 1);
  if (totalRows > maxRows) errors.push(makeIssue("max_rows_exceeded"));

  limitedRows.forEach((csvRow, i) => {
    const rowNumber = i + 2;
    const rowObj: Record<string, string> = {};
    let hasAnyValue = false;
    normalizedColumns.forEach((col, colIdx) => {
      if (SENSITIVE_COLUMNS.has(normalizeKey(detectedColumns[colIdx] ?? ""))) return;
      const raw = (csvRow[colIdx] ?? "").trim();
      if (raw) hasAnyValue = true;
      if (raw.length > maxCellLength) errors.push(makeIssue("max_cell_length_exceeded", { rowNumber, field: col }));
      rowObj[col] = raw;
    });
    if (!hasAnyValue) { if (emptyRowAsWarning) warnings.push(makeIssue("empty_row_ignored", { rowNumber })); return; }

    const class_name = rowObj.class_name ?? "";
    const display_label = rowObj.display_label ?? "";
    const roleValue = rowObj.role ?? "";
    const role = ROLE_ALIASES[normalizeKey(roleValue)];
    const external_id = rowObj.external_id || undefined;
    const email = rowObj.email || undefined;
    let reject = false;
    if (!class_name) { reject = true; errors.push(makeIssue("missing_class_name", { rowNumber, field: "class_name" })); }
    if (!roleValue) { reject = true; errors.push(makeIssue("missing_role", { rowNumber, field: "role" })); }
    else if (!role) { reject = true; errors.push(makeIssue("invalid_role", { rowNumber, field: "role" })); }
    if (!display_label) { reject = true; errors.push(makeIssue("missing_display_label", { rowNumber, field: "display_label" })); }
    if (email && !EMAIL_PATTERN.test(email)) errors.push(makeIssue("invalid_email", { rowNumber, field: "email" }));
    if (email) warnings.push(makeIssue("email_present_optional", { rowNumber, field: "email" }));
    if (!external_id) warnings.push(makeIssue("missing_external_id", { rowNumber, field: "external_id" }));
    if (external_id && externalIdSeen.has(external_id)) warnings.push(makeIssue("duplicate_external_id", { rowNumber, field: "external_id" }));
    if (external_id) externalIdSeen.add(external_id);
    const classDisplay = `${class_name}::${display_label}`;
    if (classDisplaySeen.has(classDisplay)) warnings.push(makeIssue("duplicate_display_label_in_class", { rowNumber, field: "display_label" }));
    classDisplaySeen.add(classDisplay);
    if (!rowObj.class_id) warnings.push(makeIssue("class_id_missing_optional", { rowNumber, field: "class_id" }));
    if (!reject && role) rows.push({ rowNumber, class_name, class_id: rowObj.class_id || undefined, role, display_label, external_id, email });
  });

  return { ok: errors.length === 0, summary: { totalRows, acceptedRows: rows.length, rejectedRows: totalRows - rows.length, warningCount: warnings.length, classCount: new Set(rows.map((r) => r.class_name)).size, teacherCount: rows.filter((r) => r.role === "teacher").length, studentCount: rows.filter((r) => r.role === "student").length }, rows, errors, warnings, detectedColumns, normalizedColumns, sensitiveColumns };
}
