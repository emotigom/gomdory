"use client";

import OverlayModal from "@/app/edu/_components/OverlayModal";
import type { QualityResult } from "@/lib/edu/quality/analyze";

type QualityChecklistModalProps = {
  open: boolean;
  result: QualityResult | null;
  onClose: () => void;
  onPublish: () => void;
  onApplyFixes: () => void;
};

const getScoreTone = (score: number) => {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-sky-600";
  return "text-amber-600";
};

export default function QualityChecklistModal({
  open,
  result,
  onClose,
  onPublish,
  onApplyFixes,
}: QualityChecklistModalProps) {
  if (!open) return null;

  const score = result?.score ?? 0;
  const warning =
    result && result.score < 60 ? "몇 가지만 다듬으면 훨씬 멋진 작품이 될 것 같아요!" : null;

  return (
    <OverlayModal open={open} onClose={onClose} title="체크리스트">
      <div className="space-y-6 px-2 py-2 sm:px-6 sm:py-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">추천 점수</p>
              <p className={`mt-1 text-2xl font-bold ${getScoreTone(score)}`}>{score}점</p>
            </div>
            <div className="flex-1">
              <div className="h-2 w-full rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-slate-900 transition-all"
                  style={{ width: `${score}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                체크리스트를 완료할수록 발표가 더 돋보여요.
              </p>
            </div>
          </div>
          {warning ? <p className="mt-3 text-sm font-semibold text-amber-600">{warning}</p> : null}
        </div>

        <div className="space-y-3">
          {result?.checks.map((check) => {
            const icon = check.ok ? "✓" : "•";
            const tone = check.ok ? "text-emerald-600" : "text-slate-500";
            return (
              <div key={check.key} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 text-lg font-bold ${tone}`}>{icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{check.label}</p>
                    {check.detail ? <p className="mt-1 text-xs text-slate-500">{check.detail}</p> : null}
                    {!check.ok && check.fix ? (
                      <p className="mt-1 text-xs font-semibold text-sky-600">자동 수정 가능</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onPublish}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800"
          >
            그대로 게시하기
          </button>
          <button
            type="button"
            onClick={onApplyFixes}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
          >
            자동 수정 적용 후 게시
          </button>
        </div>
      </div>
    </OverlayModal>
  );
}
