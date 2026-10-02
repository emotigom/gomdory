"use client";

import { useActionState } from "react";

import { runRetentionAction, runRetentionDryRunAction } from "./actions";

type ActionState = {
  ok: boolean;
  message: string;
  requestId: string;
};

const INITIAL_STATE: ActionState = { ok: false, message: "", requestId: "" };

export default function RetentionRunButtons() {
  const [runState, runFormAction, runPending] = useActionState(runRetentionAction, INITIAL_STATE);
  const [dryRunState, dryRunFormAction, dryRunPending] = useActionState(runRetentionDryRunAction, INITIAL_STATE);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <form action={runFormAction}>
          <button
            type="submit"
            disabled={runPending || dryRunPending}
            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runPending ? "실행 중…" : "보존 작업 실행"}
          </button>
        </form>
        <form action={dryRunFormAction}>
          <button
            type="submit"
            disabled={runPending || dryRunPending}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dryRunPending ? "드라이런 중…" : "드라이런 실행"}
          </button>
        </form>
      </div>
      {runState.message ? (
        <p className={`text-xs ${runState.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {runState.message}
          {runState.requestId ? ` (request_id: ${runState.requestId})` : ""}
        </p>
      ) : null}
      {!runState.message && dryRunState.message ? (
        <p className={`text-xs ${dryRunState.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {dryRunState.message}
          {dryRunState.requestId ? ` (request_id: ${dryRunState.requestId})` : ""}
        </p>
      ) : null}
    </div>
  );
}
