"use client";

import { useMemo } from "react";

import { buttonTone, cn } from "@/app/_components/uiTokens";
import { useLiveSync } from "@/app/_components/useLiveSync";
import { buildJoinUrl } from "@/lib/http/publicLinks";
import { ShareQrButton } from "../ShareQrModal";
import { ClassStateBadge } from "./ClassStatusBar";

const liveStatusLabels = {
  idle: "라이브 대기",
  live: "라이브 연결",
  degraded: "라이브 지연",
  offline: "라이브 오프라인",
  paused: "라이브 재시도",
} as const;

const liveStatusStyles = {
  idle: "border-slate-200 bg-slate-50 text-slate-700",
  live: "border-emerald-200 bg-emerald-50 text-emerald-700",
  degraded: "border-amber-200 bg-amber-50 text-amber-700",
  offline: "border-rose-200 bg-rose-50 text-rose-700",
  paused: "border-rose-200 bg-rose-50 text-rose-700",
} as const;

type ClassControlStripProps = {
  boardId: string;
  shareCode: string | null;
  studentLink: string | null;
  classState: "idle" | "live" | "ended";
};

export default function ClassControlStrip({
  boardId,
  shareCode,
  studentLink,
  classState,
}: ClassControlStripProps) {
  const { status: liveStatus } = useLiveSync({
    mode: "teacher",
    boardId,
    shareCode: shareCode ?? undefined,
  });

  const entryUrl = useMemo(() => buildJoinUrl(), []);
  const liveLabel = liveStatusLabels[liveStatus];
  const liveStyle = liveStatusStyles[liveStatus];

  const ctaClass = cn(
    buttonTone("primary", { size: "lg" }),
    "min-w-[160px] justify-center text-base",
  );

  return (
    <div className="sticky top-0 z-30 rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">공유 코드</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-3xl font-semibold tracking-[0.2em] text-slate-900">
                {shareCode ? shareCode.toUpperCase() : "-"}
              </span>
              <ShareQrButton code={shareCode} />
            </div>
            <p className="mt-2 text-xs text-slate-500">학생 입장: {entryUrl}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClassStateBadge state={classState} />
            <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", liveStyle)}>{liveLabel}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {studentLink ? (
            <a
              href={studentLink}
              target="_blank"
              rel="noreferrer"
              className={ctaClass}
              data-interactive="true"
            >
              학생 보기
            </a>
          ) : (
            <button
              type="button"
              disabled
              className={cn(ctaClass, "cursor-not-allowed bg-slate-200 text-slate-500")}
              data-interactive="true"
            >
              학생 보기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
