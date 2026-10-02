import type { StudentRecordsInvalidRequestReason } from "./requestContract";

export type StudentRecordsInvalidRequestDiagnostic = {
  event: "student_records_invalid_request";
  requestId: string;
  validationStage: "parse" | "validate";
  safeReason: StudentRecordsInvalidRequestReason;
  rowCount?: number;
  bodyByteLength: number;
};

/** Deliberately contains no request values, IDs, or student text. */
export function createInvalidRequestDiagnostic(requestId: string, validationStage: "parse" | "validate", safeReason: StudentRecordsInvalidRequestReason, bodyByteLength: number, rowCount?: number): StudentRecordsInvalidRequestDiagnostic {
  return { event: "student_records_invalid_request", requestId, validationStage, safeReason, ...(rowCount === undefined ? {} : { rowCount }), bodyByteLength };
}
