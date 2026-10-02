"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { detectWebLLMCapability } from "@/lib/webllm/webllmCapability";
import { createWebLLMDiagnosticReport } from "@/lib/webllm/webllmDiagnostics";
import { isWebLLMGomdoryModelsEnabled, isWebLLMModelSmokeEnabled } from "@/lib/webllm/webllmFlags";
import { FIXED_KOREAN_SMOKE_PROMPT, getSmokeStageLabel, runWebLLMModelSmoke } from "@/lib/webllm/webllmModelSmokeClient";
import type { WebLLMModelSmokeProgress, WebLLMModelSmokeResult, WebLLMModelSmokeStage } from "@/lib/webllm/webllmModelSmokeTypes";
import { GOMDORY_WEBLLM_MANIFEST_URL } from "@/lib/webllm/webllmGomdoryModelManifest";

type CopyState = "idle" | "success" | "error";

const CHECKLIST_ITEMS = ["학교 컴퓨터 1", "학교 컴퓨터 2", "교사용 노트북", "학생 개인 노트북", "Chrome", "Edge", "저사양 기기"];

export default function WebLLMLabClient() {
  const capability = useMemo(() => detectWebLLMCapability(), []);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [smokeProgress, setSmokeProgress] = useState<WebLLMModelSmokeProgress>({ stage: "idle", message: "대기 중" });
  const [smokeResult, setSmokeResult] = useState<WebLLMModelSmokeResult | null>(null);
  const mountedRef = useRef(true);
  const modelSmokeEnabled = isWebLLMModelSmokeEnabled();
  const gomdoryEnabled = isWebLLMGomdoryModelsEnabled();
  const smokeAvailable = modelSmokeEnabled && ["local-webllm-ready", "local-webllm-risky"].includes(capability.recommendedMode);
  const running = ["loading-package", "selecting-model", "loading-model", "running-prompt"].includes(smokeProgress.stage);

  const report = useMemo(() => createWebLLMDiagnosticReport(capability, undefined, smokeResult ?? undefined), [capability, smokeResult]);
  const reportText = useMemo(() => JSON.stringify(report, null, 2), [report]);

  const recommendedModeTone: Record<string, string> = {
    "local-webllm-ready": "bg-emerald-100 text-emerald-800",
    "local-webllm-risky": "bg-amber-100 text-amber-800",
    "fallback-only": "bg-rose-100 text-rose-800",
    unknown: "bg-slate-200 text-slate-800",
  };

  async function copyReport() {
    try { await navigator.clipboard.writeText(reportText); setCopyState("success"); window.setTimeout(() => setCopyState("idle"), 2500); } catch { setCopyState("error"); }
  }
  function toggleChecklistItem(item: string) { setCheckedItems((prev) => ({ ...prev, [item]: !prev[item] })); }
  async function runSmoke() {
    if (running) return;
    setSmokeResult(null);
    setSmokeProgress({ stage: "loading-package", message: getSmokeStageLabel("loading-package") });
    const result = await runWebLLMModelSmoke((p) => {
      if (!mountedRef.current) return;
      setSmokeProgress(p);
    });
    if (!mountedRef.current) return;
    setSmokeResult(result);
  }

  useEffect(() => () => { mountedRef.current = false; }, []);

  return (<main className="mx-auto max-w-3xl p-6 space-y-4">{/* UI unchanged for brevity */}
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">WebLLM Lab 진단</h1><p className="text-sm text-slate-600">브라우저 AI 실행 가능성 진단</p></div><Link href="/" className="inline-flex rounded bg-black px-4 py-2 text-sm text-white">홈으로 이동</Link></div>
    <p className="font-medium text-amber-700">아직 실제 AI 모델은 실행하지 않습니다. 이 화면은 가능성 진단 전용입니다.</p><p>이 진단 페이지는 학생 글쓰기 원문, 식별자, 수업 콘텐츠를 수집하거나 전송하지 않습니다.</p>
    <section className="rounded-xl border bg-white p-4 shadow-sm space-y-2"><h2 className="font-semibold">진단 요약</h2><span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${recommendedModeTone[capability.recommendedMode] ?? recommendedModeTone.unknown}`}>{capability.recommendedMode}</span>{capability.recommendedMode === "local-webllm-ready" ? <p className="text-sm text-emerald-700">이 기기는 향후 소형 브라우저 AI 모델 실험 후보입니다.</p> : null}</section>
    <section className="rounded-xl border bg-white p-4 shadow-sm space-y-2 text-sm"><h2 className="font-semibold text-base">모델 스모크 게이트</h2><p className="font-medium">{modelSmokeEnabled ? "게이트 활성" : "비활성화"}</p>
      {modelSmokeEnabled ? (<>
        <p className="text-amber-700">이 실험은 고정 문장으로만 실행되며, 학생 입력은 받지 않습니다.</p>
        <p>고정 프롬프트: {FIXED_KOREAN_SMOKE_PROMPT}</p>
        <p className="text-slate-600">처음 실행은 모델 파일 용량 때문에 시간이 오래 걸릴 수 있습니다.</p>
        <p>Gomdory 모델 저장소 사용: {gomdoryEnabled ? "활성화" : "비활성화"}</p>
        {gomdoryEnabled ? <p>Manifest URL: {GOMDORY_WEBLLM_MANIFEST_URL}</p> : null}
        {smokeResult ? <p>모델 공급 경로: {smokeResult.modelSource === "gomdory-r2" ? "Gomdory 모델 저장소" : smokeResult.modelSource === "fallback-prebuilt-after-gomdory-failure" ? "Gomdory 실패 후 WebLLM 기본 모델" : "WebLLM 기본 모델"}</p> : null}
        {smokeResult?.modelSource === "fallback-prebuilt-after-gomdory-failure" ? <p className="text-amber-700">Gomdory 모델 후보를 사용할 수 없어 WebLLM 기본 후보로 전환했습니다.</p> : null}

        {smokeAvailable ? <button type="button" disabled={running} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" onClick={runSmoke}>고정 프롬프트로 모델 스모크 실행</button> : <p>현재 기기 모드에서는 스모크를 실행하지 않습니다.</p>}
        <p>상태: {getSmokeStageLabel(smokeProgress.stage as WebLLMModelSmokeStage)}</p>
        {smokeResult?.selectedModelId ? <p>선택 모델: {smokeResult.selectedModelId}</p> : null}
        {(smokeResult && (smokeResult.smokeStatus === "complete" || smokeResult.packageLoadMs !== null || smokeResult.modelLoadMs !== null)) ? <div className="text-sm space-y-1"><p>패키지 로드(ms): {String(smokeResult.packageLoadMs)}</p><p>모델 로드(ms): {String(smokeResult.modelLoadMs)}</p><p>첫 토큰 지연(ms): {String(smokeResult.firstTokenLatencyMs)}</p><p>총 실행(ms): {String(smokeResult.totalRunMs)}</p><p>tokens/s: {String(smokeResult.tokensPerSecond)}</p>{smokeResult.errorMessageCategory ? <p>오류 분류: {smokeResult.errorMessageCategory}</p> : null}</div> : null}
      </>) : <p className="text-emerald-700">정상 상태입니다. 아직 실제 모델을 로드하지 않는 단계입니다.</p>}
    </section>
    <section className="rounded-xl border bg-white p-4 shadow-sm space-y-3"><h2 className="font-semibold">교실 테스트 체크리스트</h2><div className="grid gap-2 sm:grid-cols-2">{CHECKLIST_ITEMS.map((item)=><label key={item} className="flex items-center gap-2 rounded border px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(checkedItems[item])} onChange={() => toggleChecklistItem(item)} /><span>{item}</span></label>)}</div></section>
    <section className="rounded-xl border bg-white p-4 shadow-sm space-y-2"><h2 className="font-semibold">진단 리포트 복사</h2><p className="text-sm text-slate-600">모델 스모크 결과는 이 브라우저 탭에서만 생성됩니다.</p><button type="button" className="rounded bg-black px-4 py-2 text-white" onClick={copyReport}>진단 리포트 복사하기</button>{copyState === "success" ? <p className="text-sm text-green-700">복사되었습니다. 학생 글쓰기나 식별자는 포함되지 않았습니다.</p> : null}{copyState === "error" ? <p className="text-sm text-red-700">복사에 실패했습니다. 아래 리포트를 직접 선택해 복사해주세요.</p> : null}</section>
    <section className="rounded-xl border bg-white p-4 shadow-sm space-y-2"><h2 className="font-semibold">로컬 진단 리포트 미리보기</h2><details className="rounded border p-4"><summary className="cursor-pointer font-medium">미리보기 펼치기</summary><pre className="mt-3 overflow-auto text-xs">{reportText}</pre></details></section>
  </main>);
}
