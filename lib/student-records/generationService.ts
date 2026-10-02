import "server-only";
import { MAX_GENERATED_TEXT_LENGTH, type GenerateBatchRequest, type GenerateBatchResponse } from "./contracts";
import type { StudentRecordProvider } from "./provider";
import { safeProviderErrorMessage, StudentRecordsProviderError, type StudentRecordsProviderErrorCode } from "./providerErrors";

export async function generateStudentRecordBatch(input: GenerateBatchRequest, requestId: string, provider: StudentRecordProvider): Promise<Omit<GenerateBatchResponse, "ok" | "requestId">> {
  try {
    const generated = await provider.generateBatch({ requestId, batchId: input.batchId, rows: input.rows, options: input.options });
    const expected = new Set(input.rows.map((row) => row.rowId));
    const counts = new Map<string, number>();
    for (const item of generated) if (expected.has(item.rowId)) counts.set(item.rowId, (counts.get(item.rowId) ?? 0) + 1);
    const byRowId = new Map(generated.filter((item) => expected.has(item.rowId)).map((item) => [item.rowId, item]));
    return {
      operationId: input.operationId,
      batchId: input.batchId,
      results: input.rows.map((row) => {
        const item = byRowId.get(row.rowId);
        const valid = counts.get(row.rowId) === 1 && item && typeof item.generatedText === "string" && item.generatedText.trim().length > 0 && item.generatedText.length <= MAX_GENERATED_TEXT_LENGTH;
        return valid ? { rowId: row.rowId, ok: true as const, generatedText: item.generatedText.trim() } : { rowId: row.rowId, ok: false as const, code: "INVALID_OUTPUT" as const, message: "생성 결과를 확인하지 못했습니다." };
      }),
    };
  } catch (error) {
    const code: StudentRecordsProviderErrorCode = error instanceof StudentRecordsProviderError ? error.code : "PROVIDER_UNAVAILABLE";
    const retryAfterSeconds = error instanceof StudentRecordsProviderError ? error.retryAfterSeconds : undefined;
    if (code === "PROVIDER_CONFIGURATION") {
      const diagnostic = error instanceof StudentRecordsProviderError ? error.diagnostic : undefined;
      const failureDiagnostic = {
        requestId: diagnostic?.requestId ?? requestId,
        upstreamStatus: diagnostic?.upstreamStatus,
        safeCategory: diagnostic?.safeCategory ?? "unknown-configuration",
        safeErrorCode: diagnostic?.safeErrorCode ?? "missing-runtime-config",
        latency: diagnostic?.latency ?? 0,
      };
      console.warn("student_records_provider_failure", failureDiagnostic);
    }
    return { operationId: input.operationId, batchId: input.batchId, results: input.rows.map((row) => ({ rowId: row.rowId, ok: false as const, code, message: safeProviderErrorMessage(code), ...(retryAfterSeconds ? { retryAfterSeconds } : {}) })) };
  }
}
