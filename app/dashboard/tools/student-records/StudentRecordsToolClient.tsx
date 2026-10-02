"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { StudentInputRow } from "./_components/StudentInputRow";
import { StudentResultRow } from "./_components/StudentResultRow";
import { runBatchesWithConcurrency, splitIntoBatches } from "@/lib/student-records/batchRunner";
import { DEFAULT_STUDENT_COUNT, MAX_BATCH_SIZE, MAX_STUDENT_COUNT, MIN_STUDENT_COUNT, RECORD_TONES, RECORD_TYPES, normalizeTargetLength, toGenerateBatchRequest, type BrowserStudentRow, type GenerateBatchResponse, type RecordGenerationOptions, toProviderRecordInput } from "@/lib/student-records/contracts";
import type { StudentRecordsProviderPublicStatus } from "@/lib/student-records/providerConfig";
import { type SimilaritySnapshot, updateSimilaritySnapshot } from "@/lib/student-records/similarity";
import { isRetryableGenerationCode, isRetryableHttpError, NETWORK_ERROR_MESSAGE, safeGenerationCodeMessage, safeHttpErrorMessage, StudentRecordsHttpError } from "@/lib/student-records/httpErrors";
import { hasExpectedResponseIdentity } from "@/lib/student-records/responseIdentity";
import { clearGeneratedTextForTargetRows } from "@/lib/student-records/resultState";
import { validateStudentCount, validateStudentRecordBatchRows, validateStudentRecordOperationRows } from "@/lib/student-records/validation";
import { api } from "@/lib/standards/routes";

const StudentRecordsXlsxExport = dynamic(() => import("./_components/StudentRecordsXlsxExport").then((module) => module.StudentRecordsXlsxExport), { ssr: false });

type RetryItem = { rowId: string; code: string; attempts: number };
type BatchTarget = { rows: BrowserStudentRow[]; batchId: string };
const hasContent = (row: Pick<BrowserStudentRow, "activity" | "strength" | "attitude" | "observation">) => [row.activity, row.strength, row.attitude, row.observation].some((value) => value.trim());
function newRow(index: number): BrowserStudentRow { return { rowId: crypto.randomUUID(), studentNumber: index + 1, studentName: "", activity: "", strength: "", attitude: "", observation: "", generatedText: "", teacherMemo: "", useInExport: true }; }
function initialRows(count = DEFAULT_STUDENT_COUNT) { return Array.from({ length: count }, (_, index) => newRow(index)); }
function opaqueId() { return crypto.randomUUID(); }
function normalizeStudentName(value: string) { return value.trim().replace(/\s+/g, " "); }
function hasStudentNameInObservation(row: BrowserStudentRow) {
  const studentName = normalizeStudentName(row.studentName);
  return studentName.length >= 2 && [row.activity, row.strength, row.attitude, row.observation].some((value) => value.includes(studentName));
}

