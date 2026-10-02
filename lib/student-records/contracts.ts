export const DEFAULT_STUDENT_COUNT = 25;
export const MIN_STUDENT_COUNT = 1;
export const MAX_STUDENT_COUNT = 200;
export const MAX_BATCH_SIZE = 5;
export const MAX_ACTIVITY_LENGTH = 200;
export const MAX_STRENGTH_LENGTH = 200;
export const MAX_ATTITUDE_LENGTH = 200;
export const MAX_OBSERVATION_LENGTH = 300;
export const MAX_REQUEST_BYTES = 16 * 1024;
export const MAX_GENERATED_TEXT_LENGTH = 2_000;

export const RECORD_TYPES = ["subject-detail", "behavior-summary", "autonomous-activity"] as const;
export const RECORD_TONES = ["concise", "growth", "objective"] as const;
export const MIN_TARGET_LENGTH = 30;
export const MAX_TARGET_LENGTH = 500;

export type RecordType = typeof RECORD_TYPES[number];
export type RecordTone = typeof RECORD_TONES[number];

export type RecordGenerationOptions = {
  recordType: RecordType;
  tone: RecordTone;
  targetLength: number;
};

export type BrowserStudentRow = {
  rowId: string;
  studentNumber: number;
  studentName: string;
  activity: string;
  strength: string;
  attitude: string;
  observation: string;
  generatedText: string;
  teacherMemo: string;
  useInExport: boolean;
};

/** This is the sole browser-to-provider mapping. It deliberately excludes PII and review fields. */
export type ProviderRecordInput = {
  rowId: string;
  activity: string;
  strength: string;
  attitude: string;
  observation: string;
};

export type ProviderGeneratedRecord = { rowId: string; generatedText: string };

export type GenerateBatchRequest = {
  operationId: string;
  batchId: string;
  rows: ProviderRecordInput[];
  options: RecordGenerationOptions;
};

export type GenerateBatchResponse = {
  ok: true;
  requestId: string;
  operationId: string;
  batchId: string;
  results: Array<
    | { rowId: string; ok: true; generatedText: string }
    | { rowId: string; ok: false; code: "INVALID_INPUT" | "INVALID_OUTPUT" | "PROVIDER_DISABLED" | "PROVIDER_CONFIGURATION" | "PROVIDER_RATE_LIMITED" | "PROVIDER_TIMEOUT_UNKNOWN" | "PROVIDER_REFUSED" | "PROVIDER_INCOMPLETE" | "PROVIDER_UNAVAILABLE"; message: string; retryAfterSeconds?: number }
  >;
};

export function toProviderRecordInput(row: BrowserStudentRow): ProviderRecordInput {
  return { rowId: row.rowId, activity: row.activity, strength: row.strength, attitude: row.attitude, observation: row.observation };
}

/** Converts browser number-input values without accepting non-finite or lossy values. */
export function normalizeTargetLength(value: unknown): number | null {
  const targetLength = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(targetLength) && Number.isInteger(targetLength) && targetLength >= MIN_TARGET_LENGTH && targetLength <= MAX_TARGET_LENGTH ? targetLength : null;
}

/** The only browser JSON payload shape used for both initial generation and retries. */
export function toGenerateBatchRequest(operationId: string, batchId: string, rows: ReadonlyArray<BrowserStudentRow>, options: RecordGenerationOptions): GenerateBatchRequest | null {
  const targetLength = normalizeTargetLength(options.targetLength);
  if (targetLength === null) return null;
  return { operationId, batchId, rows: rows.map(toProviderRecordInput), options: { ...options, targetLength } };
}
