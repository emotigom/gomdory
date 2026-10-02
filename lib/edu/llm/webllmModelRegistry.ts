import { GOMDORY_WEBLLM_ORIGIN } from "@/lib/webllm/webllmOrigins";

export const WEBLLM_MODEL_BASE_URL = GOMDORY_WEBLLM_ORIGIN;
export const WEBLLM_MODEL_ASSET_ROOT = "edu-webllm-models";

export const WEBLLM_MODEL_FOLDERS = [
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "Qwen2-1.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
] as const;

export type WebllmKnownModelId = (typeof WEBLLM_MODEL_FOLDERS)[number];
export const WEBLLM_KNOWN_MODEL_IDS: readonly WebllmKnownModelId[] = WEBLLM_MODEL_FOLDERS;

export type WebllmModelPurpose = "general" | "coding";
export type WebllmRuntimeStatus = "ready" | "provisional" | "missing_model_lib";

export type WebllmModelRecord = {
  modelId: WebllmKnownModelId;
  displayName: string;
  family: "llama" | "qwen";
  purpose: WebllmModelPurpose;
  sizeLabel: "0.5B" | "1B" | "1.5B";
  quantization: "q4f16_1";
  artifactPath: string;
  modelLibPath: string | null;
  modelUrl: string;
  modelLibUrl: string | null;
  observedFiles: readonly string[];
  observedModelLib: boolean;
  runtimeStatus: WebllmRuntimeStatus;
  runtimeLoadable: boolean;
  disabledReason: string | null;
  recommendedDefault: boolean;
  classroomSafeNote: string;
  auditWarnings: readonly string[];
};

export function buildWebLLMModelArtifactUrl(modelId: WebllmKnownModelId): string {
  return `${WEBLLM_MODEL_BASE_URL}/${WEBLLM_MODEL_ASSET_ROOT}/${modelId}/resolve/main/`;
}

export function buildWebLLMModelLibUrl(modelId: WebllmKnownModelId): string {
  return `${WEBLLM_MODEL_BASE_URL}/${WEBLLM_MODEL_ASSET_ROOT}/libs/${modelId}/${modelId}.wasm`;
}

