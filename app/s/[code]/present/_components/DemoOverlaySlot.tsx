"use client";

import DemoOverlay from "./DemoOverlay";
import type { DemoScenarioStep } from "@/lib/onboarding/demoScenario";

type DemoOverlaySlotProps = {
  demoEnabled: boolean;
  steps: DemoScenarioStep[];
  stepIndex: number;
  onNext: () => void;
  canAdvance?: boolean;
};

export default function DemoOverlaySlot({
  demoEnabled,
  steps,
  stepIndex,
  onNext,
  canAdvance = false,
}: DemoOverlaySlotProps) {
  if (!demoEnabled) return null;
  return <DemoOverlay steps={steps} stepIndex={stepIndex} onNext={onNext} canAdvance={canAdvance} />;
}
