import { getEduWebLLMEnableFlag, getWebLLMLabsFlag } from "@/lib/edu/llm/webllmFeatureFlags";

export function isWebLLMEnabled(): boolean {
  return getEduWebLLMEnableFlag();
}

export function isWebLLMLabsEnabled(): boolean {
  return getWebLLMLabsFlag();
}
