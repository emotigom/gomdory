"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import CardTile from "@/app/_components/CardTile";
import { buttonTone, cn } from "@/app/_components/uiTokens";
import { apiFetch } from "@/lib/http/apiFetch";
import { routes } from "@/lib/standards/routes";
import type { DemoScenario } from "@/lib/onboarding/demoScenario";
import { DEMO_SCENARIO } from "@/lib/onboarding/demoScenario";
import { writeDemoScenario, writeDemoStepIndex } from "@/lib/onboarding/demoStorage";

type DemoBootstrapResponse = {
  ok: true;
  boardId: string;
  shareCode: string;
  studentUrl: string;
  projectorUrl: string;
  remoteUrl: string;
  demo?: DemoScenario;
};

type DemoLaunchState = "idle" | "loading" | "ready" | "error";

export default function DemoLaunchCard() {
  const [state, setState] = useState<DemoLaunchState>("idle");
  const [demoData, setDemoData] = useState<DemoBootstrapResponse | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!demoData?.studentUrl) return;
    try {
      await navigator.clipboard.writeText(demoData.studentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("copy failed", error);
      setCopied(false);
    }
  }, [demoData?.studentUrl]);

  useEffect(() => {
    if (!demoData?.studentUrl) return;
    let cancelled = false;

    const generateQr = async () => {
      try {
        const { toDataURL } = await import("qrcode");
        const dataUrl = await toDataURL(demoData.studentUrl);
        if (cancelled) return;
        setQrDataUrl(dataUrl);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "QR 코드를 생성하지 못했습니다.";
        setQrError(message);
      }
    };

    void generateQr();

    return () => {
      cancelled = true;
    };
  }, [demoData?.studentUrl]);

  const handleManualOpen = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleStart = async () => {
    setState("loading");
    setManualOpen(false);
    setErrorMessage(null);
    setDemoData(null);
    setQrDataUrl(null);
    setQrError(null);

    const projectorWindow = window.open("", "_blank", "noopener,noreferrer");
    const remoteWindow = window.open("", "_blank", "noopener,noreferrer");

    try {
      const response = await apiFetch(routes.api.onboarding.demo(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as DemoBootstrapResponse | null;

      if (!response.ok || !payload || payload.ok !== true) {
        const message =
          payload && "message" in payload && payload.message
            ? String(payload.message)
            : "데모를 준비하지 못했습니다.";
        throw new Error(message);
      }

      setDemoData(payload);
      writeDemoScenario(payload.boardId, payload.demo ?? DEMO_SCENARIO);
      writeDemoStepIndex(payload.boardId, 0);

      const blocked = !projectorWindow || !remoteWindow;
      if (projectorWindow) {
        projectorWindow.location.href = payload.projectorUrl;
      }
      if (remoteWindow) {
        remoteWindow.location.href = payload.remoteUrl;
      }
      setManualOpen(blocked);
      setState("ready");
    } catch (error) {
      if (projectorWindow) projectorWindow.close();
      if (remoteWindow) remoteWindow.close();
      const message = error instanceof Error ? error.message : "데모를 준비하지 못했습니다.";
      setErrorMessage(message);
      setState("error");
    }
  };

  return (
    <CardTile variant="present" className="border-emerald-200 bg-white/90">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Onboarding Demo</p>
            <h2 className="mt-2 text-2xl font-semibold text-emerald-950">첫 수업 자동 시작 (1분)</h2>
            <p className="text-sm text-emerald-700">
              워밍업 → 활동 → 정리까지 3단계 수업 흐름을 바로 보여줍니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStart}
            className={cn(buttonTone("primary", { size: "lg", tone: "emerald" }), "min-h-[52px] px-6")}
            disabled={state === "loading"}
          >
            {state === "loading" ? "자동 시작 중..." : "첫 수업 자동 시작(1분)"}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {DEMO_SCENARIO.steps.map((step, index) => (
            <div key={step.title} className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-700">Step {index + 1}</p>
              <p className="mt-1 text-[18px] font-semibold text-emerald-950">{step.title}</p>
              <p className="text-xs text-emerald-700">{step.description}</p>
            </div>
          ))}
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {demoData ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-3xl border border-indigo-200 bg-indigo-50 px-5 py-5">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-indigo-600">학생 참여 카드</p>
                  <p className="mt-2 text-lg font-semibold text-indigo-950">{demoData.studentUrl}</p>
                  <p className="text-sm text-indigo-700">학생에게 보여주세요: 지금 링크/QR로 접속해요.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    readOnly
                    value={demoData.studentUrl}
                    className="min-h-[48px] flex-1 rounded-xl border border-indigo-100 bg-white px-3 text-sm font-medium text-indigo-900 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px] min-w-[88px]")}
                  >
                    {copied ? "복사됨" : "복사"}
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-indigo-200 bg-white px-5 py-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-indigo-600">학생 QR</p>
                {qrError ? <p className="text-xs text-rose-600">{qrError}</p> : null}
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    alt="학생 링크 QR"
                    width={240}
                    height={240}
                    unoptimized
                    className="h-56 w-56"
                  />
                ) : (
                  <p className="text-xs text-slate-500">QR 코드 생성 중...</p>
                )}
                <p className="text-xs text-slate-500">{demoData.shareCode}</p>
              </div>
            </div>
          </div>
        ) : null}

        {manualOpen && demoData ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-semibold text-amber-900">자동으로 안 열리면 팝업 허용 후 아래 버튼을 눌러주세요.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => handleManualOpen(demoData.projectorUrl)}
                className={cn(buttonTone("primary", { size: "sm", tone: "emerald" }), "min-h-[44px] flex-1")}
              >
                프로젝터 열기
              </button>
              <button
                type="button"
                onClick={() => handleManualOpen(demoData.remoteUrl)}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px] flex-1")}
              >
                리모컨 열기
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px] flex-1")}
              >
                학생 링크 복사
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </CardTile>
  );
}
