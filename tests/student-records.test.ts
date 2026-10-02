import assert from "node:assert/strict";
import test from "node:test";

import { toProviderRecordInput, type BrowserStudentRow, type ProviderRecordInput } from "@/lib/student-records/contracts";
import { countCharacters, targetLengthRange, targetLengthStatus, utf8ByteLength } from "@/lib/student-records/metrics";
import { maximumSimilarity, similarityPercent } from "@/lib/student-records/similarity";
import { MockStudentRecordProvider } from "@/lib/student-records/mockProvider";
import { generateStudentRecordBatch } from "@/lib/student-records/generationService";
import { runBatchesWithConcurrency, splitIntoBatches } from "@/lib/student-records/batchRunner";
import { clearGeneratedTextForTargetRows } from "@/lib/student-records/resultState";
import { validateStudentRecordBatchRows, validateStudentRecordOperationRows, validateStudentCount } from "@/lib/student-records/validation";

const row: BrowserStudentRow = { rowId: "f7e32f31-5d8a-4c4f-b6f1-29c1b42ee801", studentNumber: 1, studentName: "홍길동", activity: "토론", strength: "근거 제시", attitude: "성실한", observation: "질문에 답함", generatedText: "", teacherMemo: "", useInExport: true };
const providerRow = (overrides: Partial<ProviderRecordInput> = {}): ProviderRecordInput => ({ ...toProviderRecordInput(row), ...overrides });

test("clears generated text only for targeted rows while preserving row fields and input", () => {
  const first = { ...row, generatedText: "이전 문구", teacherMemo: "메모", useInExport: false };
  const second = { ...row, rowId: "f7e32f31-5d8a-4c4f-b6f1-29c1b42ee802", studentNumber: 2, generatedText: "유지할 문구" };
  const rows = [first, second];

  const cleared = clearGeneratedTextForTargetRows(rows, new Set([first.rowId]));

  assert.equal(cleared[0].generatedText, "");
  assert.equal(cleared[1].generatedText, second.generatedText);
  assert.deepEqual({ ...cleared[0], generatedText: first.generatedText }, first);
  assert.deepEqual(cleared[1], second);
  assert.equal(rows[0].generatedText, first.generatedText);
});

test("clears multiple known targets, ignores unknown ids, and preserves all rows for empty targets", () => {
  const rows = [
    { ...row, generatedText: "A" },
    { ...row, rowId: "f7e32f31-5d8a-4c4f-b6f1-29c1b42ee802", generatedText: "B" },
    { ...row, rowId: "f7e32f31-5d8a-4c4f-b6f1-29c1b42ee803", generatedText: "C" },
  ];

  assert.deepEqual(clearGeneratedTextForTargetRows(rows, new Set([rows[0].rowId, rows[2].rowId, "missing"])).map((item) => item.generatedText), ["", "B", ""]);
  assert.deepEqual(clearGeneratedTextForTargetRows(rows, new Set()).map((item) => item.generatedText), ["A", "B", "C"]);
});

test("student record mapping excludes browser-only PII and review fields", () => {
  const mapped = toProviderRecordInput(row);
  assert.deepEqual(Object.keys(mapped).sort(), ["activity", "attitude", "observation", "rowId", "strength"]);
  assert.equal("studentName" in mapped, false);
  assert.equal("studentNumber" in mapped, false);
  assert.equal("teacherMemo" in mapped, false);
});

