const ENABLED_FLAG_VALUES = new Set(["1", "true", "enabled"]);

function isExplicitlyEnabled(value: string | undefined): boolean {
  return value ? ENABLED_FLAG_VALUES.has(value.trim().toLowerCase()) : false;
}

export function isWebLLMLabEnabled(): boolean {
  return isExplicitlyEnabled(process.env.NEXT_PUBLIC_WEBLLM_LAB_V1);
}

/**
 * Model smoke must never be considered usable unless the WebLLM lab itself is enabled.
 */
export function isWebLLMModelSmokeEnabled(): boolean {
  return isWebLLMLabEnabled() && isExplicitlyEnabled(process.env.NEXT_PUBLIC_WEBLLM_MODEL_SMOKE_V1);
}

export function isWebLLMGomdoryModelsEnabled(): boolean {
  return isWebLLMModelSmokeEnabled() && isExplicitlyEnabled(process.env.NEXT_PUBLIC_WEBLLM_GOMDORY_MODELS_V1);
}
