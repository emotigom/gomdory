"use client";

import { useActionState } from "react";

import {
  executeResetUserUiPrefsByOpsAction,
  previewResetUserUiPrefsByOpsAction,
} from "./actions";

type Props = {
  userId: string;
};

type ActionState = {
  ok: boolean;
  message: string;
  requestId: string;
  wouldClear?: { hasTeacherUiPrefs: boolean; presetCount: number };
  requiresConfirmation?: boolean;
  confirmToken?: string;
};

const INITIAL_STATE: ActionState = {
  ok: false,
  message: "",
  requestId: "",
};

export default function ResetUiPrefsButton({ userId }: Props) {
  const [previewState, previewAction, previewPending] = useActionState(previewResetUserUiPrefsByOpsAction, INITIAL_STATE);
  const [executeState, executeAction, executePending] = useActionState(executeResetUserUiPrefsByOpsAction, INITIAL_STATE);

  return (
    <div className="dashboard-ops-card min-w-0 space-y-2 rounded-lg border border-rose-200 bg-rose-50/40 p-2">
      <p className="text-xs font-semibold text-rose-700">User 조치 assistant: Clear UI prefs + presets</p>
      <p className="text-[11px] text-rose-700/90">OPS_AUTOMATION_STANDARD: preview → confirm → execute</p>
      <div className="flex flex-wrap gap-2">
        <form action={previewAction}>
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            className="dashboard-ops-control rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-60"
            disabled={previewPending || executePending}
          >
            {previewPending ? "preview 생성 중..." : "preview"}
          </button>
        </form>
        <form action={executeAction}>
          <input type="hidden" name="confirmToken" value={previewState.confirmToken ?? ""} />
          <button
            type="submit"
            className="dashboard-ops-control rounded-md border border-rose-300 bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800 disabled:opacity-60"
            disabled={!previewState.confirmToken || previewPending || executePending}
          >
            {executePending ? "execute 중..." : "confirm + execute"}
          </button>
        </form>
      </div>

      {previewState.wouldClear ? (
        <p className="break-words text-[11px] text-slate-700">
          would-clear: teacherUiPrefs={previewState.wouldClear.hasTeacherUiPrefs ? "yes" : "no"}, presets={previewState.wouldClear.presetCount}
        </p>
      ) : null}

      {previewState.message ? (
        <p className={`break-words text-xs ${previewState.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {previewState.message} (request_id: {previewState.requestId || "n/a"})
        </p>
      ) : null}

      {executeState.message ? (
        <p className={`break-words text-xs ${executeState.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {executeState.message} (request_id: {executeState.requestId || "n/a"})
        </p>
      ) : null}
    </div>
  );
}
