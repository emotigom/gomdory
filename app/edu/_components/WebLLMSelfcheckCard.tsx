"use client";

import { useCallback, useEffect, useState } from "react";

import { runWebLLMBrowserChecks, type WebLLMBrowserCheckSummary } from "@/lib/edu/llm/webllmBrowserChecks";
import { isNetworkSaverPilotEnabled } from "@/lib/edu/netsaver/config";

const statusColor: Record<
  NonNullable<WebLLMBrowserCheckSummary["status"]>,
  { label: string; className: string }
> = {
  ready: { label: "준비됨", className: "text-emerald-600" },
  degraded: { label: "폴백 준비", className: "text-amber-600" },
  blocked: { label: "차단됨", className: "text-rose-600" },
};

export default function WebLLMSelfcheckCard() {
  const [summary, setSummary] = useState<WebLLMBrowserCheckSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [netsaverPilotEnabled, setNetsaverPilotEnabled] = useState(false);

  useEffect(() => {
    setNetsaverPilotEnabled(isNetworkSaverPilotEnabled());
  }, []);

  const runChecks = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const result = await runWebLLMBrowserChecks();
      setSummary(result);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-sky-600">EDU 로컬 모델 selfcheck</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">WebLLM 빠른 점검</h3>
          <p className="mt-1 text-sm text-slate-500">
            교실 환경에서 바로 실행할 수 있는 체크리스트입니다.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span
              className={`rounded-full border px-2 py-1 ${
                netsaverPilotEnabled
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              NETSAVER: {netsaverPilotEnabled ? "파일럿" : "안정"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={runChecks}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isRunning}
        >
          {isRunning ? "점검 중…" : "지금 점검하기"}
        </button>
      </div>

      {summary ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
              RID: {summary.requestId}
            </span>
            <span className={`font-semibold ${statusColor[summary.status].className}`}>
              상태: {statusColor[summary.status].label}
            </span>
            {summary.autoSelected && summary.resolvedModelId ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                자동 대체: {summary.resolvedModelId}
              </span>
            ) : null}
          </div>
          <div className="space-y-2">
            {summary.checks.map((check) => (
              <div
                key={check.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{check.label}</span>
                  <span
                    className={`text-xs font-semibold ${
                      check.status === "ok"
                        ? "text-emerald-600"
                        : check.status === "warn"
                          ? "text-amber-600"
                          : "text-rose-600"
                    }`}
                  >
                    {check.status.toUpperCase()}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">{check.message}</p>
                {check.detail ? <p className="mt-1 text-xs text-slate-400">{check.detail}</p> : null}
                {check.action ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">해결 행동: {check.action}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-400">
          버튼을 누르면 WebGPU, 모델 경로, 워밍업 상태를 한 번에 확인합니다.
        </p>
      )}
    </section>
  );
}
