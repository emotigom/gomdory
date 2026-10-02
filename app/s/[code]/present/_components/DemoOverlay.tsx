"use client";

import { useEffect, useState } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import type { DemoScenarioStep } from "@/lib/onboarding/demoScenario";

type DemoOverlayProps = {
  steps: DemoScenarioStep[];
  stepIndex: number;
  onNext: () => void;
  canAdvance?: boolean;
};

export default function DemoOverlay({ steps, stepIndex, onNext, canAdvance = false }: DemoOverlayProps) {
  const [visible, setVisible] = useState(true);
  const totalSteps = steps.length;
  const clampedIndex = Math.min(Math.max(stepIndex, 0), Math.max(totalSteps - 1, 0));
  const step = steps[clampedIndex];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setVisible(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!visible || !step) return null;

  return (
    <div className="pointer-events-none fixed left-6 top-6 z-50 w-full max-w-sm">
      <div className="pointer-events-auto rounded-3xl border border-white/20 bg-black/70 px-5 py-5 text-white shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">Demo Step</p>
        <div className="mt-3 space-y-2">
          <p className="text-lg font-semibold">
            Step {clampedIndex + 1}/{totalSteps}
          </p>
          <p className="text-2xl font-semibold">{step.title}</p>
          <p className="text-sm text-white/80">{step.description}</p>
          <p className="text-xs text-white/60">약 {step.seconds}초</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {canAdvance ? (
            <button
              type="button"
              onClick={onNext}
              className={cn(buttonTone("primary", { size: "sm", tone: "emerald" }), "min-h-[44px] px-4")}
            >
              다음 단계
            </button>
          ) : null}
          <span className="text-[11px] text-white/60">Esc로 숨기기</span>
        </div>
      </div>
    </div>
  );
}
