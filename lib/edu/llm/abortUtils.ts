export const MIN_LOCAL_GENERATE_TIMEOUT_MS = 60_000;
const MIN_TIMEOUT_GUARD_MS = 1_000;
const DEFAULT_REMOTE_GENERATE_TIMEOUT_MS = 12_000;

const normalizeTimeoutMs = (value: number, fallbackMs: number) => {
  if (!Number.isFinite(value) || value < MIN_TIMEOUT_GUARD_MS) {
    return fallbackMs;
  }
  return Math.max(MIN_TIMEOUT_GUARD_MS, Math.round(value));
};

export function resolveGenerateJsonTimeoutMs(input: {
  usingLocalWebLLM: boolean;
  localTimeoutMs: number;
  generatorTimeoutMs: number;
}): number {
  if (!input.usingLocalWebLLM) {
    return normalizeTimeoutMs(input.generatorTimeoutMs, DEFAULT_REMOTE_GENERATE_TIMEOUT_MS);
  }
  const localMs = normalizeTimeoutMs(input.localTimeoutMs, MIN_LOCAL_GENERATE_TIMEOUT_MS);
  return Math.max(MIN_LOCAL_GENERATE_TIMEOUT_MS, localMs);
}

export function classifyTemplateAbortUiReason(abortReason: string | null | undefined): "timeout" | "user" {
  return abortReason === "timeout" ? "timeout" : "user";
}
