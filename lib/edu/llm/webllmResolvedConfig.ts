import {
  REQUIRED_WEBLLM_KEYS,
  buildWebllmPaths,
  readWebllmEnv,
  readWebllmEnvValueWithSource,
  type WebLLMEnv,
  type WebLLMPaths,
} from "@/lib/edu/llm/webllmConfig";

export type WebllmResolveSource = "runtime" | "build" | "unset";

export type WebllmResolvedSection = {
  modelId: string;
  paths: WebLLMPaths;
};

export type WebllmResolvedConfig = {
  envSource: WebllmResolveSource;
  missingKeys: (typeof REQUIRED_WEBLLM_KEYS)[number][];
  hardDisable: boolean;
  hardDisableRaw: string | undefined;
  modelBase: string;
  libBase: string;
  primary: WebllmResolvedSection | null;
  fallback: WebllmResolvedSection | null;
  coach: WebllmResolvedSection | null;
};

const truthyHardDisable = new Set(["true", "1", "yes"]);

export function resolveHardDisable(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return truthyHardDisable.has(normalized);
}

function resolveSource(keys: readonly string[]): WebllmResolveSource {
  for (const key of keys) {
    const source = readWebllmEnvValueWithSource(key).source;
    if (source === "runtime") return "runtime";
  }
  for (const key of keys) {
    const source = readWebllmEnvValueWithSource(key).source;
    if (source === "build") return "build";
  }
  return "unset";
}

function toSection(env: WebLLMEnv, modelId: string | undefined): WebllmResolvedSection | null {
  if (!modelId?.trim() || !env.modelBase?.trim() || !env.libBase?.trim()) {
    return null;
  }
  const trimmedModelId = modelId.trim();
  return {
    modelId: trimmedModelId,
    paths: buildWebllmPaths({
      modelId: trimmedModelId,
      fallbackModelId: env.fallbackModelId || undefined,
      coachModelId: env.coachModelId || undefined,
      modelBase: env.modelBase,
      libBase: env.libBase,
      modelSubdir: env.modelSubdir,
      wasmFilename:
        trimmedModelId === env.coachModelId
          ? env.wasmFilenameCoach
          : trimmedModelId === env.fallbackModelId
            ? env.wasmFilenameFallback ?? env.wasmFilenamePrimary
            : env.wasmFilenamePrimary,
    }),
  };
}

export function resolveWebllmConfig(): WebllmResolvedConfig {
  const env = readWebllmEnv();
  const missingKeys = REQUIRED_WEBLLM_KEYS.filter((key) => !readWebllmEnvValueWithSource(key).value?.trim());
  const hardDisableRaw =
    readWebllmEnvValueWithSource("EDU_WEBLLM_HARD_DISABLE").value ??
    readWebllmEnvValueWithSource("NEXT_PUBLIC_EDU_WEBLLM_HARD_DISABLE").value;

  return {
    envSource: resolveSource(["EDU_WEBLLM_HARD_DISABLE", ...REQUIRED_WEBLLM_KEYS]),
    missingKeys,
    hardDisable: resolveHardDisable(hardDisableRaw),
    hardDisableRaw,
    modelBase: env.modelBase,
    libBase: env.libBase,
    primary: toSection(env, env.modelId),
    fallback: toSection(env, env.fallbackModelId),
    coach: toSection(env, env.coachModelId),
  };
}
