import "server-only";
import { getRuntimeEnv, readEnvStringFrom, type RuntimeEnv } from "@/lib/server/runtimeEnv";

export type StudentRecordsProviderMode = "disabled" | "mock" | "openai";
export type StudentRecordsProviderAvailabilityReason = "ready" | "provider-disabled" | "configuration-error" | "not-allowed";
export type StudentRecordsProviderPublicStatus = {
  mode: StudentRecordsProviderMode;
  generationEnabled: boolean;
  availabilityReason: StudentRecordsProviderAvailabilityReason;
  label: string;
};
export type StudentRecordsProviderConfig = {
  mode: StudentRecordsProviderMode; apiKey?: string; model?: string; timeoutMs: number; maxOutputTokens: number; allowedUserIds: ReadonlySet<string>; configurationError?: boolean;
};
export type StudentRecordsProviderConfigInvalidDiagnostic = {
  event: "student_records_provider_config_invalid";
  providerModeValid: boolean;
  apiKeyPresent: boolean;
  modelPresent: boolean;
  allowlistValid: boolean;
  allowedUserCount: number;
  timeoutValid: boolean;
  maxOutputTokensValid: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 2_000;

function localDevelopment(env: RuntimeEnv) { return readEnvStringFrom(env, "NODE_ENV") === "development" && !readEnvStringFrom(env, "CF_PAGES") && !readEnvStringFrom(env, "VERCEL_ENV"); }
function integerInRange(raw: string | undefined, fallback: number, min: number, max: number) {
  const value = raw ? Number(raw) : fallback;
  return { value: Number.isInteger(value) && value >= min && value <= max ? value : fallback, invalid: Boolean(raw) && (!Number.isInteger(value) || value < min || value > max) };
}
export function parseAllowedUserIds(raw: string | undefined): ReadonlySet<string> {
  return new Set((raw ?? "").split(/[,\r\n]+/).map((value) => value.trim().toLowerCase()).filter((value) => UUID.test(value)));
}
function getOpenAiConfigInputs(env: RuntimeEnv) {
  const timeout = integerInRange(readEnvStringFrom(env, "STUDENT_RECORDS_LLM_TIMEOUT_MS"), DEFAULT_TIMEOUT_MS, 5_000, 30_000);
  const maxOutputTokens = integerInRange(readEnvStringFrom(env, "STUDENT_RECORDS_LLM_MAX_OUTPUT_TOKENS"), DEFAULT_MAX_OUTPUT_TOKENS, 512, 4_000);
  const apiKey = readEnvStringFrom(env, "OPENAI_API_KEY");
  const model = readEnvStringFrom(env, "STUDENT_RECORDS_LLM_MODEL");
  const allowedUserIds = parseAllowedUserIds(readEnvStringFrom(env, "STUDENT_RECORDS_OPENAI_ALLOWED_USER_IDS"));
  return { timeout, maxOutputTokens, apiKey, model, allowedUserIds };
}
export function getStudentRecordsProviderConfig(env: RuntimeEnv = getRuntimeEnv()): StudentRecordsProviderConfig {
  const requested = readEnvStringFrom(env, "STUDENT_RECORDS_PROVIDER");
  const mode: StudentRecordsProviderMode = requested === "disabled" || requested === "mock" || requested === "openai" ? requested : localDevelopment(env) && !requested ? "mock" : "disabled";
  const { timeout, maxOutputTokens, apiKey, model, allowedUserIds } = getOpenAiConfigInputs(env);
  if (mode !== "openai") return { mode, timeoutMs: timeout.value, maxOutputTokens: maxOutputTokens.value, allowedUserIds: new Set() };
  return { mode, apiKey, model, timeoutMs: timeout.value, maxOutputTokens: maxOutputTokens.value, allowedUserIds, configurationError: !apiKey || !model || !allowedUserIds.size || timeout.invalid || maxOutputTokens.invalid };
}
export function getStudentRecordsProviderConfigInvalidDiagnostic(env: RuntimeEnv = getRuntimeEnv()): StudentRecordsProviderConfigInvalidDiagnostic {
  const { timeout, maxOutputTokens, apiKey, model, allowedUserIds } = getOpenAiConfigInputs(env);
  return {
    event: "student_records_provider_config_invalid",
    providerModeValid: readEnvStringFrom(env, "STUDENT_RECORDS_PROVIDER") === "openai",
    apiKeyPresent: Boolean(apiKey),
    modelPresent: Boolean(model),
    allowlistValid: allowedUserIds.size > 0,
    allowedUserCount: allowedUserIds.size,
    timeoutValid: !timeout.invalid,
    maxOutputTokensValid: !maxOutputTokens.invalid,
  };
}
export function getStudentRecordsProviderPublicStatus(config: StudentRecordsProviderConfig, userId?: string): StudentRecordsProviderPublicStatus {
  if (config.mode === "disabled") return { mode: "disabled", generationEnabled: false, availabilityReason: "provider-disabled", label: "AI 문구 생성 · 현재 사용할 수 없음" };
  if (config.mode === "mock") return { mode: "mock", generationEnabled: true, availabilityReason: "ready", label: "AI 문구 생성 · 사용 가능 (연습용)" };
  if (config.configurationError) return { mode: "openai", generationEnabled: false, availabilityReason: "configuration-error", label: "AI 문구 생성 · 설정 확인 필요" };
  if (!userId || !config.allowedUserIds.has(userId.toLowerCase())) return { mode: "openai", generationEnabled: false, availabilityReason: "not-allowed", label: "AI 문구 생성 · 계정 확인 필요" };
  return { mode: "openai", generationEnabled: true, availabilityReason: "ready", label: "AI 문구 생성 · 사용 가능" };
}
