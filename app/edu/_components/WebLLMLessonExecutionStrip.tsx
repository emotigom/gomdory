"use client";

import Link from "next/link";
import type { WebllmContainedLessonExecutionStripModel } from "@/lib/edu/llm/webllmContainedLessonExecutionStrip";

type Props = {
  model: WebllmContainedLessonExecutionStripModel;
};

const toneClasses: Record<WebllmContainedLessonExecutionStripModel["tone"], string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  caution: "border-amber-200 bg-amber-50 text-amber-800",
  blocked: "border-rose-200 bg-rose-50 text-rose-800",
};

const verdictClasses: Record<WebllmContainedLessonExecutionStripModel["verdict"], string> = {
  GO: "border-emerald-300 bg-emerald-100 text-emerald-900",
  HOLD: "border-amber-300 bg-amber-100 text-amber-900",
  STOP: "border-rose-300 bg-rose-100 text-rose-900",
};

export default function WebLLMLessonExecutionStrip({ model }: Props) {
  if (!model.visible) return null;

  return (
    <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${toneClasses[model.tone]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${verdictClasses[model.verdict]}`}>
          {model.verdict}
        </span>
        <p className="font-semibold">{model.summary}</p>
      </div>
      <p className="mt-1 text-[11px] opacity-90">{model.recentOutcomeLabel}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-80">
        <span>scope: {model.scopeLabel}</span>
        <span>·</span>
        <span>state: {model.operatorState}</span>
        {model.showSelfcheckLink ? (
          <>
            <span>·</span>
            <Link href="/edu/selfcheck" className="font-semibold underline underline-offset-2">
              {model.evidenceHint}
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
