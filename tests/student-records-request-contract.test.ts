import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTargetLength, toGenerateBatchRequest, type BrowserStudentRow } from "@/lib/student-records/contracts";
import { createInvalidRequestDiagnostic } from "@/lib/student-records/invalidRequestDiagnostic";
import { parseGenerateBatchRequest } from "@/lib/student-records/requestContract";

const operationId = "f7e32f31-5d8a-4c4f-b6f1-29c1b42ee801";
const batchId = "f7e32f31-5d8a-4c4f-b6f1-29c1b42ee802";
const rowId = "f7e32f31-5d8a-4c4f-b6f1-29c1b42ee803";
const browserRow: BrowserStudentRow = { rowId, studentNumber: 7, studentName: "홍길동", activity: "토론", strength: "근거 제시", attitude: "성실함", observation: "질문에 답함", generatedText: "생성 결과", teacherMemo: "교사 메모", useInExport: true };
const request = (overrides: Record<string, unknown> = {}) => ({ operationId, batchId, rows: [{ rowId, activity: "토론", strength: "근거 제시", attitude: "성실함", observation: "질문에 답함" }], options: { recordType: "subject-detail", tone: "concise", targetLength: 200 }, ...overrides });

test("student-record request contract accepts UUID IDs, number target length, all enums, and up to five rows", () => {
  assert.equal(parseGenerateBatchRequest(request()).ok, true);
  assert.equal(parseGenerateBatchRequest(request({ rows: Array.from({ length: 5 }, (_, index) => ({ ...request().rows[0], rowId: `f7e32f31-5d8a-4c4f-b6f1-29c1b42ee80${index + 3}` })) })).ok, true);
  for (const recordType of ["subject-detail", "behavior-summary", "autonomous-activity"]) assert.equal(parseGenerateBatchRequest(request({ options: { ...request().options, recordType } })).ok, true);
  for (const tone of ["concise", "growth", "objective"]) assert.equal(parseGenerateBatchRequest(request({ options: { ...request().options, tone } })).ok, true);
});

test("student-record request contract rejects invalid runtime shapes with safe reasons", () => {
  const invalid = (value: unknown) => { const result = parseGenerateBatchRequest(value); assert.equal(result.ok, false); return result.ok ? "" : result.safeReason; };
  assert.equal(invalid({}), "operation-id-invalid");
  assert.equal(invalid(request({ operationId: "operation-123" })), "operation-id-invalid");
  assert.equal(invalid(request({ batchId: "batch-123" })), "batch-id-invalid");
  assert.equal(invalid(request({ rows: undefined })), "rows-not-array");
  assert.equal(invalid(request({ rows: Array.from({ length: 6 }, () => request().rows[0]) })), "batch-size-invalid");
  assert.equal(invalid(request({ rows: [{ ...request().rows[0], rowId: "bad" }] })), "row-invalid");
  assert.equal(invalid(request({ rows: [request().rows[0], request().rows[0]] })), "duplicate-row-id");
  assert.equal(invalid(request({ options: undefined })), "options-invalid");
  assert.equal(invalid(request({ options: { ...request().options, recordType: "drift" } })), "record-type-invalid");
  assert.equal(invalid(request({ options: { ...request().options, tone: "drift" } })), "tone-invalid");
  assert.equal(invalid(request({ options: { ...request().options, targetLength: "200" } })), "target-length-type-invalid");
  assert.equal(invalid(request({ options: { ...request().options, targetLength: null } })), "target-length-type-invalid"); // JSON.stringify(NaN) becomes null.
  assert.equal(invalid(request({ options: { ...request().options, targetLength: 20.5 } })), "target-length-range-invalid");
  assert.equal(invalid(request({ options: { ...request().options, targetLength: 501 } })), "target-length-range-invalid");
  assert.equal(invalid([]), "root-not-object");
  assert.throws(() => JSON.parse("{"), SyntaxError);
});

test("browser payload normalizes only finite integer target length and excludes browser-only fields", () => {
  assert.equal(normalizeTargetLength("200"), 200);
  for (const value of ["", "NaN", "Infinity", "200.5", "29", "501"]) assert.equal(normalizeTargetLength(value), null);
  const payload = toGenerateBatchRequest(operationId, batchId, [browserRow], { recordType: "subject-detail", tone: "concise", targetLength: normalizeTargetLength("200") ?? Number.NaN });
  assert.ok(payload);
  assert.equal(typeof payload.options.targetLength, "number");
  assert.deepEqual(Object.keys(payload.rows[0]).sort(), ["activity", "attitude", "observation", "rowId", "strength"]);
  const serialized = JSON.stringify(payload);
  for (const forbidden of ["studentName", "studentNumber", "teacherMemo", "generatedText", "useInExport", "홍길동"]) assert.equal(serialized.includes(forbidden), false);
  assert.equal(toGenerateBatchRequest(operationId, batchId, [browserRow], { recordType: "subject-detail", tone: "concise", targetLength: Number.NaN }), null);
});

test("invalid-request diagnostic records only safe failure metadata", () => {
  const malformed = createInvalidRequestDiagnostic("request-123", "parse", "malformed-json", 27);
  const options = createInvalidRequestDiagnostic("request-123", "parse", "options-invalid", 120, 1);
  assert.equal(malformed.safeReason, "malformed-json");
  assert.equal(options.safeReason, "options-invalid");
  assert.deepEqual(Object.keys(options).sort(), ["bodyByteLength", "event", "requestId", "rowCount", "safeReason", "validationStage"]);
  const serialized = JSON.stringify(options);
  for (const forbidden of ["activity", "strength", "attitude", "observation", "studentName", "studentNumber", operationId, batchId, rowId]) assert.equal(serialized.includes(forbidden), false);
});