test("student record validation enforces bounds, empty data, and PII patterns", () => {
  assert.equal(validateStudentCount(1), null); assert.equal(validateStudentCount(200), null); assert.ok(validateStudentCount(0));
  assert.ok(validateStudentRecordBatchRows(Array.from({ length: 6 }, () => providerRow())).blockingErrors.length);
  assert.ok(validateStudentRecordBatchRows([providerRow({ activity: "", strength: "", attitude: "", observation: "" })]).blockingErrors.length);
  assert.ok(validateStudentRecordBatchRows([providerRow({ observation: "가".repeat(301) })]).blockingErrors.length);
  assert.ok(validateStudentRecordBatchRows([providerRow({ activity: "a@b.co" })]).blockingErrors.length);
  assert.ok(validateStudentRecordBatchRows([providerRow({ activity: "010-1234-5678" })]).blockingErrors.length);
  assert.ok(validateStudentRecordBatchRows([providerRow({ activity: "900101-1234567" })]).blockingErrors.length);
  for (const ordinaryKoreanWord of ["챗봇", "집중", "좋음", "토론", "성실함", "발표함", "질문에 답함", "홍길동"]) {
    assert.equal(validateStudentRecordBatchRows([providerRow({ activity: ordinaryKoreanWord })]).warnings.length, 0);
  }
  assert.ok(validateStudentRecordBatchRows([providerRow(), providerRow({ rowId: "f7e32f31-5d8a-4c4f-b6f1-29c1b42ee802" })]).warnings.some((warning) => warning.includes("모든 학생")));
  const operationRows = Array.from({ length: 200 }, (_, index) => providerRow({ rowId: `row-id-${String(index).padStart(8, "0")}`, activity: index === 0 ? "토론" : "" }));
  assert.equal(validateStudentRecordOperationRows(operationRows).blockingErrors.length, 0);
  assert.ok(validateStudentRecordOperationRows(operationRows.map((item) => ({ ...item, activity: "", strength: "", attitude: "", observation: "" }))).blockingErrors.length);
});

test("operation and batch validation use distinct 200 and 5 row limits", () => {
  const makeRows = (count: number) => Array.from({ length: count }, (_, index) => providerRow({ rowId: `row-id-${String(index).padStart(8, "0")}`, activity: `활동 ${index}` }));
  assert.equal(validateStudentRecordOperationRows(makeRows(25)).blockingErrors.length, 0);
  assert.equal(validateStudentRecordOperationRows(makeRows(200)).blockingErrors.length, 0);
  assert.ok(validateStudentRecordOperationRows(makeRows(201)).blockingErrors.length);
  assert.equal(validateStudentRecordBatchRows(makeRows(5)).blockingErrors.length, 0);
  assert.ok(validateStudentRecordBatchRows(makeRows(6)).blockingErrors.length);
});

test("record metrics use code points and UTF-8 bytes", () => {
  assert.equal(countCharacters("가a🙂"), 3);
  assert.equal(utf8ByteLength("가a🙂"), 8);
});

test("target length status uses the inclusive 80% to 110% teacher target range", () => {
  assert.deepEqual(targetLengthRange(200), { min: 160, max: 220 });
  assert.equal(targetLengthStatus("가".repeat(159), 200), "short");
  assert.equal(targetLengthStatus("가".repeat(160), 200), "appropriate");
  assert.equal(targetLengthStatus("가".repeat(220), 200), "appropriate");
  assert.equal(targetLengthStatus("가".repeat(221), 200), "long");
});

test("similarity excludes empty values and supports review threshold", () => {
  assert.equal(similarityPercent("동일 문구", "동일 문구"), 100);
  assert.equal(similarityPercent("abc", "가나다"), 0);
  assert.equal(maximumSimilarity("", ["anything"]), 0);
  assert.ok(maximumSimilarity("동일 문구", ["", "동일 문구"]) >= 80);
});

test("mock provider is deterministic, two-sentence, and never outputs browser identity", async () => {
  const provider = new MockStudentRecordProvider();
  const input = { requestId: "request-123", batchId: "batch-123", rows: [providerRow()], options: { recordType: "subject-detail" as const, tone: "concise" as const, targetLength: 200 } };
  const [first] = await provider.generateBatch(input);
  const [second] = await provider.generateBatch(input);
  assert.equal(first.generatedText, second.generatedText);
  assert.equal(first.generatedText.split(/[.!?]+/).filter(Boolean).length, 2);
  assert.equal(first.generatedText.includes(row.studentName), false);
  assert.equal(first.generatedText.includes(String(row.studentNumber)), false);
  const [{ generatedText: shortText }] = await provider.generateBatch({ ...input, options: { ...input.options, targetLength: 80 } });
  assert.notEqual(shortText, first.generatedText);
  assert.ok(first.generatedText.length > shortText.length);
});

