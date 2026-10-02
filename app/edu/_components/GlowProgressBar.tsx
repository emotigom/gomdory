import type { ReactNode } from "react";

type GlowStep = {
  id: string;
  label: string;
  icon: ReactNode;
};

type GlowProgressBarProps = {
  steps: GlowStep[];
  activeIndex: number;
  showTooltips?: boolean;
  phase?: "IDLE" | "COACH_STREAMING" | "GENERATING" | "APPLYING" | "DONE";
  presentationMode?: boolean;
};

const clampIndex = (index: number, max: number) => Math.min(Math.max(index, 0), max);

export default function GlowProgressBar({
  steps,
  activeIndex,
  showTooltips = false,
  phase = "IDLE",
  presentationMode = false,
}: GlowProgressBarProps) {
  const safeIndex = clampIndex(activeIndex, Math.max(steps.length - 1, 0));
  const barHeight = presentationMode ? "h-1.5" : "h-[3px]";
  const activeGlow =
    phase === "COACH_STREAMING"
      ? "animate-[glow-flow_3.2s_ease-in-out_infinite]"
      : phase === "GENERATING"
        ? "animate-[glow-flow_1.4s_linear_infinite]"
        : phase === "APPLYING"
          ? "animate-[glow-pulse_0.6s_ease-out_1]"
          : phase === "DONE"
            ? "animate-[glow-flash_0.5s_ease-out_1]"
            : "";

  return (
    <div className={`flex flex-col gap-2 ${presentationMode ? "gap-3" : ""}`}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index <= safeIndex;
          return (
            <div key={step.id} className="flex flex-1 items-center justify-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                  isActive
                    ? `bg-sky-500/15 text-sky-600 shadow-[0_0_12px_rgba(56,189,248,0.55)] ${
                        presentationMode ? "shadow-[0_0_16px_rgba(56,189,248,0.7)]" : ""
                      }`
                    : "bg-slate-200/60 text-slate-400"
                }`}
                title={showTooltips ? step.label : undefined}
                aria-hidden={!showTooltips}
              >
                <span className="h-4 w-4">{step.icon}</span>
              </div>
              {showTooltips ? <span className="sr-only">{step.label}</span> : null}
            </div>
          );
        })}
      </div>
      <div className={`flex ${barHeight} items-center gap-1`}>
        {steps.map((step, index) => {
          const isActive = index <= safeIndex;
          return (
            <div
              key={step.id}
              className={`${barHeight} flex-1 rounded-full transition-all ${
                isActive
                  ? `bg-sky-400/85 shadow-[0_0_14px_rgba(56,189,248,0.7)] ${activeGlow}`
                  : "bg-slate-200/80"
              }`}
            />
          );
        })}
      </div>
      <style jsx>{`
        @keyframes glow-flow {
          0% {
            filter: brightness(0.85);
            transform: translateX(-6%);
          }
          50% {
            filter: brightness(1.2);
            transform: translateX(6%);
          }
          100% {
            filter: brightness(0.85);
            transform: translateX(-6%);
          }
        }
        @keyframes glow-pulse {
          0% {
            filter: brightness(0.9);
          }
          50% {
            filter: brightness(1.35);
          }
          100% {
            filter: brightness(1);
          }
        }
        @keyframes glow-flash {
          0% {
            filter: brightness(1);
          }
          40% {
            filter: brightness(1.7);
          }
          100% {
            filter: brightness(1);
          }
        }
      `}</style>
    </div>
  );
}
