"use client";

import { useEffect, useMemo, useState } from "react";
import type * as webllm from "@mlc-ai/web-llm";
import { apiV1Path } from "@/lib/standards/pathTypes";
import {
  getWebLLMLastGoodSelection,
  initWebLLM,
  prefetchWebLLMAssets,
  resetWebLLMSingleton,
  type WebLLMProgressState,
} from "@/lib/edu/llm/webllmRuntime";
import { safeClearWebLLMCache } from "@/lib/edu/llm/webllmCache";
import {
  getWebLLMDeviceTier,
  readWebLLMCooldownState,
  type WebLLMDeviceCaps,
} from "@/lib/edu/llm/webllmTiering";
import { getEduWebLLMHardDisableFlag, getEduWebLLMPrefetchFlag, getWebLLMLabsFlag } from "@/lib/edu/llm/webllmFeatureFlags";

const PROMPT = "Respond with a single short sentence: OK";
const MAX_TOKENS = 16;
const DEFAULT_SEED = 42;
const RUN_TIMEOUT_MS = 60_000;



type ValidatorFailureCode = "NOT_FOUND" | "FORBIDDEN" | "CORS_BLOCKED" | "RANGE_UNSUPPORTED" | "MISCONFIG_URL" | "UNKNOWN";

type ValidatorStep = {
  ok: boolean;
  step: string;
  failureCode: ValidatorFailureCode | null;
  message: string;
  url: string;
  recommendedFix: string;
};

type ValidatorModel = {
  modelId: string;
  summary: {
    configOk: boolean;
    wasmOk: boolean;
    rangeOk: boolean;
    corsOk: boolean;
  };
  rootCause: ValidatorStep;
  ok: boolean;
};

type ValidatorPayload = {
  ok: boolean;
  requestId: string;
  primary?: ValidatorModel;
  fallback?: ValidatorModel;
  coach?: ValidatorModel;
  corsTemplates?: {
    downloadOnly: Record<string, unknown>;
    uploadEnabled: Record<string, unknown>;
  };
  guidance?: { options?: string };
};
type WebLLMLabsDiagnostics = {
  requestId: string;
  status: "idle" | "running" | "ok" | "error";
  selectedModelId?: string;
  selectedTier?: "lite" | "normal" | "fast";
  tierReason?: string;
  selectionReason?: string;
  deviceCaps?: WebLLMDeviceCaps;
  cooldownActive?: boolean;
  warnings?: string[];
  timers?: Record<string, number>;
  progress?: WebLLMProgressState[];
  output?: {
    text: string;
    token_count: number | null;
  };
  lastGood?: {
    modelId: string;
    reason: string;
    at: number;
  } | null;
  error?: {
    code: string;
    message: string;
  };
};

