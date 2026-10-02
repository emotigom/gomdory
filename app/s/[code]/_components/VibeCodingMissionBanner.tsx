"use client";

import { useState } from "react";

import type { VibeCodingStudentMission } from "@/lib/edu/vibe-coding/lesson-03-04-student-mission";

type VibeCodingMissionBannerProps = {
  mission: VibeCodingStudentMission;
  onOpenComposer?: () => void;
  defaultExpanded?: boolean;
};

export default function VibeCodingMissionBanner({
  mission,
  onOpenComposer,
  defaultExpanded = true,
}: VibeCodingMissionBannerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section aria-label="오늘의 미션 배너" className="mb-3 rounded-2xl border border-cyan-300/70 bg-cyan-50/95 p-3 text-slate-900 shadow-sm sm:mb-4 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold sm:text-base">{mission.title}</h2>
          <p className="mt-1 text-xs font-medium text-slate-700 sm:text-sm">{mission.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {expanded ? "접기" : "펼치기"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3">
          <ol className="list-decimal space-y-1.5 pl-5 text-xs text-slate-800 sm:text-sm">
            {mission.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-1.5">
            {mission.recommendedTemplates.map((template) => (
              <span
                key={template}
                className="rounded-full border border-cyan-300 bg-cyan-100 px-2 py-1 text-[11px] font-semibold text-cyan-900 sm:text-xs"
              >
                {template}
              </span>
            ))}
          </div>

          <p className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-900 sm:text-xs">
            {mission.safetyLine}
          </p>

          {onOpenComposer ? (
            <button
              type="button"
              onClick={onOpenComposer}
              className="inline-flex items-center justify-center rounded-md border border-cyan-800 bg-cyan-700 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-800 sm:text-sm"
            >
              카드 작성하기
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
