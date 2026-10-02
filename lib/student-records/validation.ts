import {
  MAX_ACTIVITY_LENGTH, MAX_ATTITUDE_LENGTH, MAX_BATCH_SIZE, MAX_OBSERVATION_LENGTH, MAX_STRENGTH_LENGTH,
  MAX_STUDENT_COUNT, MIN_STUDENT_COUNT, RECORD_TONES, RECORD_TYPES, MAX_TARGET_LENGTH, MIN_TARGET_LENGTH, type ProviderRecordInput, type RecordGenerationOptions,
} from "./contracts";

export type ValidationResult = { blockingErrors: string[]; warnings: string[] };
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?<!\d)(?:01[016789]|0[2-6]\d?)[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/;
const RRN = /(?<!\d)\d{6}[-\s]?[1-4]\d{6}(?!\d)/;
const OPAQUE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/;

function unique(items: string[]) { return [...new Set(items)]; }
function rowLabel(index: number) { return `${index + 1}번 학생`; }
function hasContent(row: ProviderRecordInput) { return [row.activity, row.strength, row.attitude, row.observation].some((value) => value.trim()); }

function validateRowRules(rows: ReadonlyArray<ProviderRecordInput>): ValidationResult {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];
  const signatures: string[] = [];
  rows.forEach((row, index) => {
    const values = [row.activity, row.strength, row.attitude, row.observation].map((value) => value.trim());
    if (!OPAQUE_ID.test(row.rowId)) blockingErrors.push(`${rowLabel(index)}의 행 식별값이 올바르지 않습니다.`);
    if (!values.some(Boolean)) blockingErrors.push(`${rowLabel(index)}의 관찰 내용을 한 가지 이상 입력해 주세요.`);
    const limits: Array<[string, number, string]> = [["활동", MAX_ACTIVITY_LENGTH, values[0]], ["강점", MAX_STRENGTH_LENGTH, values[1]], ["참여 태도", MAX_ATTITUDE_LENGTH, values[2]], ["관찰 메모", MAX_OBSERVATION_LENGTH, values[3]]];
    limits.forEach(([label, limit, value]) => { if (value.length > limit) blockingErrors.push(`${rowLabel(index)}의 ${label}는 ${limit}자 이하여야 합니다.`); });
    values.forEach((text) => {
      if (EMAIL.test(text)) blockingErrors.push(`${rowLabel(index)} 입력에 이메일이 포함되어 있습니다. 삭제해 주세요.`);
      if (PHONE.test(text)) blockingErrors.push(`${rowLabel(index)} 입력에 전화번호가 포함되어 있습니다. 삭제해 주세요.`);
      if (RRN.test(text)) blockingErrors.push(`${rowLabel(index)} 입력에 주민등록번호와 유사한 값이 포함되어 있습니다. 삭제해 주세요.`);
    });
    signatures.push(JSON.stringify(values));
  });
  const seenRowIds = new Set<string>();
  rows.forEach((row, index) => {
    if (seenRowIds.has(row.rowId)) blockingErrors.push(`${rowLabel(index)}의 행 식별값이 중복되었습니다.`);
    seenRowIds.add(row.rowId);
  });
  if (rows.length > 1 && new Set(signatures).size === 1) warnings.push("모든 학생의 관찰 입력이 동일합니다. 학생별 관찰을 확인해 주세요.");
  return { blockingErrors: unique(blockingErrors), warnings: unique(warnings) };
}

export function validateStudentCount(count: number): string | null {
  return Number.isInteger(count) && count >= MIN_STUDENT_COUNT && count <= MAX_STUDENT_COUNT ? null : "학생 수는 1명 이상 200명 이하여야 합니다.";
}

/** Validates the full browser operation (up to 200 rows); blank unused rows are ignored. */
export function validateStudentRecordOperationRows(rows: ReadonlyArray<ProviderRecordInput>): ValidationResult {
  const blockingErrors: string[] = [];
  if (rows.length < MIN_STUDENT_COUNT || rows.length > MAX_STUDENT_COUNT) blockingErrors.push("학생 수는 1명 이상 200명 이하여야 합니다.");
  const targets = rows.filter(hasContent);
  if (!targets.length) blockingErrors.push("생성할 학생의 관찰 내용을 한 가지 이상 입력해 주세요.");
  const validation = validateRowRules(targets);
  return { blockingErrors: unique([...blockingErrors, ...validation.blockingErrors]), warnings: validation.warnings };
}

/** Authoritative API validator for a single request (1–5 rows). */
export function validateStudentRecordBatchRows(rows: ReadonlyArray<ProviderRecordInput>): ValidationResult {
  const countErrors = rows.length < 1 || rows.length > MAX_BATCH_SIZE ? ["한 번에 생성할 수 있는 학생 수는 1명 이상 5명 이하여야 합니다."] : [];
  const validation = validateRowRules(rows);
  return { blockingErrors: unique([...countErrors, ...validation.blockingErrors]), warnings: validation.warnings };
}

/** @deprecated Use the operation or batch validator explicitly. */
export const validateProviderRows = validateStudentRecordBatchRows;

export function isRecordGenerationOptions(value: RecordGenerationOptions): boolean {
  return (RECORD_TYPES as readonly string[]).includes(value.recordType) && (RECORD_TONES as readonly string[]).includes(value.tone) && Number.isInteger(value.targetLength) && value.targetLength >= MIN_TARGET_LENGTH && value.targetLength <= MAX_TARGET_LENGTH;
}