const getRequestId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `webllm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const wasmThreadProbeBytes = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d,
  0x01, 0x00, 0x00, 0x00,
  0x05, 0x04, 0x01, 0x03, 0x01, 0x01,
]);

const detectWasmThreadsSupported = () => {
  if (typeof WebAssembly === "undefined" || typeof SharedArrayBuffer === "undefined") {
    return false;
  }
  try {
    return WebAssembly.validate(wasmThreadProbeBytes);
  } catch {
    return false;
  }
};

const buildDiagnosticsPayload = (input: WebLLMLabsDiagnostics | null, envSnapshot: Record<string, unknown>) => {
  if (!input) return null;
  return {
    ...input,
    env: envSnapshot,
  };
};

const humanError = (code: string) => {
  if (code === "EDU_WEBLLM_MISCONFIGURED") return "모델 경로/권한(CORS/404/RANGE)을 확인해 주세요.";
  if (code === "EDU_WEBLLM_OOM") return "기기 메모리가 부족합니다. fallback 모델을 사용해 보세요.";
  if (code === "EDU_WEBLLM_COMPILE_FAIL") return "브라우저 WebAssembly/WebGPU 설정을 확인해 주세요.";
  if (code === "EDU_WEBLLM_INIT_TIMEOUT") return "초기화 시간이 길어요. 네트워크 상태를 확인해 주세요.";
  if (code === "EDU_WEBLLM_HARD_DISABLED") return "운영 kill-switch로 WebLLM이 비활성화되었습니다.";
  if (code === "EDU_WEBLLM_SESSION_DISABLED" || code === "EDU_WEBLLM_BACKOFF" || code === "EDU_WEBLLM_COOLDOWN") return "반복 실패로 WebLLM이 잠시 중단되었습니다.";
  return "WebLLM 초기화 중 문제가 발생했습니다.";
};

export default function WebLLMClient() {
  const [health, setHealth] = useState<unknown | null>(null);
  const [assetValidator, setAssetValidator] = useState<ValidatorPayload | null>(null);
  const [status, setStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<WebLLMLabsDiagnostics | null>(null);
  const [readyToLoad, setReadyToLoad] = useState<boolean | null>(null);
  const [forcePrimary, setForcePrimary] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [wasmThreadsSupported, setWasmThreadsSupported] = useState<boolean | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);

  const envSnapshot = useMemo(() => {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    const deviceMemory =
      nav && "deviceMemory" in nav
        ? (nav as Navigator & { deviceMemory?: number }).deviceMemory
        : undefined;

    return {
      userAgent: nav?.userAgent,
      deviceMemory,
      hardwareConcurrency: nav?.hardwareConcurrency,
      crossOriginIsolated: typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : undefined,
      sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
    };
  }, []);

  useEffect(() => {
    setWasmThreadsSupported(detectWasmThreadsSupported());
    setCooldownActive(readWebLLMCooldownState().cooldownActive);
  }, []);

  useEffect(() => {
    if (!getEduWebLLMPrefetchFlag()) return;
    const controller = new AbortController();
    const requestIdleCallback = (
      window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }
    ).requestIdleCallback;

    const startPrefetch = () => {
      void prefetchWebLLMAssets({ signal: controller.signal }).then((result) => {
        setReadyToLoad(result.ready);
      });
    };

    let idleId: number | null = null;
    if (requestIdleCallback) {
      idleId = requestIdleCallback(startPrefetch, { timeout: 2_000 });
    } else {
      idleId = window.setTimeout(startPrefetch, 1_200);
    }

    return () => {
      controller.abort();
      if (idleId != null) {
        window.clearTimeout(idleId);
      }
    };
  }, []);

  const runHealthCheck = async () => {
    setStatus("running");
    setStatusMessage("health check 요청 중...");
    try {
      const clientRequestId = getRequestId();
      const response = await fetch(apiV1Path("edu/webllm/health"), {
        cache: "no-store",
        headers: { "x-client-request-id": clientRequestId },
      });
      const data = await response.json();
      setHealth({ status: response.status, ok: response.ok, data });
      setStatus("ok");
      setStatusMessage("health check 완료");
    } catch (error) {
      setHealth({ ok: false, error: error instanceof Error ? error.message : String(error) });
      setStatus("error");
      setStatusMessage("health check 실패");
    }
  };

  const runAssetValidator = async () => {
    setStatus("running");
    setStatusMessage("asset-validator 요청 중...");
    try {
      const clientRequestId = getRequestId();
      const response = await fetch(apiV1Path("edu/webllm/asset-validator"), {
        cache: "no-store",
        headers: { "x-client-request-id": clientRequestId },
      });
      const data = (await response.json()) as ValidatorPayload;
      setAssetValidator(data);
      setStatus(response.ok && data.ok ? "ok" : "error");
      setStatusMessage(response.ok && data.ok ? "asset-validator 완료" : "asset-validator 실패");
    } catch (error) {
      setAssetValidator(null);
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "asset-validator 실패");
    }
  };

  const runPrefetch = async () => {
    const controller = new AbortController();
    setStatus("running");
    setStatusMessage("asset prefetch 확인 중...");
    const result = await prefetchWebLLMAssets({ signal: controller.signal });
    setReadyToLoad(result.ready);
    setStatus(result.ready ? "ok" : "error");
    setStatusMessage(result.message);
  };

  const runInit = async () => {
    const requestId = getRequestId();
    const progress: WebLLMProgressState[] = [];
    setStatus("running");
    setStatusMessage("WebLLM 초기화 중...");

    try {
      const result = await initWebLLM({
        mode: "auto",
        reason: "labs_manual",
        requestId,
        forcePrimary,
        onProgress: (state) => {
          progress.push(state);
          setStatusMessage(`progress: ${state}`);
        },
      });

      setDiagnostics({
        requestId,
        status: "ok",
        selectedModelId: result.selectedModelId,
        selectedTier: result.tier.selectedTier,
        tierReason: result.tier.tierReason,
        deviceCaps: result.tier.deviceCaps,
        cooldownActive: result.tier.cooldownActive,
        selectionReason: result.selectionReason,
        warnings: result.warnings,
        timers: result.timers as Record<string, number>,
        progress,
        lastGood: getWebLLMLastGoodSelection(),
      });
      setStatus("ok");
      setStatusMessage("초기화 완료");
    } catch (error) {
      const code = (error as { code?: string })?.code ?? "EDU_WEBLLM_INIT_FAIL";
      setStatus("error");
      setStatusMessage(`${humanError(code)} (${code})`);
      setDiagnostics({
        requestId,
        status: "error",
        progress,
        error: {
          code,
          message: error instanceof Error ? error.message : String(error),
        },
        lastGood: getWebLLMLastGoodSelection(),
      });
    }
  };

  const runInference = async () => {
    const requestId = getRequestId();
    setStatus("running");
    setStatusMessage("1-shot 추론 실행 중...");

    try {
      const initResult = await initWebLLM({ mode: "auto", reason: "labs_inference", requestId, forcePrimary });
      const engine = initResult.engine;
      const selectedModelId = initResult.selectedModelId;

      const runStarted = performance.now();
      let firstTokenAt: number | null = null;
      let outputText = "";
      let tokenCount: number | null = null;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
      const stream = (await engine.chatCompletion({
        model: selectedModelId,
        messages: [{ role: "user", content: PROMPT }],
        temperature: 0,
        top_p: 1,
        max_tokens: MAX_TOKENS,
        seed: DEFAULT_SEED,
        stream: true,
        signal: controller.signal,
      } as webllm.ChatCompletionRequestStreaming)) as AsyncIterable<webllm.ChatCompletionChunk>;

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          if (!firstTokenAt) firstTokenAt = performance.now();
          outputText += delta;
        }
        if (chunk.usage?.completion_tokens != null) {
          tokenCount = chunk.usage.completion_tokens;
        }
      }
      clearTimeout(timeout);

      setDiagnostics({
        requestId,
        status: "ok",
        selectedModelId,
        selectedTier: initResult.tier.selectedTier,
        tierReason: initResult.tier.tierReason,
        deviceCaps: initResult.tier.deviceCaps,
        cooldownActive: initResult.tier.cooldownActive,
        selectionReason: initResult.selectionReason,
        warnings: initResult.warnings,
        timers: {
          ...initResult.timers,
          "first-token": firstTokenAt ? firstTokenAt - runStarted : 0,
          ready: performance.now() - runStarted,
        },
        output: {
          text: outputText.trim(),
          token_count: tokenCount,
        },
        lastGood: getWebLLMLastGoodSelection(),
      });
      setStatus("ok");
      setStatusMessage("추론 완료");
    } catch (error) {
      const code = (error as { code?: string })?.code ?? "EDU_WEBLLM_INFER_FAIL";
      setStatus("error");
      setStatusMessage(`${humanError(code)} (${code})`);
      setDiagnostics({
        requestId,
        status: "error",
        error: {
          code,
          message: error instanceof Error ? error.message : String(error),
        },
        lastGood: getWebLLMLastGoodSelection(),
      });
    }
  };

  const clearCaches = async () => {
    setStatus("running");
    setStatusMessage("캐시 정리 중...");
    try {
      await safeClearWebLLMCache();
      resetWebLLMSingleton();
      setStatus("ok");
      setStatusMessage("캐시 정리 완료");
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "캐시 정리 실패");
    }
  };


  const copyDiagnostics = async () => {
    const payload = buildDiagnosticsPayload(diagnostics, envSnapshot as Record<string, unknown>);
    if (!payload) {
      setCopyStatus("진단 데이터가 아직 없습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyStatus("진단 JSON을 클립보드에 복사했습니다.");
    } catch {
      setCopyStatus("클립보드 복사에 실패했습니다.");
    }
  };

  const labsFlag = getWebLLMLabsFlag();
  const hardDisabled = getEduWebLLMHardDisableFlag();
  const labsEnabled = labsFlag && (process.env.NODE_ENV !== "production" || labsFlag);


  const validatorModels = [
    { slot: "primary", data: assetValidator?.primary },
    { slot: "fallback", data: assetValidator?.fallback },
    { slot: "coach", data: assetValidator?.coach },
  ].filter((entry) => Boolean(entry.data));

  if (!labsEnabled) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6 text-sm text-neutral-600">
        NEXT_PUBLIC_EDU_WEBLLM_LABS=1 환경에서만 WebLLM 실험 페이지를 사용할 수 있습니다.
      </div>
    );
  }

  if (hardDisabled) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
        EDU_WEBLLM_HARD_DISABLE=true 상태입니다. WebLLM 초기화는 완전히 차단되며 일반 서버 경로를 사용합니다.
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={runHealthCheck} disabled={status === "running"}>Health</button>
        <button type="button" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={runAssetValidator} disabled={status === "running"}>Asset validator</button>
        <button type="button" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={runPrefetch} disabled={status === "running"}>Prefetch check</button>
        <button type="button" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={runInit} disabled={status === "running"}>Init auto</button>
        <button type="button" className="rounded-md border border-neutral-300 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white" onClick={runInference} disabled={status === "running"}>Run 1-shot inference</button>
        <button type="button" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={clearCaches} disabled={status === "running"}>Clear caches</button>
        <button type="button" className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm" onClick={copyDiagnostics}>Copy diagnostics</button>
        <label className="ml-2 flex items-center gap-2 text-xs text-neutral-600">
          <input type="checkbox" checked={forcePrimary} onChange={(event) => setForcePrimary(event.target.checked)} />
          Force primary
        </label>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-medium">Status</div>
          <div className="text-xs text-neutral-500">ready: {readyToLoad == null ? "-" : readyToLoad ? "Ready to load" : "Not ready"}</div>
        </div>
        <div className="mt-2 flex flex-col gap-1 text-xs text-neutral-500">
          <div>state: {status}</div>
          {statusMessage ? <div>message: {statusMessage}</div> : null}
          <div>deviceMemory: {String(envSnapshot.deviceMemory ?? "-")}</div>
          <div>hardwareConcurrency: {String(envSnapshot.hardwareConcurrency ?? "-")}</div>
          <div>crossOriginIsolated: {String(envSnapshot.crossOriginIsolated ?? false)}</div>
          <div>sharedArrayBuffer: {String(envSnapshot.sharedArrayBuffer)}</div>
          <div>wasmThreadsSupported: {String(wasmThreadsSupported ?? false)}</div>
          <div>cooldownActive: {String(cooldownActive)}</div>
          {!envSnapshot.crossOriginIsolated ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
              cross-origin isolation이 꺼져 있어요. Chromium 최신 브라우저 + HTTPS + /labs/webllm 전용 COOP/COEP 헤더가 모두 필요합니다.
            </div>
          ) : null}
          <div>selectedTier: {getWebLLMDeviceTier({
            deviceMemory: envSnapshot.deviceMemory as number | undefined,
            hardwareConcurrency: envSnapshot.hardwareConcurrency as number | undefined,
            crossOriginIsolated: Boolean(envSnapshot.crossOriginIsolated),
            sharedArrayBuffer: Boolean(envSnapshot.sharedArrayBuffer),
            wasmThreadsSupported: wasmThreadsSupported ?? false,
            cooldownActive,
          }).selectedTier}</div>
          {copyStatus ? <div>copy: {copyStatus}</div> : null}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
        <div className="font-medium">Health response</div>
        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
          {health ? JSON.stringify(health, null, 2) : "(not requested)"}
        </pre>
      </div>


      <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
        <div className="font-medium">Model Asset Validator</div>
        <p className="mt-1 text-xs text-neutral-500">각 모델(primary/fallback/coach)의 config/wasm/range/cors 상태와 단일 root cause를 표시합니다.</p>
        {assetValidator ? (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="px-2 py-1">model</th>
                    <th className="px-2 py-1">config</th>
                    <th className="px-2 py-1">wasm</th>
                    <th className="px-2 py-1">range</th>
                    <th className="px-2 py-1">cors</th>
                  </tr>
                </thead>
                <tbody>
                  {validatorModels.map((entry) => {
                    const model = entry.data as ValidatorModel;
                    return (
                      <tr key={`${entry.slot}-${model.modelId}`} className="border-b border-neutral-100">
                        <td className="px-2 py-1">{entry.slot}: {model.modelId}</td>
                        <td className="px-2 py-1">{model.summary.configOk ? "ok" : "fail"}</td>
                        <td className="px-2 py-1">{model.summary.wasmOk ? "ok" : "fail"}</td>
                        <td className="px-2 py-1">{model.summary.rangeOk ? "ok" : "fail"}</td>
                        <td className="px-2 py-1">{model.summary.corsOk ? "ok" : "fail"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-2">
              {validatorModels.map((entry) => {
                const model = entry.data as ValidatorModel;
                const root = model.rootCause;
                return (
                  <div key={`cause-${entry.slot}-${model.modelId}`} className="rounded border border-neutral-200 bg-neutral-50 p-2 text-xs">
                    <p className="font-medium">{entry.slot}: {model.modelId} → {root.failureCode ?? "OK"}</p>
                    <p>url: <span className="break-all">{root.url || "-"}</span></p>
                    <p>fix: {root.recommendedFix}</p>
                  </div>
                );
              })}
            </div>
            <details className="mt-3 rounded border border-neutral-200 p-2">
              <summary className="cursor-pointer text-xs font-medium">R2 CORS template: Download-only (recommended)</summary>
              <pre className="mt-2 max-h-60 overflow-auto rounded bg-neutral-50 p-2 text-[11px]">{JSON.stringify(assetValidator.corsTemplates?.downloadOnly ?? {}, null, 2)}</pre>
            </details>
            <details className="mt-2 rounded border border-neutral-200 p-2">
              <summary className="cursor-pointer text-xs font-medium">R2 CORS template: Upload-enabled (optional)</summary>
              <pre className="mt-2 max-h-60 overflow-auto rounded bg-neutral-50 p-2 text-[11px]">{JSON.stringify(assetValidator.corsTemplates?.uploadEnabled ?? {}, null, 2)}</pre>
            </details>
            <p className="mt-2 text-xs text-amber-700">{assetValidator.guidance?.options}</p>
          </>
        ) : (
          <p className="mt-2 text-xs text-neutral-500">(not requested)</p>
        )}
      </div>
      <details className="rounded-lg border border-neutral-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-neutral-800">Diagnostics (JSON)</summary>
        <pre className="mt-2 max-h-[420px] overflow-auto rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
          {diagnostics ? JSON.stringify(buildDiagnosticsPayload(diagnostics, envSnapshot as Record<string, unknown>), null, 2) : "(no diagnostics yet)"}
        </pre>
      </details>
    </section>
  );
}