test("mock provider has short, medium, and long detail without placeholders or markup", async () => {
  const provider = new MockStudentRecordProvider();
  const base = { requestId: "request-123", batchId: "batch-123", rows: [providerRow()], options: { recordType: "subject-detail" as const, tone: "concise" as const, targetLength: 80 } };
  const [short] = await provider.generateBatch(base);
  const [medium] = await provider.generateBatch({ ...base, options: { ...base.options, targetLength: 200 } });
  const [long] = await provider.generateBatch({ ...base, options: { ...base.options, targetLength: 500 } });
  assert.notEqual(short.generatedText, medium.generatedText); assert.notEqual(medium.generatedText, long.generatedText);
  assert.ok(long.generatedText.length > medium.generatedText.length);
  for (const output of [short, medium, long]) { assert.doesNotMatch(output.generatedText, /을\(를\)|이\(가\)|은\(는\)|```|\{\s*"/); assert.equal(output.generatedText.includes(row.rowId), false); }
});

test("generation service maps provider output by rowId and isolates malformed rows", async () => {
  const second = providerRow({ rowId: "f7e32f31-5d8a-4c4f-b6f1-29c1b42ee802" });
  const input = { operationId: "operation-123", batchId: "batch-123", rows: [providerRow(), second], options: { recordType: "subject-detail" as const, tone: "concise" as const, targetLength: 200 } };
  const result = await generateStudentRecordBatch(input, "request-123", { async generateBatch() { return [{ rowId: input.rows[0].rowId, generatedText: "정상 문구." }, { rowId: input.rows[0].rowId, generatedText: "중복 문구." }, { rowId: "unexpected-row", generatedText: "노출 금지" }]; } });
  assert.deepEqual(result.results.map((item) => [item.rowId, item.ok]), [[input.rows[0].rowId, false], [second.rowId, false]]);
});

test("generation service accepts a short nonempty draft without an automatic repair request", async () => {
  let calls = 0;
  const input = { operationId: "operation-123", batchId: "batch-123", rows: [providerRow()], options: { recordType: "subject-detail" as const, tone: "concise" as const, targetLength: 200 } };
  const result = await generateStudentRecordBatch(input, "request-123", { async generateBatch() { calls += 1; return [{ rowId: input.rows[0].rowId, generatedText: "짧은 초안." }]; } });
  assert.equal(calls, 1);
  assert.equal(result.results[0].ok, true);
});

test("batch runner limits concurrent work", async () => {
  let active = 0; let maximum = 0;
  await runBatchesWithConcurrency([1, 2, 3, 4, 5], async () => { active += 1; maximum = Math.max(maximum, active); await new Promise((resolve) => setTimeout(resolve, 2)); active -= 1; }, 2);
  assert.equal(maximum, 2);
});

test("student-record batches preserve order and unique request identities at 1/5/25/26/200 rows", () => {
  for (const count of [1, 5, 25, 26, 200]) {
    const rows = Array.from({ length: count }, (_, index) => ({ rowId: `row-${index}`, sequence: index }));
    const batches = splitIntoBatches(rows, 5);
    assert.equal(batches.flat().length, count);
    assert.deepEqual(batches.flat().map((item) => item.sequence), rows.map((item) => item.sequence));
    assert.ok(batches.every((batch) => batch.length <= 5));
    assert.equal(new Set(batches.flat().map((item) => item.rowId)).size, count);
    assert.equal(new Set(batches.map((_, index) => `batch-${index}`)).size, batches.length);
  }
});