type StudentRecordsToolClientProps = { providerStatus: StudentRecordsProviderPublicStatus; generateEndpoint?: string; accessMode?: "authenticated" | "guest"; maxStudentCount?: number; hideStudentName?: boolean };
export default function StudentRecordsToolClient({ providerStatus, generateEndpoint = api.v1("tools", "student-records", "generate"), accessMode = "authenticated", maxStudentCount = MAX_STUDENT_COUNT, hideStudentName = false }: StudentRecordsToolClientProps) {
  const [rows, setRows] = useState<BrowserStudentRow[]>(() => initialRows(Math.min(DEFAULT_STUDENT_COUNT, maxStudentCount)));
  const [requestedCount, setRequestedCount] = useState(Math.min(DEFAULT_STUDENT_COUNT, maxStudentCount));
  const [options, setOptions] = useState<RecordGenerationOptions>({ recordType: "subject-detail", tone: "concise", targetLength: 200 });
  const [targetLengthInput, setTargetLengthInput] = useState("200");
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [batchErrors, setBatchErrors] = useState<Record<string, string>>({});
  const [retryItems, setRetryItems] = useState<Record<string, RetryItem>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [similarities, setSimilarities] = useState<Record<string, number>>({});
  const similarityRef = useRef<SimilaritySnapshot | undefined>(undefined);
  const similarityTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const providerRows = useMemo(() => rows.map(toProviderRecordInput), [rows]);
  const validation = useMemo(() => validateStudentRecordOperationRows(providerRows), [providerRows]);
  const nameWarnings = useMemo(() => hideStudentName ? [] : rows.filter(hasStudentNameInObservation).map((row) => `${row.studentNumber}번 학생 입력 내용에 학생 이름과 같은 표현이 있습니다. AI 요청에는 이름을 직접 넣지 않는 것이 안전합니다.`), [hideStudentName, rows]);
  const generatedTexts = useMemo(() => rows.map((row) => ({ rowId: row.rowId, text: row.generatedText })), [rows]);
  useEffect(() => {
    if (similarityTimerRef.current) clearTimeout(similarityTimerRef.current);
    similarityTimerRef.current = setTimeout(() => { const next = updateSimilaritySnapshot(similarityRef.current, generatedTexts); similarityRef.current = next; setSimilarities({ ...next.maxima }); }, 300);
    return () => { if (similarityTimerRef.current) clearTimeout(similarityTimerRef.current); };
  }, [generatedTexts]);

  const updateRow = useCallback((rowId: string, field: "studentName" | "activity" | "strength" | "attitude" | "observation" | "generatedText" | "teacherMemo" | "useInExport", value: string | boolean) => {
    setRows((current) => current.map((row) => row.rowId === rowId ? { ...row, [field]: value } : row));
  }, []);
  const applyCount = useCallback((next: number) => {
    const safe = Math.max(MIN_STUDENT_COUNT, Math.min(maxStudentCount, Math.round(next) || MIN_STUDENT_COUNT));
    if (safe < rows.length && rows.slice(safe).some((row) => [row.studentName, row.activity, row.strength, row.attitude, row.observation, row.generatedText, row.teacherMemo].some((value) => value.trim())) && !window.confirm("제거되는 행에 입력값이 있습니다. 해당 입력을 삭제하고 인원을 변경할까요?")) return;
    setRows((current) => safe <= current.length ? current.slice(0, safe).map((row, index) => ({ ...row, studentNumber: index + 1 })) : [...current, ...Array.from({ length: safe - current.length }, (_, index) => newRow(current.length + index))]);
    if (safe < rows.length) { const removed = new Set(rows.slice(safe).map((row) => row.rowId)); setRetryItems((current) => Object.fromEntries(Object.entries(current).filter(([rowId]) => !removed.has(rowId)))); setRowErrors((current) => Object.fromEntries(Object.entries(current).filter(([rowId]) => !removed.has(rowId)))); setBatchErrors((current) => Object.fromEntries(Object.entries(current).filter(([rowId]) => !removed.has(rowId)))); }
    setRequestedCount(safe);
  }, [maxStudentCount, rows]);
  const runBatch = useCallback(async ({ rows: batch, batchId }: BatchTarget, operationId: string) => {
    try {
      const requestBody = toGenerateBatchRequest(operationId, batchId, batch, options);
      if (!requestBody) throw new Error(safeHttpErrorMessage(400));
      const response = await fetch(generateEndpoint, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", "x-client-request-id": opaqueId() }, body: JSON.stringify(requestBody) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { code?: unknown } } | null;
        const code = typeof payload?.error?.code === "string" ? payload.error.code : undefined;
        throw new StudentRecordsHttpError(safeHttpErrorMessage(response.status, { accessMode, code }), isRetryableHttpError(response.status));
      }
      const payload = await response.json() as GenerateBatchResponse;
      if (!payload.ok || !hasExpectedResponseIdentity(payload, operationId, batchId)) {
        const message = safeGenerationCodeMessage("INVALID_OUTPUT"); setRowErrors((current) => ({ ...current, ...Object.fromEntries(batch.map((row) => [row.rowId, message])) }));
        setRetryItems((current) => ({ ...current, ...Object.fromEntries(batch.map((row) => [row.rowId, { rowId: row.rowId, code: "INVALID_OUTPUT", attempts: (current[row.rowId]?.attempts ?? 0) + 1 }])) }));
        setBatchErrors((current) => ({ ...current, ...Object.fromEntries(batch.map((row) => [row.rowId, message])) })); return;
      }
      const resultById = new Map(payload.results.map((result) => [result.rowId, result]));
      setRows((current) => current.map((row) => { const result = resultById.get(row.rowId); return result?.ok ? { ...row, generatedText: result.generatedText } : row; }));
      setRowErrors((current) => { const next = { ...current }; for (const row of batch) { const result = resultById.get(row.rowId); if (result?.ok) delete next[row.rowId]; else next[row.rowId] = result && !result.ok ? safeGenerationCodeMessage(result.code) : safeGenerationCodeMessage("INVALID_OUTPUT"); } return next; });
      setRetryItems((current) => { const next = { ...current }; for (const row of batch) { const result = resultById.get(row.rowId); if (result?.ok || !result || !isRetryableGenerationCode(result.code)) delete next[row.rowId]; else next[row.rowId] = { rowId: row.rowId, code: result.code, attempts: (current[row.rowId]?.attempts ?? 0) + 1 }; } return next; });
      setBatchErrors((current) => { const next = { ...current }; for (const row of batch) { const result = resultById.get(row.rowId); if (result?.ok) delete next[row.rowId]; else next[row.rowId] = "일부 학생의 문구를 생성하지 못했습니다."; } return next; });
    } catch (error) {
      const safeMessages = new Set([401, 403, 413, 429, 500].map((status) => safeHttpErrorMessage(status)));
      const message = error instanceof StudentRecordsHttpError ? error.message : error instanceof Error && safeMessages.has(error.message) ? error.message : NETWORK_ERROR_MESSAGE;
      const retryable = !(error instanceof StudentRecordsHttpError) || error.retryable;
      setRowErrors((current) => ({ ...current, ...Object.fromEntries(batch.map((row) => [row.rowId, message])) }));
      setBatchErrors((current) => ({ ...current, ...Object.fromEntries(batch.map((row) => [row.rowId, message])) }));
      setRetryItems((current) => {
        const next = { ...current };
        for (const row of batch) {
          if (retryable) next[row.rowId] = { rowId: row.rowId, code: "REQUEST_FAILED", attempts: (current[row.rowId]?.attempts ?? 0) + 1 };
          else delete next[row.rowId];
        }
        return next;
      });
    } finally { setProgress((current) => ({ ...current, done: current.done + batch.length })); }
  }, [accessMode, generateEndpoint, options]);
  const execute = useCallback(async (targets: BatchTarget[], resetErrors: boolean) => {
    if (runningRef.current || !targets.length) return;
    const targetRowIds = new Set(targets.flatMap((target) => target.rows.map((row) => row.rowId)));
    runningRef.current = true; setRunning(true); setRows((current) => clearGeneratedTextForTargetRows(current, targetRowIds)); if (resetErrors) { setBatchErrors({}); setRetryItems({}); setRowErrors({}); }
    setProgress({ done: 0, total: targets.reduce((total, target) => total + target.rows.length, 0) });
    const operationId = opaqueId();
    try { await runBatchesWithConcurrency(targets, (target) => runBatch(target, operationId), 2); }
    finally { runningRef.current = false; setRunning(false); }
  }, [runBatch]);
  const generate = useCallback(() => {
    if (validation.blockingErrors.length) return;
    const targets = splitIntoBatches(rows.filter(hasContent), MAX_BATCH_SIZE).map((batch) => ({ rows: batch, batchId: opaqueId() }));
    void execute(targets, true);
  }, [execute, rows, validation.blockingErrors.length]);
  const retry = useCallback((rowId: string) => {
    if (runningRef.current || !retryItems[rowId]) return;
    if (retryItems[rowId].code === "PROVIDER_TIMEOUT_UNKNOWN" && !window.confirm("응답을 받지 못했지만 생성이 완료되었을 가능성이 있습니다. 다시 시도하면 추가 사용량이 발생할 수 있습니다. 계속할까요?")) return;
    const latest = rows.find((row) => row.rowId === rowId);
    if (!latest) { setRetryItems((current) => { const next = { ...current }; delete next[rowId]; return next; }); setRowErrors((current) => { const next = { ...current }; delete next[rowId]; return next; }); setBatchErrors((current) => { const next = { ...current }; delete next[rowId]; return next; }); return; }
    if (!hasContent(latest)) { const message = "입력을 작성한 뒤 다시 시도해주세요."; setRowErrors((current) => ({ ...current, [rowId]: message })); return; }
    const invalid = validateStudentRecordBatchRows([toProviderRecordInput(latest)]).blockingErrors;
    if (invalid.length) { setRowErrors((current) => ({ ...current, [rowId]: invalid.join(" ") })); return; }
    const targets = [{ rows: [latest], batchId: opaqueId() }];
    void execute(targets, false);
  }, [execute, retryItems, rows]);
  const countError = requestedCount > maxStudentCount ? `학생 수는 ${maxStudentCount}명 이하로 입력해주세요.` : validateStudentCount(requestedCount);
  const optionsValid = normalizeTargetLength(options.targetLength) !== null;
  const providerReady = providerStatus.availabilityReason === "ready";
  const userAllowed = providerStatus.availabilityReason !== "not-allowed";
  const hasValidRows = providerRows.some(hasContent);
  const hasBlockingErrors = Boolean(validation.blockingErrors.length);
  const isRunning = running;
  const generationEnabled = providerStatus.generationEnabled && providerReady && userAllowed && hasValidRows && !hasBlockingErrors && optionsValid && !isRunning;
  const disabled = isRunning;
  const generationDisabled = !generationEnabled;
  const generationMessage = isRunning ? "문구를 생성하고 있습니다." : providerStatus.availabilityReason === "provider-disabled" ? "현재 AI 문구 생성 기능이 비활성화되어 있습니다." : providerStatus.availabilityReason === "configuration-error" ? "AI 문구 생성 설정을 확인해야 합니다." : providerStatus.availabilityReason === "not-allowed" ? "현재 로그인한 계정은 프리뷰 AI 생성 대상이 아닙니다." : !optionsValid ? "목표 글자 수는 30~500자의 정수로 입력해주세요." : !hasValidRows || hasBlockingErrors ? "입력 내용을 확인해주세요." : "입력 내용을 확인한 뒤 문구를 생성할 수 있습니다.";

  return <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 py-8" data-page-marker="dashboard-student-records-tool">
    <header><h1 className="text-2xl font-bold text-neutral-900">학생 수업 관찰 기록 도우미</h1><p className="mt-2 text-sm text-neutral-600">관찰 내용을 바탕으로 교사가 검토·수정할 기록 문구를 만듭니다.</p><p className="mt-2 text-sm font-medium text-neutral-700">{providerStatus.label}</p></header>
    <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">{accessMode === "guest" ? <><p>링크를 받은 교사용 체험 페이지입니다. 로그인하지 않아도 사용할 수 있습니다. 학생 이름과 개인정보는 입력하지 마세요.</p><p className="mt-1">입력 내용과 생성 결과는 곰도리 DB나 R2에 저장하지 않습니다. 생성된 문구는 반드시 교사가 확인하고 수정해 주세요.</p></> : providerStatus.mode === "openai" ? <><p>학생 이름과 번호는 생성 요청에 포함되지 않습니다. 활동·강점·참여 태도·관찰 메모는 AI 초안 생성을 위해 OpenAI API로 전송됩니다.</p><p className="mt-1">곰도리는 이 입력과 생성 결과를 DB나 R2에 저장하지 않습니다. 실제 개인정보는 입력하지 말고, 생성 문구는 반드시 교사가 최종 검토해야 합니다.</p></> : providerStatus.mode === "mock" ? <p>현재 연습용 문구 생성 모드입니다. 외부 LLM API를 호출하지 않습니다.</p> : <p>현재 AI 문구 생성 기능이 비활성화되어 있습니다. XLSX 내보내기는 계속 사용할 수 있습니다.</p>}</section>
    <section className="rounded-xl border border-neutral-200 bg-white p-4"><div className="flex flex-wrap items-end gap-3"><label className="text-sm font-medium text-neutral-900">학생 수<input aria-label="학생 수" type="number" min={MIN_STUDENT_COUNT} max={maxStudentCount} disabled={disabled} aria-disabled={disabled} value={requestedCount} onChange={(event) => setRequestedCount(Number(event.target.value))} onBlur={() => applyCount(requestedCount)} className="ml-2 w-20 rounded border border-neutral-300 bg-white p-2 text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-700" /></label><button type="button" disabled={disabled} aria-disabled={disabled} onClick={() => applyCount(rows.length - 5)} className="rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 disabled:border-neutral-400 disabled:bg-neutral-100 disabled:text-neutral-700">5명 줄이기</button><button type="button" disabled={disabled} aria-disabled={disabled} onClick={() => applyCount(rows.length + 5)} className="rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900 disabled:border-neutral-400 disabled:bg-neutral-100 disabled:text-neutral-700">5명 늘리기</button>{countError ? <span className="text-sm text-red-700">{countError}</span> : null}</div><div className="mt-4 flex flex-wrap gap-4"><label className="text-sm text-neutral-900">기록 종류<select value={options.recordType} disabled={disabled} aria-disabled={disabled} onChange={(event) => setOptions((current) => ({ ...current, recordType: event.target.value as RecordGenerationOptions["recordType"] }))} className="ml-2 rounded border border-neutral-300 bg-white p-2 text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-700">{RECORD_TYPES.map((value) => <option key={value} value={value}>{value === "subject-detail" ? "교과 세부능력 및 특기사항" : value === "behavior-summary" ? "행동 특성 및 종합 의견" : "자율 활동"}</option>)}</select></label><label className="text-sm text-neutral-900">문체<select value={options.tone} disabled={disabled} aria-disabled={disabled} onChange={(event) => setOptions((current) => ({ ...current, tone: event.target.value as RecordGenerationOptions["tone"] }))} className="ml-2 rounded border border-neutral-300 bg-white p-2 text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-700">{RECORD_TONES.map((value) => <option key={value} value={value}>{value === "concise" ? "간결한 기록체" : value === "growth" ? "성장 중심" : "객관적 서술"}</option>)}</select></label><label className="text-sm text-neutral-900">목표 글자 수<input type="number" min="30" max="500" step="1" value={targetLengthInput} disabled={disabled} aria-disabled={disabled} onChange={(event) => { const raw = event.target.value; setTargetLengthInput(raw); setOptions((current) => ({ ...current, targetLength: normalizeTargetLength(raw) ?? Number.NaN })); }} className="ml-2 w-20 rounded border border-neutral-300 bg-white p-2 text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-700" /></label></div></section>
    <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white"><div className="border-b p-4"><h2 className="font-semibold">학생 입력</h2><p className="mt-1 text-xs text-neutral-500">{hideStudentName ? "학생 이름과 개인정보는 입력하지 마세요. 활동·강점·참여 태도·관찰 메모만 생성 요청에 포함됩니다." : "이름은 화면에서만 사용합니다. 활동·강점·참여 태도·관찰 메모만 생성 요청에 포함됩니다."}</p></div><table className="min-w-[1100px] w-full"><thead className="bg-neutral-50 text-left text-xs text-neutral-600"><tr><th className="p-2">번호</th>{!hideStudentName ? <th className="p-2">이름</th> : null}<th className="p-2">활동</th><th className="p-2">강점</th><th className="p-2">참여 태도</th><th className="p-2">관찰 메모</th></tr></thead><tbody>{rows.map((row) => <StudentInputRow key={row.rowId} row={row} disabled={disabled} onChange={updateRow} hideStudentName={hideStudentName} />)}</tbody></table></section>
    <section className="rounded-xl border border-neutral-200 bg-white p-4"><h2 className="font-semibold text-neutral-900">검증 결과</h2>{validation.blockingErrors.length ? <ul className="mt-2 list-disc pl-5 text-sm text-red-700">{validation.blockingErrors.map((error) => <li key={error}>{error}</li>)}</ul> : <p className="mt-2 text-sm text-emerald-700">생성 가능한 입력입니다.</p>}{[...validation.warnings, ...nameWarnings].length ? <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">{[...validation.warnings, ...nameWarnings].map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}<div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={generate} disabled={generationDisabled} aria-disabled={generationDisabled} className="rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-neutral-300 disabled:text-neutral-700">{running ? "생성 중..." : "문구 생성"}</button><p aria-live="polite" className="text-sm font-medium text-neutral-700">{generationMessage}</p><p aria-live="polite" className="text-sm text-neutral-600">{progress.total ? `${progress.done} / ${progress.total}명 생성 완료` : ""}</p></div>{Object.entries(batchErrors).map(([rowId, message]) => <div key={rowId} className="mt-2 text-sm text-red-700">{message} {retryItems[rowId] ? <button type="button" disabled={disabled} aria-disabled={disabled} onClick={() => retry(rowId)} className="underline disabled:text-neutral-600">다시 시도</button> : null}</div>)}</section>
    <section className="overflow-x-auto rounded-xl border border-neutral-200 bg-white"><div className="border-b p-4"><h2 className="font-semibold">결과 검토</h2><p className="mt-1 text-xs text-neutral-500">생성 문구는 직접 수정할 수 있습니다. 길이 상태는 참고용이며 내보내기 사용 여부를 바꾸지 않습니다. 문구 유사도 참고값 80% 이상은 검토가 필요합니다.</p></div><table className="min-w-[1100px] w-full"><thead className="bg-neutral-50 text-left text-xs text-neutral-600"><tr><th className="p-2">번호</th>{!hideStudentName ? <th className="p-2">이름</th> : null}<th className="p-2">생성 문구</th><th className="p-2">유사도</th><th className="p-2">교사 메모</th><th className="p-2">사용</th></tr></thead><tbody>{rows.map((row) => <StudentResultRow key={row.rowId} row={row} targetLength={normalizeTargetLength(options.targetLength) ?? 200} similarity={similarities[row.rowId] ?? 0} error={rowErrors[row.rowId]} disabled={disabled} onChange={updateRow} hideStudentName={hideStudentName} />)}</tbody></table></section>
    <StudentRecordsXlsxExport rows={rows} options={options} running={running} />
  </main>;
}
