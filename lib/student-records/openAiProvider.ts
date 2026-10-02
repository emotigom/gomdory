import "server-only";
import { MAX_BATCH_SIZE, type ProviderGeneratedRecord, type ProviderRecordInput, type RecordGenerationOptions } from "./contracts";
import type { StudentRecordProvider } from "./provider";
import { StudentRecordsProviderError, type StudentRecordsProviderSafeCategory } from "./providerErrors";
import { studentRecordResponseFormat, extractCompletedStructuredText } from "./openAiContracts";
import { STUDENT_RECORDS_DEVELOPER_PROMPT, buildStudentRecordsUserPrompt } from "./prompt";

type Config = { apiKey: string; model: string; timeoutMs: number; maxOutputTokens: number };
export class OpenAiStudentRecordProvider implements StudentRecordProvider {
  constructor(private readonly config: Config) {}
  async generateBatch(input: { requestId: string; batchId: string; rows: ReadonlyArray<ProviderRecordInput>; options: RecordGenerationOptions }): Promise<ReadonlyArray<ProviderGeneratedRecord>> {
    if (input.rows.length < 1 || input.rows.length > MAX_BATCH_SIZE) throw new StudentRecordsProviderError("INVALID_INPUT");
    const startedAt = Date.now();
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      let response: Response;
      try { response = await fetch("https://api.openai.com/v1/responses", { method: "POST", cache: "no-store", signal: controller.signal, headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: this.config.model, store: false, background: false, max_output_tokens: this.config.maxOutputTokens, input: [{ role: "developer", content: STUDENT_RECORDS_DEVELOPER_PROMPT }, { role: "user", content: buildStudentRecordsUserPrompt(input.options, input.rows) }], text: { format: studentRecordResponseFormat } }) }); }
      catch { if (controller.signal.aborted) throw new StudentRecordsProviderError("PROVIDER_TIMEOUT_UNKNOWN"); throw new StudentRecordsProviderError("PROVIDER_UNAVAILABLE"); }
      if (!response.ok) {
        const retry = Math.min(300, Math.max(1, Number.parseInt(response.headers.get("retry-after") ?? "", 10) || 0));
        if (response.status === 429) throw new StudentRecordsProviderError("PROVIDER_RATE_LIMITED", retry || undefined);
        const upstreamError = await readSafeUpstreamError(response);
        const upstreamErrorType = sanitizeUpstreamErrorIdentifier(upstreamError.type);
        const upstreamErrorCode = sanitizeUpstreamErrorIdentifier(upstreamError.code);
        const safeCategory = classifyConfigurationFailure(response.status, upstreamErrorType, upstreamErrorCode);
        if (safeCategory) {
          throw new StudentRecordsProviderError("PROVIDER_CONFIGURATION", undefined, {
            requestId: response.headers.get("x-request-id") ?? input.requestId,
            upstreamStatus: response.status,
            safeCategory,
            safeErrorCode: safeUpstreamErrorCode(upstreamError),
            latency: Math.max(0, Date.now() - startedAt),
            modelId: this.config.model,
          });
        }
        throw new StudentRecordsProviderError("PROVIDER_UNAVAILABLE");
      }
      let raw: unknown; try { raw = await response.json(); } catch { throw new StudentRecordsProviderError("INVALID_OUTPUT"); }
      if (hasRefusal(raw)) throw new StudentRecordsProviderError("PROVIDER_REFUSED");
      const text = extractCompletedStructuredText(raw); if (!text) throw new StudentRecordsProviderError("PROVIDER_INCOMPLETE");
      let parsed: unknown; try { parsed = JSON.parse(text); } catch { throw new StudentRecordsProviderError("INVALID_OUTPUT"); }
      if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Record<string, unknown>).results)) throw new StudentRecordsProviderError("INVALID_OUTPUT");
      const results = (parsed as { results: unknown[] }).results;
      if (!results.length || results.length > 5 || results.some((item) => !item || typeof item !== "object" || typeof (item as Record<string, unknown>).rowId !== "string" || typeof (item as Record<string, unknown>).generatedText !== "string")) throw new StudentRecordsProviderError("INVALID_OUTPUT");
      return results.map((item) => ({ rowId: (item as { rowId: string }).rowId, generatedText: (item as { generatedText: string }).generatedText }));
    } finally { clearTimeout(timer); }
  }
}

type SafeUpstreamError = { type?: string; code?: string };
const SAFE_UPSTREAM_ERROR_IDENTIFIER = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const ALLOWED_ERROR_TYPES = new Set(["invalid_request_error", "authentication_error", "permission_error", "not_found_error"]);
const ALLOWED_ERROR_CODES = new Set(["invalid_api_key", "incorrect_api_key", "model_not_found", "unsupported_model", "project_not_found"]);

async function readSafeUpstreamError(response: Response): Promise<SafeUpstreamError> {
  try {
    const body: unknown = await response.json();
    const error = body && typeof body === "object" && "error" in body ? (body as { error?: unknown }).error : undefined;
    if (!error || typeof error !== "object") return {};
    const value = error as Record<string, unknown>;
    return { type: typeof value.type === "string" ? value.type : undefined, code: typeof value.code === "string" ? value.code : undefined };
  } catch { return {}; }
}

function classifyConfigurationFailure(status: number, type: string, code: string): StudentRecordsProviderSafeCategory | null {
  if (code === "model_not_found" || code === "unsupported_model") return "model-unavailable";
  if (status === 400) return "request-schema-invalid";
  if (status === 401) return "authentication-rejected";
  if (status === 403 && isUnsupportedRegionError(type, code)) return "unsupported-region";
  if (status === 403) return "project-permission-rejected";
  return null;
}

function sanitizeUpstreamErrorIdentifier(value: string | undefined): string {
  return value && SAFE_UPSTREAM_ERROR_IDENTIFIER.test(value) ? value : "unknown";
}

function isUnsupportedRegionError(type: string, code: string): boolean {
  return [type, code].some((value) => value.includes("unsupported") && (value.includes("country") || value.includes("region")));
}

function safeUpstreamErrorCode(error: SafeUpstreamError): string {
  if (error.code && ALLOWED_ERROR_CODES.has(error.code)) return error.code;
  if (error.type && ALLOWED_ERROR_TYPES.has(error.type)) return error.type;
  return "unknown";
}

function hasRefusal(body: unknown): boolean {
  if (!body || typeof body !== "object" || !Array.isArray((body as Record<string, unknown>).output)) return false;
  return (body as { output: unknown[] }).output.some((item) => item && typeof item === "object" && Array.isArray((item as Record<string, unknown>).content) && (item as { content: unknown[] }).content.some((part) => part && typeof part === "object" && (part as Record<string, unknown>).type === "refusal"));
}
