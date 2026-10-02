import {
  MAX_BATCH_SIZE, MAX_TARGET_LENGTH, MIN_TARGET_LENGTH, RECORD_TONES, RECORD_TYPES,
  type GenerateBatchRequest, type ProviderRecordInput, type RecordGenerationOptions, type RecordTone, type RecordType,
} from "./contracts";
import { validateStudentRecordBatchRows } from "./validation";

export type StudentRecordsInvalidRequestReason =
  | "malformed-json"
  | "root-not-object"
  | "operation-id-invalid"
  | "batch-id-invalid"
  | "rows-not-array"
  | "batch-size-invalid"
  | "row-invalid"
  | "duplicate-row-id"
  | "options-invalid"
  | "record-type-invalid"
  | "tone-invalid"
  | "target-length-type-invalid"
  | "target-length-range-invalid";

export type ParsedGenerateBatchRequest =
  | { ok: true; value: GenerateBatchRequest }
  | { ok: false; safeReason: StudentRecordsInvalidRequestReason; rowCount?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isString(value: unknown): value is string { return typeof value === "string"; }
function isRecordType(value: string): value is RecordType { return (RECORD_TYPES as readonly string[]).includes(value); }
function isRecordTone(value: string): value is RecordTone { return (RECORD_TONES as readonly string[]).includes(value); }

function parseRow(value: unknown): ProviderRecordInput | null {
  if (!isObject(value) || !isString(value.rowId) || !isString(value.activity) || !isString(value.strength) || !isString(value.attitude) || !isString(value.observation)) return null;
  return { rowId: value.rowId, activity: value.activity, strength: value.strength, attitude: value.attitude, observation: value.observation };
}

function parseOptions(value: unknown): { ok: true; value: RecordGenerationOptions } | { ok: false; safeReason: StudentRecordsInvalidRequestReason } {
  if (!isObject(value) || !isString(value.recordType) || !isString(value.tone) || !("targetLength" in value)) return { ok: false, safeReason: "options-invalid" };
  if (!isRecordType(value.recordType)) return { ok: false, safeReason: "record-type-invalid" };
  if (!isRecordTone(value.tone)) return { ok: false, safeReason: "tone-invalid" };
  if (typeof value.targetLength !== "number" || !Number.isFinite(value.targetLength)) return { ok: false, safeReason: "target-length-type-invalid" };
  if (!Number.isInteger(value.targetLength) || value.targetLength < MIN_TARGET_LENGTH || value.targetLength > MAX_TARGET_LENGTH) return { ok: false, safeReason: "target-length-range-invalid" };
  return { ok: true, value: { recordType: value.recordType, tone: value.tone, targetLength: value.targetLength } };
}

export function parseGenerateBatchRequest(value: unknown): ParsedGenerateBatchRequest {
  if (!isObject(value)) return { ok: false, safeReason: "root-not-object" };
  if (!isString(value.operationId) || !UUID.test(value.operationId)) return { ok: false, safeReason: "operation-id-invalid" };
  if (!isString(value.batchId) || !UUID.test(value.batchId)) return { ok: false, safeReason: "batch-id-invalid" };
  if (!Array.isArray(value.rows)) return { ok: false, safeReason: "rows-not-array" };
  const rowCount = value.rows.length;
  if (rowCount < 1 || rowCount > MAX_BATCH_SIZE) return { ok: false, safeReason: "batch-size-invalid", rowCount };
  const rows = value.rows.map(parseRow);
  if (rows.some((row) => row === null)) return { ok: false, safeReason: "row-invalid", rowCount };
  const validRows = rows as ProviderRecordInput[];
  if (new Set(validRows.map((row) => row.rowId)).size !== validRows.length) return { ok: false, safeReason: "duplicate-row-id", rowCount };
  const options = parseOptions(value.options);
  if (!options.ok) return { ok: false, safeReason: options.safeReason, rowCount };
  if (validateStudentRecordBatchRows(validRows).blockingErrors.length) return { ok: false, safeReason: "row-invalid", rowCount };
  return { ok: true, value: { operationId: value.operationId, batchId: value.batchId, rows: validRows, options: options.value } };
}
