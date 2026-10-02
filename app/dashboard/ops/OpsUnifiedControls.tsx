"use client";

import { useMemo, useState, useTransition } from "react";
import { useFormState } from "react-dom";

import type { UiMinimapMode } from "@/lib/data/boards";
import { TOOL_DEFS } from "@/lib/tools/toolsRegistry";

import {
  approveOwnershipRequestAction,
  updateOpsBoardSettingsAction,
  updateOpsDefaultsAction,
  type OpsFormState,
} from "./actions";

const MINIMAP_MODES: Array<{ value: UiMinimapMode; label: string }> = [
  { value: "hover", label: "Hover" },
  { value: "toggle", label: "Toggle" },
  { value: "always", label: "Always" },
  { value: "hidden", label: "Hidden" },
];

const initialFormState: OpsFormState = { success: false };

type OwnershipRequestItem = {
  id: string;
  boardId: string;
  shareCode: string | null;
  studentName: string;
  clientId: string;
  createdAt: string;
};

export default function OpsUnifiedControls({
  ownershipRequests,
}: {
  ownershipRequests: OwnershipRequestItem[];
}) {
  const [defaultsState, defaultsAction] = useFormState(updateOpsDefaultsAction, initialFormState);
  const [boardState, boardAction] = useFormState(updateOpsBoardSettingsAction, initialFormState);
  const [requests, setRequests] = useState(ownershipRequests);
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toolOptions = useMemo(() => TOOL_DEFS.filter((tool) => tool.status === "active"), []);

  const handleApprove = (requestId: string) => {
    setApprovalNotice(null);
    setApprovalError(null);
    startTransition(async () => {
      const result = await approveOwnershipRequestAction(requestId);
      if (!result.success) {
        setApprovalError(result.error ?? "요청 승인에 실패했습니다.");
        return;
      }
      setRequests((prev) => prev.filter((item) => item.id !== requestId));
      setApprovalNotice(
        typeof result.updatedCardCount === "number"
          ? `승인 완료: ${result.updatedCardCount}장의 카드가 복구되었습니다.`
          : "승인 완료",
      );
    });
  };

  return (
    <div className="space-y-12">
      <section className="border-b border-slate-200 pb-10">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Defaults</p>
          <h2 className="text-xl font-semibold text-slate-900">교사 기본값 관리</h2>
          <p className="text-sm text-slate-500">
            교사 계정의 기본 미니맵, 섹션 너비, 도구 설정을 한 번에 업데이트합니다.
          </p>
        </div>
        <form action={defaultsAction} className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-[260px,1fr]">
            <label className="text-sm font-semibold text-slate-700">Teacher User ID</label>
            <input
              name="userId"
              placeholder="uuid"
              className="w-full border-b border-slate-200 bg-transparent px-1 py-2 text-sm text-slate-700 outline-none focus:border-slate-500"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-[260px,1fr]">
            <span className="text-sm font-semibold text-slate-700">기본 미니맵 모드</span>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              {MINIMAP_MODES.map((mode) => (
                <label key={mode.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="defaultMinimapMode"
                    value={mode.value}
                    defaultChecked={mode.value === "hover"}
                    className="h-4 w-4 accent-slate-700"
                  />
                  {mode.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[260px,1fr]">
            <label className="text-sm font-semibold text-slate-700">기본 섹션 폭(px)</label>
            <input
              type="number"
              name="defaultWallWidthPx"
              min={360}
              max={960}
              defaultValue={360}
              className="w-full border-b border-slate-200 bg-transparent px-1 py-2 text-sm text-slate-700 outline-none focus:border-slate-500"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-[260px,1fr]">
            <span className="text-sm font-semibold text-slate-700">기본 도구</span>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              {toolOptions.map((tool) => (
                <label key={tool.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="defaultToolsEnabled"
                    value={tool.id}
                    className="h-4 w-4 accent-slate-700"
                  />
                  {tool.label}
                </label>
              ))}
            </div>
          </div>
          {defaultsState.error ? (
            <p className="text-sm text-rose-600">{defaultsState.error}</p>
          ) : null}
          {defaultsState.success ? (
            <p className="text-sm text-emerald-600">{defaultsState.message ?? "저장 완료"}</p>
          ) : null}
          <button
            type="submit"
            className="inline-flex items-center border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
          >
            기본값 저장
          </button>
        </form>
      </section>

      <section className="border-b border-slate-200 pb-10">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Board Settings</p>
          <h2 className="text-xl font-semibold text-slate-900">보드별 설정</h2>
          <p className="text-sm text-slate-500">보드 미니맵 모드와 도구 토글을 운영자가 직접 제어합니다.</p>
        </div>
        <form action={boardAction} className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-[260px,1fr]">
            <label className="text-sm font-semibold text-slate-700">Board ID</label>
            <input
              name="boardId"
              placeholder="uuid"
              className="w-full border-b border-slate-200 bg-transparent px-1 py-2 text-sm text-slate-700 outline-none focus:border-slate-500"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-[260px,1fr]">
            <span className="text-sm font-semibold text-slate-700">미니맵 모드</span>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              {MINIMAP_MODES.map((mode) => (
                <label key={mode.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="minimapMode"
                    value={mode.value}
                    defaultChecked={mode.value === "hover"}
                    className="h-4 w-4 accent-slate-700"
                  />
                  {mode.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[260px,1fr]">
            <span className="text-sm font-semibold text-slate-700">도구 활성화</span>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              {toolOptions.map((tool) => (
                <label key={tool.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="toolsEnabled"
                    value={tool.id}
                    className="h-4 w-4 accent-slate-700"
                  />
                  {tool.label}
                </label>
              ))}
            </div>
          </div>
          {boardState.error ? (
            <p className="text-sm text-rose-600">{boardState.error}</p>
          ) : null}
          {boardState.success ? (
            <p className="text-sm text-emerald-600">{boardState.message ?? "저장 완료"}</p>
          ) : null}
          <button
            type="submit"
            className="inline-flex items-center border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
          >
            보드 설정 저장
          </button>
        </form>
      </section>

      <section>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ownership Requests</p>
          <h2 className="text-xl font-semibold text-slate-900">소유권 복구 요청</h2>
          <p className="text-sm text-slate-500">대기 중인 요청을 확인하고 바로 승인할 수 있습니다.</p>
        </div>
        <div className="mt-6 space-y-4">
          {requests.length === 0 ? (
            <p className="text-sm text-slate-400">현재 대기 중인 요청이 없습니다.</p>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200">
              {requests.map((request) => (
                <div key={request.id} className="grid gap-2 px-4 py-3 md:grid-cols-[1.2fr,1.2fr,1fr,auto]">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{request.studentName}</p>
                    <p className="text-xs text-slate-400">{new Date(request.createdAt).toLocaleString("ko-KR")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Client ID</p>
                    <p className="text-sm font-mono text-slate-700">{request.clientId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Board</p>
                    <p className="text-sm font-mono text-slate-700">{request.boardId}</p>
                    {request.shareCode ? (
                      <p className="text-xs text-slate-400">/{request.shareCode}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleApprove(request.id)}
                      disabled={isPending}
                      className="border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
                    >
                      {isPending ? "승인 중" : "승인"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {approvalError ? <p className="text-sm text-rose-600">{approvalError}</p> : null}
          {approvalNotice ? <p className="text-sm text-emerald-600">{approvalNotice}</p> : null}
        </div>
      </section>
    </div>
  );
}
