export const CSV_ROSTER_ERROR_CODES = [
  "missing_required_header",
  "missing_class_name",
  "missing_role",
  "missing_display_label",
  "invalid_role",
  "invalid_email",
  "sensitive_column_detected",
  "max_rows_exceeded",
  "max_cell_length_exceeded",
  "malformed_csv",
] as const;

export const CSV_ROSTER_WARNING_CODES = [
  "duplicate_external_id",
  "duplicate_display_label_in_class",
  "missing_external_id",
  "empty_row_ignored",
  "unknown_column_ignored",
  "email_present_optional",
  "class_id_missing_optional",
] as const;

export const CSV_ROSTER_ISSUE_CODES = [...CSV_ROSTER_ERROR_CODES, ...CSV_ROSTER_WARNING_CODES] as const;

export type CsvRosterIssueCode = (typeof CSV_ROSTER_ISSUE_CODES)[number];
export type CsvRosterIssueSeverity = "error" | "warning";

type IssueDefinition = { severity: CsvRosterIssueSeverity; messageKo: string; messageEn?: string };

export const CSV_ROSTER_ISSUE_CATALOG: Record<CsvRosterIssueCode, IssueDefinition> = {
  missing_required_header: { severity: "error", messageKo: "필수 컬럼(class_name, role, display_label)이 필요합니다." },
  missing_class_name: { severity: "error", messageKo: "class_name이 필요합니다." },
  missing_role: { severity: "error", messageKo: "role이 필요합니다." },
  missing_display_label: { severity: "error", messageKo: "display_label이 필요합니다." },
  invalid_role: { severity: "error", messageKo: "role은 teacher/student(또는 교사/학생)여야 합니다." },
  invalid_email: { severity: "error", messageKo: "email 형식이 올바르지 않습니다." },
  sensitive_column_detected: { severity: "error", messageKo: "공식 로스터 CSV에는 전화번호, 주소, 생년월일, 보호자 연락처 등 불필요한 개인정보를 포함하지 마세요." },
  max_rows_exceeded: { severity: "error", messageKo: "최대 행 수 제한을 초과했습니다." },
  max_cell_length_exceeded: { severity: "error", messageKo: "셀 길이 제한을 초과했습니다." },
  malformed_csv: { severity: "error", messageKo: "CSV 형식이 잘못되었습니다." },
  duplicate_external_id: { severity: "warning", messageKo: "external_id가 중복되었습니다." },
  duplicate_display_label_in_class: { severity: "warning", messageKo: "같은 학급에서 display_label이 중복되었습니다." },
  missing_external_id: { severity: "warning", messageKo: "external_id가 비어 있습니다." },
  empty_row_ignored: { severity: "warning", messageKo: "빈 행은 무시됩니다." },
  unknown_column_ignored: { severity: "warning", messageKo: "알 수 없는 컬럼은 무시됩니다." },
  email_present_optional: { severity: "warning", messageKo: "email 컬럼은 선택입니다." },
  class_id_missing_optional: { severity: "warning", messageKo: "class_id 컬럼은 선택입니다." },
};

