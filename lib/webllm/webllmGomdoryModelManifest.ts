import { GOMDORY_WEBLLM_ORIGIN } from "@/lib/webllm/webllmOrigins";

const GOMDORY_ALLOWED_ORIGIN = GOMDORY_WEBLLM_ORIGIN;
export const GOMDORY_WEBLLM_MANIFEST_URL = `${GOMDORY_ALLOWED_ORIGIN}/libs/manifest.v1.json`;
const MAX_SMOKE_PARAMS_B = 3.5;

export type GomdoryWebLLMModelRecord = {
  model_id: string;
  model: string;
  model_lib: string;
  family?: string;
  parameterSizeLabel?: string;
  quantization?: string;
  contextWindow?: number;
  recommendedForSmoke?: boolean;
  disabled?: boolean;
  notes?: string;
  integrity?: string;
};

export type GomdoryWebLLMManifest = {
  manifestVersion: number;
  generatedAt: string;
  models: GomdoryWebLLMModelRecord[];
};

export type GomdoryWebLLMManifestValidationResult = {
  validModels: GomdoryWebLLMModelRecord[];
  rejectedCount: number;
  rejectionReasons: string[];
};

function parseUrl(url: string): URL | null { try { return new URL(url); } catch { return null; } }

function isAllowedGomdoryUrl(url: string): boolean {
  const parsed = parseUrl(url);
  return Boolean(parsed && parsed.protocol === "https:" && parsed.origin === GOMDORY_ALLOWED_ORIGIN);
}

function parseSizeB(record: GomdoryWebLLMModelRecord): number | null {
  const source = `${record.parameterSizeLabel ?? ""} ${record.model_id}`;
  const m = source.match(/(\d+(?:\.\d+)?)\s*b/i);
  return m ? Number(m[1]) : null;
}

function modelLooksSmall(record: GomdoryWebLLMModelRecord): boolean {
  const s = parseSizeB(record);
  return s === null || s <= MAX_SMOKE_PARAMS_B;
}

export function validateGomdoryManifest(manifestLike: unknown): GomdoryWebLLMManifestValidationResult {
  const reasons: string[] = [];
  const validModels: GomdoryWebLLMModelRecord[] = [];
  const manifest = manifestLike as Partial<GomdoryWebLLMManifest>;
  const models = Array.isArray(manifest?.models) ? manifest.models : [];

  for (const recordLike of models) {
    const r = recordLike as Partial<GomdoryWebLLMModelRecord>;
    if (!r.model_id || !r.model || !r.model_lib) { reasons.push("missing-required-fields"); continue; }
    if (r.disabled) { reasons.push("disabled-model"); continue; }
    if (!isAllowedGomdoryUrl(r.model) || !isAllowedGomdoryUrl(r.model_lib)) { reasons.push("origin-not-allowed"); continue; }
    if (!modelLooksSmall(r as GomdoryWebLLMModelRecord)) { reasons.push("too-large-for-smoke"); continue; }
    validModels.push(r as GomdoryWebLLMModelRecord);
  }

  return { validModels, rejectedCount: Math.max(models.length - validModels.length, 0), rejectionReasons: reasons };
}

export function selectGomdorySmokeModel(models: GomdoryWebLLMModelRecord[]): GomdoryWebLLMModelRecord | null {
  const scored = models.map((m) => {
    const size = parseSizeB(m) ?? 9;
    const rec = m.recommendedForSmoke ? -10 : 0;
    const familyHint = /(instruct|chat)/i.test(`${m.family ?? ""} ${m.model_id}`) ? -1 : 0;
    return { m, score: size + rec + familyHint };
  }).sort((a, b) => a.score - b.score);
  return scored[0]?.m ?? null;
}

export function isWebLLMGomdoryModelsEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_WEBLLM_GOMDORY_MODELS_V1;
  return value ? new Set(["1", "true", "enabled"]).has(value.trim().toLowerCase()) : false;
}
