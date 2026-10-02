export type WebLLMPaths = {
  modelId: string;
  fallbackModelId?: string;
  coachModelId?: string;
  modelBase: string;
  libBase: string;
  modelSubdir: string;
  modelUrl: string;
  wasmUrl: string;
  wasmCandidates?: string[];
};

export type WebLLMEnv = {
  modelId: string;
  fallbackModelId?: string;
  coachModelId?: string;
  modelBase: string;
  libBase: string;
  modelSubdir?: string;
  wasmFilenamePrimary?: string;
  wasmFilenameFallback?: string;
  wasmFilenameCoach?: string;
};

const DEFAULT_WASM_FILENAME = "webllm-model.wasm";

type CloudflareEnvLike = Record<string, unknown> & {
  __CLOUDFLARE_ENV__?: Record<string, unknown>;
};

export const REQUIRED_WEBLLM_KEYS = [
  "NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID",
  "NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID",
  "NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID",
  "NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE",
  "NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE",
] as const;

export type WebllmClientEnvSnapshot = {
  key: (typeof REQUIRED_WEBLLM_KEYS)[number];
  isSet: boolean;
  length: number;
  source: "runtime" | "build" | "unset";
};

type WebllmEnvValueSource = "runtime" | "build" | "unset";

export function readWebllmEnvValueWithSource(key: string): { value: string | undefined; source: WebllmEnvValueSource } {
  const runtimeValue = (globalThis as CloudflareEnvLike).__CLOUDFLARE_ENV__?.[key];
  if (typeof runtimeValue === "string") {
    return { value: runtimeValue, source: "runtime" };
  }

  const processValue =
    typeof process !== "undefined" && process.env
      ? process.env[key]
      : undefined;
  if (typeof processValue === "string") {
    return { value: processValue, source: "build" };
  }
  return { value: undefined, source: "unset" };
}

export function getWebllmClientEnvSnapshot(): WebllmClientEnvSnapshot[] {
  return REQUIRED_WEBLLM_KEYS.map((key) => ({
    key,
    isSet: Boolean(readWebllmEnvValue(key)?.trim()),
    length: readWebllmEnvValue(key)?.trim().length ?? 0,
    source: readWebllmEnvValueWithSource(key).source,
  }));
}

export function readWebllmEnvValue(key: string): string | undefined {
  return readWebllmEnvValueWithSource(key).value;
}

