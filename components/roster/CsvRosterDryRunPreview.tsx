"use client";

import { useEffect, useMemo, useState } from "react";

import { parseCsvRosterDryRun, type CsvRosterDryRunResult } from "@/lib/roster/csvRosterParser";
import { buildPrivacySafeRosterCsvTemplate } from "@/lib/roster/csvRosterTemplate";

export const PRIVACY_SAFE_EXAMPLE_CSV = buildPrivacySafeRosterCsvTemplate();
const MAX_LOCAL_CSV_BYTES = 512 * 1024;

type CsvRosterDryRunPreviewProps = {
  initialCsvText?: string;
  maxPreviewRows?: number;
  onDryRunResult?: (result: CsvRosterDryRunResult) => void;
  readOnly?: boolean;
  enableServerDryRun?: boolean;
  serverDryRunEndpoint?: string;
};

const SAFE_COLUMNS: Array<keyof CsvRosterDryRunResult["rows"][number]> = ["class_name", "role", "display_label", "external_id", "email"];

function issueCodes(issues: CsvRosterDryRunResult["errors"]) {
  return Array.from(new Set(issues.map((issue) => issue.code))).sort();
}

export function CsvRosterDryRunPreview({
  initialCsvText = "",
  maxPreviewRows = 20,
  onDryRunResult,
  readOnly = false,
  enableServerDryRun = false,
  serverDryRunEndpoint = "/api/v1/dashboard/roster/csv-dry-run",
}: CsvRosterDryRunPreviewProps) {
  const [csvText, setCsvText] = useState(initialCsvText);
  const [evaluatedCsvText, setEvaluatedCsvText] = useState(initialCsvText);
  const [isServerLoading, setIsServerLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<CsvRosterDryRunResult | null>(null);

  const result = useMemo(() => parseCsvRosterDryRun(evaluatedCsvText), [evaluatedCsvText]);

  useEffect(() => {
    onDryRunResult?.(result);
  }, [onDryRunResult, result]);

  const previewRows = result.rows.slice(0, maxPreviewRows);
  const hiddenRowCount = Math.max(0, result.rows.length - previewRows.length);
  const issues = [...result.errors, ...result.warnings];

  const comparison = useMemo(() => {
    if (!serverResult) return null;
    const diff: string[] = [];
    if (result.ok !== serverResult.ok) diff.push("검증 성공 여부가 다릅니다");
    if (result.summary.acceptedRows !== serverResult.summary.acceptedRows) diff.push("유효 행 수가 다릅니다");
    if (result.summary.warningCount !== serverResult.summary.warningCount) diff.push("경고 수가 다릅니다");
    if (issueCodes(result.errors).join(",") !== issueCodes(serverResult.errors).join(",")) diff.push("오류 코드가 다릅니다");

    const fullyMatched =
      result.summary.totalRows === serverResult.summary.totalRows &&
      result.summary.acceptedRows === serverResult.summary.acceptedRows &&
      result.summary.rejectedRows === serverResult.summary.rejectedRows &&
      result.summary.warningCount === serverResult.summary.warningCount &&
      result.summary.classCount === serverResult.summary.classCount &&
      result.summary.teacherCount === serverResult.summary.teacherCount &&
      result.summary.studentCount === serverResult.summary.studentCount &&
      issueCodes(result.errors).join(",") === issueCodes(serverResult.errors).join(",") &&
      issueCodes(result.warnings).join(",") === issueCodes(serverResult.warnings).join(",") &&
      (result.errors.find((issue) => issue.code === "sensitive_column_detected")?.columns ?? []).join(",") ===
        (serverResult.errors.find((issue) => issue.code === "sensitive_column_detected")?.columns ?? []).join(",") &&
      result.ok === serverResult.ok;

    return { fullyMatched, diff };
  }, [result, serverResult]);

  async function handleServerValidation() {
    setIsServerLoading(true);
    setServerError(null);
    setServerResult(null);
    try {
      const response = await fetch(serverDryRunEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csvText: evaluatedCsvText }),
      });
      const payload = (await response.json()) as { result?: CsvRosterDryRunResult; error?: { code?: string; message?: string } };
      if (!response.ok) {
        if (payload.error?.code === "feature_disabled") {
          throw new Error("서버 검증 API가 비활성화되어 있어요.");
        }
        if (payload.error?.code === "unauthorized") {
          throw new Error("로그인이 만료되었어요. 다시 로그인 후 시도해주세요.");
        }
        if (payload.error?.code === "csv_too_large") {
          throw new Error("CSV 내용이 너무 커서 서버 검증을 진행할 수 없어요.");
        }
        throw new Error(payload.error?.message || "서버 검증 중 오류가 발생했어요.");
      }
      if (!payload.result) throw new Error("서버 검증 응답이 올바르지 않아요.");
      setServerResult(payload.result);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "서버 검증 중 오류가 발생했어요.");
    } finally {
      setIsServerLoading(false);
    }
  }

  async function handleLoadSelectedFile() {
    if (!selectedFile) return;
    setFileLoadError(null);

    const csvLikeMime = selectedFile.type === "text/csv" || selectedFile.type === "application/csv" || selectedFile.type === "text/plain";
    const csvLikeName = selectedFile.name.toLowerCase().endsWith(".csv");
    if (!csvLikeMime && !csvLikeName) {
      setFileLoadError("CSV 파일만 선택할 수 있어요.");
      return;
    }
    if (selectedFile.size > MAX_LOCAL_CSV_BYTES) {
      setFileLoadError("CSV 파일이 너무 큽니다.");
      return;
    }

    try {
      const text = await selectedFile.text();
      const normalizedText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
      setCsvText(normalizedText);
      setEvaluatedCsvText(normalizedText);
      setServerResult(null);
      setServerError(null);
    } catch {
      setFileLoadError("CSV 파일을 읽지 못했어요.");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">CSV 내용</h2>
        <p className="text-sm text-slate-600">아직 저장되지 않습니다. 개인정보 컬럼을 검사하고 미리보기만 보여줍니다.</p>
      </div>

      <textarea aria-label="CSV 내용" value={csvText} onChange={(event) => setCsvText(event.target.value)} readOnly={readOnly} rows={8} className="w-full rounded-md border border-slate-300 p-3 text-sm" />

      <div className="space-y-2 rounded-lg border border-slate-200 p-3">
        <p className="text-sm font-medium">CSV 파일 선택</p>
        <p className="text-xs text-slate-600">파일은 브라우저에서만 읽고, 서버에 업로드하지 않습니다.</p>
        <p className="text-xs text-slate-600">선택한 파일은 이 브라우저에서만 열어 미리보기합니다. 아직 로스터 가져오기 기능이 아니며, 데이터는 저장되지 않습니다.</p>
        <input
          aria-label="CSV 파일 선택"
          type="file"
          accept=".csv,text/csv"
          disabled={readOnly}
          onChange={(event) => {
            setFileLoadError(null);
            setSelectedFile(event.target.files?.[0] ?? null);
          }}
          className="w-full text-sm"
        />
        <div className="flex gap-2">
          <button type="button" onClick={handleLoadSelectedFile} disabled={readOnly || !selectedFile} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50">파일 내용 불러오기</button>
          <button type="button" onClick={() => { setSelectedFile(null); setFileLoadError(null); }} disabled={readOnly || !selectedFile} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50">선택한 파일 지우기</button>
        </div>
        {selectedFile ? <p className="text-xs text-slate-600">선택됨: {selectedFile.name}</p> : null}
        {fileLoadError ? <p className="text-sm text-amber-700">{fileLoadError}</p> : null}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setEvaluatedCsvText(csvText)} disabled={readOnly} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">검사하기</button>
        <button type="button" onClick={() => { setCsvText(PRIVACY_SAFE_EXAMPLE_CSV); setEvaluatedCsvText(PRIVACY_SAFE_EXAMPLE_CSV); }} disabled={readOnly} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50">예시 CSV 넣기</button>
        <button type="button" onClick={() => { setCsvText(""); setEvaluatedCsvText(""); setServerResult(null); setServerError(null); }} disabled={readOnly} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50">초기화</button>
      </div>

      {enableServerDryRun ? (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <p className="text-sm text-slate-600">저장하지 않고 서버에서도 같은 규칙으로 검사합니다.</p>
          <button type="button" onClick={handleServerValidation} disabled={readOnly || isServerLoading || !evaluatedCsvText.trim()} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50">{isServerLoading ? "서버 검증 중..." : "서버 검증"}</button>
          {serverError ? <p className="text-sm text-amber-700">{serverError}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">서버 검증 API가 비활성화되어 있어요.</p>
      )}

      {comparison ? (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
          <p className="font-semibold">{comparison.fullyMatched ? "결과 일치" : "결과 차이 있음"}</p>
          <div className="grid grid-cols-2 gap-2">
            <p>로컬 검증: {result.ok ? "성공" : "실패"}</p>
            <p>서버 검증: {serverResult?.ok ? "성공" : "실패"}</p>
          </div>
          {!comparison.fullyMatched && comparison.diff.length > 0 ? <ul className="list-disc pl-5">{comparison.diff.map((item) => <li key={item}>{item}</li>)}</ul> : null}
        </div>
      ) : null}

      <p className={result.ok ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-amber-700"}>{result.ok ? "가져오기 전에 검토할 수 있는 CSV입니다." : "수정이 필요한 항목이 있어요."}</p>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt>전체 행</dt><dd>{result.summary.totalRows}</dd></div><div><dt>유효 행</dt><dd>{result.summary.acceptedRows}</dd></div><div><dt>오류 행</dt><dd>{result.summary.rejectedRows}</dd></div><div><dt>경고 수</dt><dd>{result.summary.warningCount}</dd></div><div><dt>감지된 학급 수</dt><dd>{result.summary.classCount}</dd></div><div><dt>교사 수</dt><dd>{result.summary.teacherCount}</dd></div><div><dt>학생 수</dt><dd>{result.summary.studentCount}</dd></div>
      </dl>

      <div className="space-y-2"><h3 className="text-sm font-semibold">유효 행 미리보기</h3><table className="w-full text-left text-sm"><thead><tr>{SAFE_COLUMNS.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{previewRows.map((row) => <tr key={`${row.rowNumber}-${row.external_id ?? row.display_label}`}>{SAFE_COLUMNS.map((column) => <td key={column}>{row[column] ?? ""}</td>)}</tr>)}</tbody></table>{hiddenRowCount > 0 ? <p className="text-xs text-slate-600">외 {hiddenRowCount}개 행</p> : null}</div>

      <div className="space-y-2"><h3 className="text-sm font-semibold">오류/경고</h3><ul className="space-y-1 text-sm">{issues.map((issue, index) => <li key={`${issue.code}-${issue.rowNumber ?? "na"}-${index}`}><span className="mr-2 rounded border px-1 text-xs">{issue.severity === "error" ? "오류" : "경고"}</span>행 {issue.rowNumber ?? "-"} · {issue.messageKo}{issue.field ? ` · ${issue.field}` : ""} <code className="ml-1 text-xs">{issue.code}</code></li>)}{issues.length === 0 ? <li>이슈 없음</li> : null}</ul></div>
    </section>
  );
}

export default CsvRosterDryRunPreview;
