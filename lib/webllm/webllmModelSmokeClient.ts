"use client";

import type { ModelRecord } from "@mlc-ai/web-llm";

import { isWebLLMGomdoryModelsEnabled } from "./webllmFlags";
import { GOMDORY_WEBLLM_MANIFEST_URL, selectGomdorySmokeModel, validateGomdoryManifest } from "./webllmGomdoryModelManifest";
import type { WebLLMModelSmokeProgress, WebLLMModelSmokeResult, WebLLMModelSmokeStage } from "./webllmModelSmokeTypes";

export const FIXED_KOREAN_SMOKE_PROMPT =
  "다음 문장을 한 문장으로 아주 짧게 바꿔주세요: 인공지능은 사람이 만든 데이터를 바탕으로 글, 그림, 소리, 코드를 만들 수 있습니다.";

function now() { return performance.now(); }
const MAX_SAFE_BILLION_PARAMS = 3.5;
function parseSizeHintInBillions(id: string): number | null { const m = id.match(/(?:^|[^\d])(\d+(?:\.\d+)?)\s*b(?:[^a-z]|$)/i); return m ? Number(m[1]) : null; }
function scoreModelCandidate(id: string): number | null { if (!/(instruct|chat)/i.test(id)) return null; const s = parseSizeHintInBillions(id); if (s !== null && s > MAX_SAFE_BILLION_PARAMS) return null; const p = /(7b|8b|9b|1\d+b|70b|mixtral|llama-?3.*8b)/i.test(id) ? 100 : 0; return (s ?? 9) + p; }
export function selectSmallModel(modelList: Array<{ model_id?: string }>): string | null { return modelList.map((m) => m.model_id).filter((v): v is string => Boolean(v)).map((id) => ({ id, score: scoreModelCandidate(id) })).filter((e): e is { id: string; score: number } => e.score !== null).sort((a, b) => a.score - b.score)[0]?.id ?? null; }
export function getSmokeStageLabel(stage: WebLLMModelSmokeStage): string { return { idle: "대기 중", "loading-package": "패키지 불러오는 중", "selecting-model": "모델 후보 선택 중", "loading-model": "모델 다운로드/초기화 중", "running-prompt": "고정 문장 실행 중", complete: "완료", failed: "실패" }[stage]; }
function classifyError(error: unknown): WebLLMModelSmokeResult["errorMessageCategory"] { const msg = String((error as { message?: string })?.message ?? error ?? "").toLowerCase(); if (msg.includes("webgpu") || msg.includes("secure context")) return "브라우저 미지원"; if (msg.includes("out of memory") || msg.includes("quota") || msg.includes("oom")) return "메모리 부족 가능성"; if (msg.includes("load") || msg.includes("model")) return "모델 로드 실패"; if (msg.includes("candidate") || msg.includes("model list")) return "모델 후보 없음"; return msg.length > 0 ? "실행 중 오류" : "알 수 없는 오류"; }

export async function runWebLLMModelSmoke(onProgress: (p: WebLLMModelSmokeProgress) => void): Promise<WebLLMModelSmokeResult> {
  const start = now(); let packageLoadMs: number | null = null; let modelLoadMs: number | null = null; let selectedModelId: string | null = null;
  let modelSource: WebLLMModelSmokeResult["modelSource"] = "prebuilt-webllm";
  let manifestLoadMs: number | null = null; let manifestModelCount: number | null = null; let modelOrigin: string | null = null; let gomdoryFallbackReason: string | null = null;
  try {
    onProgress({ stage: "loading-package", message: getSmokeStageLabel("loading-package") });
    const pkgStart = now(); const webllm = await import("@mlc-ai/web-llm"); packageLoadMs = now() - pkgStart;
    onProgress({ stage: "selecting-model", message: getSmokeStageLabel("selecting-model") });
    let appConfig = webllm.prebuiltAppConfig;
    if (isWebLLMGomdoryModelsEnabled()) {
      try {
        const mfStart = now(); const res = await fetch(GOMDORY_WEBLLM_MANIFEST_URL, { cache: "no-store" });
        const manifest = await res.json(); manifestLoadMs = now() - mfStart;
        const validated = validateGomdoryManifest(manifest); manifestModelCount = Array.isArray((manifest as { models?: unknown[] }).models) ? (manifest as { models: unknown[] }).models.length : 0;
        const selected = selectGomdorySmokeModel(validated.validModels);
        if (!selected) throw new Error("no valid gomdory candidate");
        selectedModelId = selected.model_id; modelOrigin = new URL(selected.model).origin; modelSource = "gomdory-r2";
        appConfig = { model_list: [selected as unknown as ModelRecord] };
      } catch (error) {
        gomdoryFallbackReason = (error as { message?: string })?.message ?? "gomdory-manifest-failed";
        modelSource = "fallback-prebuilt-after-gomdory-failure";
      }
    }
    const list = appConfig?.model_list ?? []; if (!Array.isArray(list) || list.length === 0) throw new Error("model list unavailable");
    if (!selectedModelId) selectedModelId = selectSmallModel(list);
    if (!selectedModelId) throw new Error("no small model candidate");
    onProgress({ stage: "loading-model", message: getSmokeStageLabel("loading-model") });
    const loadStart = now(); const engine = await webllm.CreateMLCEngine(selectedModelId, { appConfig }); modelLoadMs = now() - loadStart;
    onProgress({ stage: "running-prompt", message: getSmokeStageLabel("running-prompt") });
    const runStart = now(); const completion = await engine.chat.completions.create({ messages: [{ role: "user", content: FIXED_KOREAN_SMOKE_PROMPT }], temperature: 0, max_tokens: 64 });
    const totalRunMs = now() - start; const firstTokenLatencyMs = now() - runStart; const generatedTokenEstimate = completion.usage?.completion_tokens ?? null; const tokensPerSecond = generatedTokenEstimate && totalRunMs > 0 ? (generatedTokenEstimate * 1000) / totalRunMs : null;
    onProgress({ stage: "complete", message: getSmokeStageLabel("complete") });
    return { smokeStatus: "complete", selectedModelId, packageLoadMs, modelLoadMs, firstTokenLatencyMs, totalRunMs, generatedTokenEstimate, tokensPerSecond, errorCode: null, errorMessageCategory: null, modelSource, manifestUrl: isWebLLMGomdoryModelsEnabled() ? GOMDORY_WEBLLM_MANIFEST_URL : null, manifestLoadMs, manifestModelCount, modelOrigin, gomdoryFallbackReason };
  } catch (error) {
    onProgress({ stage: "failed", message: getSmokeStageLabel("failed") });
    return { smokeStatus: "failed", selectedModelId, packageLoadMs, modelLoadMs, firstTokenLatencyMs: null, totalRunMs: now() - start, generatedTokenEstimate: null, tokensPerSecond: null, errorCode: (error as { name?: string; code?: string })?.code ?? (error as { name?: string })?.name ?? "unknown_error", errorMessageCategory: classifyError(error), modelSource, manifestUrl: isWebLLMGomdoryModelsEnabled() ? GOMDORY_WEBLLM_MANIFEST_URL : null, manifestLoadMs, manifestModelCount, modelOrigin, gomdoryFallbackReason };
  }
}
