import type { GomdoryWebLLMModelRecord } from "@/lib/webllm/webllmGomdoryModelManifest";
import { CANONICAL_BASE_URL } from "@/lib/http/siteConfig";
import { GOMDORY_WEBLLM_ORIGIN } from "@/lib/webllm/webllmOrigins";

export const GOMDORY_ALLOWED_ORIGIN = GOMDORY_WEBLLM_ORIGIN;

export type RequiredArtifact = {
  url: string;
  kind: "json" | "binary" | "wasm";
  required: boolean;
};

export function isAllowedGomdoryOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.origin === GOMDORY_ALLOWED_ORIGIN;
  } catch {
    return false;
  }
}

export function deriveModelArtifactUrls(modelBaseUrl: string, modelLibUrl: string, modelId: string): RequiredArtifact[] {
  const lowered = modelId.toLowerCase();
  const isQwen = lowered.includes("qwen");
  const required: RequiredArtifact[] = [
    { url: `${modelBaseUrl}/mlc-chat-config.json`, kind: "json", required: true },
    { url: `${modelBaseUrl}/ndarray-cache.json`, kind: "json", required: true },
    { url: `${modelBaseUrl}/tokenizer.json`, kind: "json", required: true },
    { url: `${modelBaseUrl}/tokenizer_config.json`, kind: "json", required: true },
    { url: `${modelBaseUrl}/params_shard_0.bin`, kind: "binary", required: true },
    { url: modelLibUrl, kind: "wasm", required: true },
  ];
  if (isQwen) {
    required.push({ url: `${modelBaseUrl}/vocab.json`, kind: "json", required: false });
    required.push({ url: `${modelBaseUrl}/merges.txt`, kind: "binary", required: false });
  }
  return required;
}

export function classifyContentType(contentType: string | null | undefined): "json" | "wasm" | "binary" | "unknown" {
  const normalized = (contentType ?? "").toLowerCase();
  if (normalized.includes("json") || normalized.includes("text/json")) return "json";
  if (normalized.includes("application/wasm")) return "wasm";
  if (normalized.includes("octet-stream") || normalized.includes("application/bin") || normalized.includes("binary")) return "binary";
  return "unknown";
}

export function hasAllowedCors(value: string | null | undefined): boolean {
  if (!value) return false;
  return value === "*" || value === CANONICAL_BASE_URL || value === CANONICAL_BASE_URL.replace("://www.", "://");
}

export function missingRequiredFields(record: Partial<GomdoryWebLLMModelRecord>): string[] {
  const missing: string[] = [];
  if (!record.model_id) missing.push("model_id");
  if (!record.model) missing.push("model");
  if (!record.model_lib) missing.push("model_lib");
  if (!record.parameterSizeLabel) missing.push("parameterSizeLabel");
  if (!record.quantization) missing.push("quantization");
  return missing;
}