const WEBLLM_MODEL_RECORDS: Record<WebllmKnownModelId, WebllmModelRecord> = {
  "Llama-3.2-1B-Instruct-q4f16_1-MLC": {
    modelId: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    displayName: "Llama 3.2 1B Instruct",
    family: "llama",
    purpose: "general",
    sizeLabel: "1B",
    quantization: "q4f16_1",
    artifactPath: "edu-webllm-models/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/",
    modelLibPath:
      "edu-webllm-models/libs/Llama-3.2-1B-Instruct-q4f16_1-MLC/Llama-3.2-1B-Instruct-q4f16_1-MLC.wasm",
    modelUrl: buildWebLLMModelArtifactUrl("Llama-3.2-1B-Instruct-q4f16_1-MLC"),
    modelLibUrl: buildWebLLMModelLibUrl("Llama-3.2-1B-Instruct-q4f16_1-MLC"),
    observedFiles: ["mlc-chat-config.json", "ndarray-cache.json", "params_shard_*.bin"],
    observedModelLib: true,
    runtimeStatus: "provisional",
    runtimeLoadable: true,
    disabledReason: null,
    recommendedDefault: false,
    classroomSafeNote: "Use deterministic_safe fallback when WebGPU/assets are unavailable.",
    auditWarnings: ["Tokenizer file visibility was not confirmed in pasted R2 listing."],
  },
  "Qwen2-1.5B-Instruct-q4f16_1-MLC": {
    modelId: "Qwen2-1.5B-Instruct-q4f16_1-MLC",
    displayName: "Qwen2 1.5B Instruct",
    family: "qwen",
    purpose: "general",
    sizeLabel: "1.5B",
    quantization: "q4f16_1",
    artifactPath: "edu-webllm-models/Qwen2-1.5B-Instruct-q4f16_1-MLC/resolve/main/",
    modelLibPath: null,
    modelUrl: buildWebLLMModelArtifactUrl("Qwen2-1.5B-Instruct-q4f16_1-MLC"),
    modelLibUrl: null,
    observedFiles: ["model artifacts observed in R2 listing"],
    observedModelLib: false,
    runtimeStatus: "missing_model_lib",
    runtimeLoadable: false,
    disabledReason:
      "Observed R2 listing does not include a matching WebGPU wasm model_lib under edu-webllm-models/libs/Qwen2-1.5B-Instruct-q4f16_1-MLC/.",
    recommendedDefault: false,
    classroomSafeNote: "Disabled until matching wasm model_lib is present and audited.",
    auditWarnings: ["Do not invent model_lib path or reuse another model's wasm."],
  },
  "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC": {
    modelId: "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC",
    displayName: "Qwen2.5 Coder 0.5B Instruct",
    family: "qwen",
    purpose: "coding",
    sizeLabel: "0.5B",
    quantization: "q4f16_1",
    artifactPath: "edu-webllm-models/Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC/resolve/main/",
    modelLibPath:
      "edu-webllm-models/libs/Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC/Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC.wasm",
    modelUrl: buildWebLLMModelArtifactUrl("Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC"),
    modelLibUrl: buildWebLLMModelLibUrl("Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC"),
    observedFiles: [
      "mlc-chat-config.json",
      "ndarray-cache.json",
      "tensor-cache.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "vocab.json",
      "merges.txt",
      "params_shard_*.bin",
    ],
    observedModelLib: true,
    runtimeStatus: "ready",
    runtimeLoadable: true,
    disabledReason: null,
    recommendedDefault: true,
    classroomSafeNote: "Current strongest coding candidate from observed asset listing.",
    auditWarnings: [],
  },
  "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC": {
    modelId: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
    displayName: "Qwen2.5 Coder 1.5B Instruct",
    family: "qwen",
    purpose: "coding",
    sizeLabel: "1.5B",
    quantization: "q4f16_1",
    artifactPath: "edu-webllm-models/Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC/resolve/main/",
    modelLibPath:
      "edu-webllm-models/libs/Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC/Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC.wasm",
    modelUrl: buildWebLLMModelArtifactUrl("Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC"),
    modelLibUrl: buildWebLLMModelLibUrl("Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC"),
    observedFiles: ["mlc-chat-config.json", "ndarray-cache.json", "params_shard_*.bin"],
    observedModelLib: true,
    runtimeStatus: "provisional",
    runtimeLoadable: true,
    disabledReason: null,
    recommendedDefault: false,
    classroomSafeNote: "Requires manual tokenizer/headings audit before defaulting.",
    auditWarnings: ["Pasted listing lacked clear heading/tokenizer visibility for this model."],
  },
};

export function resolveWebLLMModelRecord(modelId: string): WebllmModelRecord | null {
  if (!WEBLLM_MODEL_FOLDERS.includes(modelId as WebllmKnownModelId)) {
    return null;
  }
  return WEBLLM_MODEL_RECORDS[modelId as WebllmKnownModelId];
}

export function listWebLLMLoadableModels(): WebllmModelRecord[] {
  return WEBLLM_MODEL_FOLDERS.map((modelId) => WEBLLM_MODEL_RECORDS[modelId]).filter((r) => r.runtimeLoadable);
}

export function listWebLLMProvisionalModels(): WebllmModelRecord[] {
  return WEBLLM_MODEL_FOLDERS.map((modelId) => WEBLLM_MODEL_RECORDS[modelId]).filter((r) => r.runtimeStatus === "provisional");
}

export function listWebLLMDisabledModels(): WebllmModelRecord[] {
  return WEBLLM_MODEL_FOLDERS.map((modelId) => WEBLLM_MODEL_RECORDS[modelId]).filter((r) => !r.runtimeLoadable);
}

export function validateWebLLMModelRegistry(): { records: WebllmModelRecord[]; warnings: string[] } {
  const records = WEBLLM_MODEL_FOLDERS.map((modelId) => WEBLLM_MODEL_RECORDS[modelId]);
  const warnings = records.flatMap((record) => {
    const modelWarnings = [...record.auditWarnings];
    if (record.runtimeStatus === "provisional") {
      modelWarnings.push(`${record.modelId}: runtime status is provisional pending manual audit.`);
    }
    if (!record.runtimeLoadable && record.disabledReason) {
      modelWarnings.push(`${record.modelId}: ${record.disabledReason}`);
    }
    return modelWarnings;
  });
  return { records, warnings };
}
