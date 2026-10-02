import { readDecorateDeterministicForced, readOpenAiDirectDisabled, readStudentAiSafeModeEnabled } from "@/lib/env/appConfig";

export function resolveEduAiProviderMode(): "deterministic_safe" | "server_llm" {
  if (readStudentAiSafeModeEnabled() || readDecorateDeterministicForced() || readOpenAiDirectDisabled() || !process.env.OPENAI_API_KEY) return "deterministic_safe";
  return "server_llm";
}
