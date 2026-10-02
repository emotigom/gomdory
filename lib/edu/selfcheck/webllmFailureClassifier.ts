export type SelfcheckFailureReason = "env_missing" | "auth_error" | "fetch_blocked" | "engine_error" | "model_not_ready";

const normalize = (value?: string | null) => (value ?? "").toLowerCase();

export function classifyWebllmFailure(input: {
  detail?: string | null;
  resultReason?: string | null;
  progressMessage?: string | null;
  healthMissingKeys?: string[];
}): SelfcheckFailureReason {
  const detail = normalize(input.detail);
  const resultReason = normalize(input.resultReason);
  const progress = normalize(input.progressMessage);
  const healthMissingKeys = input.healthMissingKeys ?? [];

  if (/401|unauthorized|auth/.test(detail)) {
    return "auth_error";
  }

  if (/cors|forbidden|blocked|network/.test(detail)) {
    return "fetch_blocked";
  }

  const modelPreparing = /다운로드|준비|거의|모델/.test(progress);
  if (resultReason === "timeout" || modelPreparing) {
    return "model_not_ready";
  }

  const hasEnvToken = /env_missing|config_missing|edu_webllm_env_missing/.test(detail);
  if (hasEnvToken && healthMissingKeys.length > 0) {
    return "env_missing";
  }

  return "engine_error";
}

export function reasonLabel(reason: SelfcheckFailureReason): string {
  if (reason === "model_not_ready") return "model not ready";
  if (reason === "auth_error") return "auth error";
  if (reason === "env_missing") return "env missing";
  if (reason === "fetch_blocked") return "fetch blocked";
  return "engine error";
}
