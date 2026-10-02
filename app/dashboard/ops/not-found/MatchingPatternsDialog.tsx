"use client";

import { useId, useState } from "react";

export type MatchingPatternItem = {
  patternPath: string;
  fileHint: string;
};

export default function MatchingPatternsDialog({ items }: { items: MatchingPatternItem[] }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  if (!items || items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="dashboard-ops-control inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
      >
        ⚠️ warn · 패턴 {items.length}개
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={titleId} className="text-sm font-semibold text-slate-900">
                  매칭 라우트 패턴 (Top {items.length})
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  이 alias를 추가하면 아래 라우트가 처리하던 요청을 덮어쓸 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="dashboard-ops-control rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
              >
                닫기
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {items.map((m) => (
                <li key={m.patternPath} className="dashboard-ops-row rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="break-all font-mono text-xs text-slate-800">{m.patternPath}</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{m.fileHint}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
