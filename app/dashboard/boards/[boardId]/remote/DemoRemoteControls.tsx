"use client";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import type { DemoScenarioStep } from "@/lib/onboarding/demoScenario";
import { DEMO_ANNOUNCEMENTS } from "@/lib/onboarding/demoScenario";

type DemoRemoteControlsProps = {
  demoEnabled: boolean;
  steps: DemoScenarioStep[];
  stepIndex: number;
  onNextStep: () => void;
  onSendAnnouncement: (text: string) => void;
  onCopyStudentLink: () => void;
  studentUrl?: string | null;
};

export default function DemoRemoteControls({
  demoEnabled,
  steps,
  stepIndex,
  onNextStep,
  onSendAnnouncement,
  onCopyStudentLink,
  studentUrl,
}: DemoRemoteControlsProps) {
  if (!demoEnabled) return null;
  const totalSteps = steps.length;
  const current = steps[stepIndex] ?? steps[0];

  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">데모 컨트롤</p>
          <p className="mt-2 text-lg font-semibold text-emerald-950">
            Step {Math.min(stepIndex + 1, totalSteps)}/{totalSteps} · {current?.title ?? "데모 진행"}
          </p>
          <p className="text-sm text-emerald-700">{current?.description ?? "다음 단계로 진행하세요."}</p>
        </div>
        <button
          type="button"
          onClick={onNextStep}
          className={cn(buttonTone("primary", { size: "lg", tone: "emerald" }), "min-h-[52px] px-6")}
        >
          다음 단계
        </button>
      </div>
      <div className="mt-4 grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">공지 보내기</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {DEMO_ANNOUNCEMENTS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => onSendAnnouncement(text)}
              className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px] text-left")}
            >
              {text}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCopyStudentLink}
          className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[44px]")}
          disabled={!studentUrl}
        >
          학생 링크 복사
        </button>
      </div>
    </div>
  );
}