export function normalizeWebllmBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeWebllmPathSegment(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

export function buildWebllmWasmUrl(libBase: string, wasmFilename?: string) {
  const normalizedBase = normalizeWebllmBaseUrl(libBase);
  const normalizedFilename = wasmFilename?.trim()
    ? normalizeWebllmPathSegment(wasmFilename)
    : DEFAULT_WASM_FILENAME;
  return `${normalizedBase}/${normalizedFilename}`;
}

export function buildWebllmWasmCandidates(input: {
  libBase: string;
  modelId: string;
  wasmFilename?: string;
}): string[] {
  const normalizedBase = normalizeWebllmBaseUrl(input.libBase);
  const candidates: string[] = [];
  const pushCandidate = (value: string | undefined) => {
    if (!value) return;
    const normalized = normalizeWebllmPathSegment(value);
    if (!normalized) return;
    const url = `${normalizedBase}/${normalized}`;
    if (!candidates.includes(url)) {
      candidates.push(url);
    }
  };

  if (input.wasmFilename?.trim()) {
    pushCandidate(input.wasmFilename);
  }
  pushCandidate(`${input.modelId}/${input.modelId}.wasm`);
  pushCandidate(DEFAULT_WASM_FILENAME);

  return candidates;
}

export function buildWebllmPaths(input: {
  modelId: string;
  modelBase: string;
  libBase: string;
  modelSubdir?: string;
  fallbackModelId?: string;
  coachModelId?: string;
  wasmFilename?: string;
}): WebLLMPaths {
  const modelBase = normalizeWebllmBaseUrl(input.modelBase);
  const libBase = normalizeWebllmBaseUrl(input.libBase);
  const modelSubdir = (input.modelSubdir ?? "resolve/main")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  const modelUrl = modelSubdir
    ? `${modelBase}/${input.modelId}/${modelSubdir}/`
    : `${modelBase}/${input.modelId}/`;
  const wasmCandidates = buildWebllmWasmCandidates({
    libBase,
    modelId: input.modelId,
    wasmFilename: input.wasmFilename,
  });
  const wasmUrl = wasmCandidates[0] ?? buildWebllmWasmUrl(libBase, input.wasmFilename);

  return {
    modelId: input.modelId,
    fallbackModelId: input.fallbackModelId,
    coachModelId: input.coachModelId,
    modelBase,
    libBase,
    modelSubdir,
    modelUrl,
    wasmUrl,
    wasmCandidates,
  };
}

export function readWebllmEnv(): WebLLMEnv {
  return {
    modelId: readWebllmEnvValue("NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID") ?? "",
    fallbackModelId: readWebllmEnvValue("NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID") ?? "",
    coachModelId: readWebllmEnvValue("NEXT_PUBLIC_EDU_WEBLLM_COACH_MODEL_ID") ?? "",
    modelBase: readWebllmEnvValue("NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE") ?? "",
    libBase: readWebllmEnvValue("NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE") ?? "",
    modelSubdir: readWebllmEnvValue("NEXT_PUBLIC_EDU_WEBLLM_MODEL_SUBDIR") ?? undefined,
    wasmFilenamePrimary: readWebllmEnvValue("NEXT_PUBLIC_EDU_WEBLLM_WASM_FILENAME_PRIMARY") ?? undefined,
    wasmFilenameFallback: readWebllmEnvValue("NEXT_PUBLIC_EDU_WEBLLM_WASM_FILENAME_FALLBACK") ?? undefined,
    wasmFilenameCoach: readWebllmEnvValue("NEXT_PUBLIC_EDU_WEBLLM_COACH_WASM_FILENAME") ?? undefined,
  };
}

export function getWebllmModelIds() {
  const { modelId, fallbackModelId } = readWebllmEnv();
  return {
    primaryModelId: modelId,
    fallbackModelId: fallbackModelId || undefined,
  };
}

export function getWebllmCoachModelId() {
  const { coachModelId } = readWebllmEnv();
  return coachModelId?.trim() || undefined;
}

export function getWebllmWasmCandidatesForModelId(modelId: string): string[] {
  const env = readWebllmEnv();
  if (!env.libBase) return [];
  return buildWebllmWasmCandidates({
    libBase: env.libBase,
    modelId,
    wasmFilename: resolveWasmFilename(env, modelId),
  });
}

function resolveWasmFilename(env: WebLLMEnv, modelId: string) {
  const primaryWasmFilename = env.wasmFilenamePrimary?.trim() || undefined;
  const fallbackWasmFilename = env.wasmFilenameFallback?.trim() || undefined;
  const coachWasmFilename = env.wasmFilenameCoach?.trim() || undefined;
  if (env.coachModelId && modelId === env.coachModelId) {
    return coachWasmFilename ?? primaryWasmFilename;
  }
  if (env.fallbackModelId && modelId === env.fallbackModelId) {
    return fallbackWasmFilename ?? primaryWasmFilename;
  }
  return primaryWasmFilename;
}

function buildPathsFromEnv(env: WebLLMEnv, modelId: string, modelIdLabel: string): WebLLMPaths {
  const missing = [];
  if (!modelId) {
    missing.push(modelIdLabel);
  }
  if (!env.modelBase) missing.push("NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE");
  if (!env.libBase) missing.push("NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE");

  if (missing.length > 0) {
    const error = new Error("로컬 모델 환경 변수가 비어 있어요. 운영 설정을 확인해 주세요.");
    (error as Error & { code?: string }).code = "EDU_WEBLLM_ENV_MISSING";
    (error as Error & { missing?: string[] }).missing = missing;
    throw error;
  }

  const wasmFilename = resolveWasmFilename(env, modelId);

  return buildWebllmPaths({
    modelId,
    fallbackModelId: env.fallbackModelId || undefined,
    coachModelId: env.coachModelId || undefined,
    modelBase: env.modelBase,
    libBase: env.libBase,
    modelSubdir: env.modelSubdir,
    wasmFilename,
  });
}

export function getWebllmPaths(): WebLLMPaths {
  const env = readWebllmEnv();
  return buildPathsFromEnv(env, env.modelId, "NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID");
}

export function getWebllmPathsForModelId(modelId: string): WebLLMPaths {
  const env = readWebllmEnv();
  return buildPathsFromEnv(
    env,
    modelId,
    env.fallbackModelId && modelId === env.fallbackModelId
      ? "NEXT_PUBLIC_EDU_WEBLLM_FALLBACK_MODEL_ID"
      : "NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID",
  );
}

export function getWebllmCoachPaths(): WebLLMPaths | null {
  const env = readWebllmEnv();
  if (!env.coachModelId) return null;
  return buildWebllmPaths({
    modelId: env.coachModelId,
    fallbackModelId: env.fallbackModelId || undefined,
    coachModelId: env.coachModelId,
    modelBase: env.modelBase,
    libBase: env.libBase,
    modelSubdir: env.modelSubdir,
    wasmFilename: env.wasmFilenameCoach,
  });
}
