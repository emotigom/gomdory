"use client";

import { useActionState } from "react";

import {
  previewReportsBacklogQuickAction,
  runReportsBacklogBulkResolveQuickAction,
} from "./actions";

type PreviewItem = {
  id: string;
  targetType: "post" | "comment";
  targetId: string;
  reason: string;
  createdAt: string;
};

type ActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  wouldCount?: number;
  previewItems?: PreviewItem[];
  executedCount?: number;
  requiresConfirmation?: boolean;
  confirmToken?: string;
};

const INITIAL_STATE: ActionState = {
  ok: false,
  message: "",
  requestId: "",
};

function formatDate(value: string | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("ko-KR");
}

export default function ReportsBacklogAssistant() {
  const [previewState, previewAction, previewPending] = useActionState(previewReportsBacklogQuickAction, INITIAL_STATE);
  const [runState, runAction, runPending] = useActionState(runReportsBacklogBulkResolveQuickAction, INITIAL_STATE);

  const list = previewState.previewItems ?? [];

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white/80 p-3">
      <p className="text-xs font-semibold text-slate-700">Reports backlog assistant</p>
      <p className="mt-1 text-xs text-slate-600">드라이런으로 최근 24시간 open reports 대상과 would-change 수를 확인한 뒤, 확인 토큰으로 일괄 resolved 처리합니다.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <form action={previewAction}>
          <button
            type="submit"
            disabled={previewPending || runPending}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
          >
            {previewPending ? "미리보기 생성 중…" : "드라이런 / 미리보기"}
          </button>
        </form>
        <form action={runAction}>
          <input type="hidden" name="confirmToken" value={previewState.confirmToken ?? ""} />
          <button
            type="submit"
            disabled={!previewState.requiresConfirmation || !previewState.confirmToken || previewPending || runPending}
            className="rounded-md border border-rose-300 bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800 disabled:opacity-60"
          >
            {runPending ? "일괄 처리 중…" : "확인 후 일괄 resolve 실행"}
          </button>
        </form>
      </div>

      {previewState.message ? (
        <p className={`mt-2 text-xs ${previewState.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {previewState.message}
          {typeof previewState.wouldCount === "number" ? ` (would-change: ${previewState.wouldCount})` : ""}
          {previewState.requestId ? ` (request_id: ${previewState.requestId})` : ""}
        </p>
      ) : null}
      {runState.message ? (
        <p className={`mt-1 text-xs ${runState.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {runState.message}
          {typeof runState.executedCount === "number" ? ` (executed: ${runState.executedCount})` : ""}
          {runState.requestId ? ` (request_id: ${runState.requestId})` : ""}
        </p>
      ) : null}

      {list.length > 0 ? (
        <div className="mt-2 max-h-44 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
          <p className="mb-1 text-[11px] font-semibold text-slate-600">would list (최대 50건)</p>
          <ul className="space-y-1 text-[11px] text-slate-700">
            {list.map((row) => (
              <li key={row.id} className="rounded border border-slate-200 bg-white px-2 py-1">
                {row.targetType}:{row.targetId} · {row.reason || "(사유 없음)"} · {formatDate(row.createdAt)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
