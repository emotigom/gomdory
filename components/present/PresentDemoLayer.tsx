"use client";

import { usePrefersReducedMotion } from "@/lib/ui/motion";

type PresentDemoLayerProps = {
  visible: boolean;
  onOptOut?: () => void;
};

const sampleQuestions = [
  { title: "질문 도착", body: "선생님, 다음 단계가 뭐예요?" },
  { title: "공유 질문", body: "예시 답안을 참고해도 될까요?" },
];

const sampleHelp = { title: "도움 요청", body: "화면이 안 보여요. 자리로 와주세요!" };
const samplePulse = { title: "Pulse", body: "이해도 응답: \"보통\" · 3" };

export default function PresentDemoLayer({ visible, onOptOut }: PresentDemoLayerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-end justify-center px-4 pb-6 sm:items-center sm:px-6">
      <div className="pointer-events-auto w-full max-w-5xl rounded-3xl border border-white/15 bg-gradient-to-br from-gray-900/90 via-black/85 to-gray-950/90 p-6 text-white shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-amber-300/70 bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-50">
            DEMO
          </span>
          <p className="text-sm font-semibold text-white/80">예시 화면 · 실제 데이터가 아닙니다.</p>
          <button
            type="button"
            onClick={onOptOut}
            className="ml-auto h-10 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            예시 숨기기
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {sampleQuestions.map((entry, index) => (
            <DemoCard
              key={`${entry.title}-${index}`}
              title={entry.title}
              body={entry.body}
              tone="sky"
              prefersReducedMotion={prefersReducedMotion}
              delay={index * 80}
            />
          ))}
          <DemoCard
            title={sampleHelp.title}
            body={sampleHelp.body}
            tone="rose"
            prefersReducedMotion={prefersReducedMotion}
            delay={160}
          />
          <DemoCard
            title={samplePulse.title}
            body={samplePulse.body}
            tone="emerald"
            prefersReducedMotion={prefersReducedMotion}
            delay={240}
          />
        </div>
        <p className="mt-3 text-xs text-white/70">학생이 입장하거나 요청이 도착하면 자동으로 숨겨집니다.</p>
      </div>
    </div>
  );
}

function DemoCard({
  title,
  body,
  tone,
  prefersReducedMotion,
  delay,
}: {
  title: string;
  body: string;
  tone: "sky" | "rose" | "emerald";
  prefersReducedMotion: boolean;
  delay?: number;
}) {
  const toneClass =
    tone === "sky"
      ? "border-sky-200/40 bg-sky-500/10"
      : tone === "rose"
        ? "border-rose-200/40 bg-rose-500/10"
        : "border-emerald-200/40 bg-emerald-500/10";

  return (
    <div
      className={`rounded-2xl border p-4 shadow-inner shadow-black/20 ${toneClass} ${
        prefersReducedMotion ? "" : "animate-[fadeIn_240ms_ease-out]"
      }`}
      style={prefersReducedMotion ? undefined : { animationDelay: `${delay ?? 0}ms` }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/80">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-white">{body}</p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-white/70">
        <span className="h-2 w-2 rounded-full bg-white/70" />
        이런 식으로 표시됩니다
      </div>
    </div>
  );
}
