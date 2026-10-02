"use client";

import { useEffect, useMemo, useState } from "react";

import CardTile from "@/app/_components/CardTile";
import { buttonTone, cn, pill } from "@/app/_components/uiTokens";

import {
  createFlowId,
  createFlowStepId,
  type Flow,
  type FlowStep,
  type FlowStepTarget,
} from "../flows";
import type { ClassPreset } from "../presets";

const targetOptions: Array<{ value: FlowStepTarget; label: string }> = [
  { value: "class", label: "수업" },
  { value: "share", label: "학생" },
  { value: "present", label: "발표" },
];

type FlowBuilderProps = {
  flows: Flow[];
  presets: ClassPreset[];
  boardId: string | null;
  boardTitle?: string | null;
  activeFlowId: string | null;
  onSaveFlow: (flow: Flow) => void;
  onDeleteFlow: (flowId: string) => void;
  onDuplicateFlow: (flowId: string) => Flow | null;
  onSetActiveFlow: (boardId: string, flowId: string | null) => void;
};

const formatAutoNext = (value: number | undefined) => {
  if (!value || Number.isNaN(value)) return "";
  return String(Math.max(0, value));
};

const formatSeconds = (value: number | undefined) => {
  if (value === undefined || Number.isNaN(value)) return "";
  return String(Math.max(0, value));
};

const compactActions = (actions: FlowStep["actions"] | undefined) => {
  if (!actions) return undefined;
  const hasQa = Boolean(actions.qa);
  const hasPulse = Boolean(actions.pulse);
  const hasPoll = Boolean(actions.poll?.mode);
  if (!hasQa && !hasPulse && !hasPoll) return undefined;
  return {
    ...actions,
    poll: actions.poll?.mode ? actions.poll : undefined,
  };
};

export default function FlowBuilder({
  flows,
  presets,
  boardId,
  boardTitle,
  activeFlowId,
  onSaveFlow,
  onDeleteFlow,
  onDuplicateFlow,
  onSetActiveFlow,
}: FlowBuilderProps) {
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(flows[0]?.id ?? null);

  useEffect(() => {
    if (!selectedFlowId && flows[0]) {
      setSelectedFlowId(flows[0].id);
      return;
    }
    if (selectedFlowId && flows.every((flow) => flow.id !== selectedFlowId)) {
      setSelectedFlowId(flows[0]?.id ?? null);
    }
  }, [flows, selectedFlowId]);

  const selectedFlow = useMemo(
    () => flows.find((flow) => flow.id === selectedFlowId) ?? null,
    [flows, selectedFlowId],
  );

  const flowUpdatedLabel = useMemo(() => {
    if (!selectedFlow?.updatedAt) return "";
    return new Date(selectedFlow.updatedAt).toLocaleString("ko-KR");
  }, [selectedFlow?.updatedAt]);

  const activeForBoard = boardId && activeFlowId && selectedFlow?.id === activeFlowId;

  const handleCreateFlow = () => {
    const nextFlow: Flow = {
      id: createFlowId(),
      name: "새 수업 플로우",
      steps: [],
      updatedAt: Date.now(),
    };
    onSaveFlow(nextFlow);
    setSelectedFlowId(nextFlow.id);
    if (boardId && !activeFlowId) {
      onSetActiveFlow(boardId, nextFlow.id);
    }
  };

  const handleRename = (name: string) => {
    if (!selectedFlow) return;
    onSaveFlow({ ...selectedFlow, name });
  };

  const confirmDeleteFlow = () => {
    if (!selectedFlow) return false;
    if (!window.confirm("플로우를 삭제할까요?")) return false;
    const response = window.prompt("삭제를 계속하려면 DELETE를 입력해 주세요.");
    if (!response) return false;
    return response.trim().toUpperCase() === "DELETE";
  };

  const handleDeleteFlow = () => {
    if (!selectedFlow) return;
    if (!confirmDeleteFlow()) return;
    onDeleteFlow(selectedFlow.id);
    if (boardId && activeFlowId === selectedFlow.id) {
      onSetActiveFlow(boardId, null);
    }
  };

  const handleDuplicate = () => {
    if (!selectedFlow) return;
    const copy = onDuplicateFlow(selectedFlow.id);
    if (copy) {
      setSelectedFlowId(copy.id);
    }
  };

  const handleToggleDefault = () => {
    if (!boardId || !selectedFlow) return;
    if (activeForBoard) {
      onSetActiveFlow(boardId, null);
    } else {
      onSetActiveFlow(boardId, selectedFlow.id);
    }
  };

  const presetsByTarget = useMemo(() => {
    return targetOptions.reduce<Record<FlowStepTarget, ClassPreset[]>>((acc, option) => {
      acc[option.value] = presets.filter((preset) => preset.target === option.value);
      return acc;
    }, {} as Record<FlowStepTarget, ClassPreset[]>);
  }, [presets]);

  const handleUpdateStep = (index: number, patch: Partial<FlowStep>) => {
    if (!selectedFlow) return;
    const steps = selectedFlow.steps.map((step, stepIndex) =>
      stepIndex === index ? { ...step, ...patch } : step,
    );
    onSaveFlow({ ...selectedFlow, steps });
  };

  const handleAddStep = () => {
    if (!selectedFlow) return;
    const defaultTarget: FlowStepTarget = "class";
    const preset = presetsByTarget[defaultTarget][0] ?? presets[0];
    const nextStep: FlowStep = {
      id: createFlowStepId(),
      label: preset?.name ?? "새 단계",
      presetId: preset?.id ?? "",
      target: preset?.target ?? defaultTarget,
    };
    onSaveFlow({ ...selectedFlow, steps: [...selectedFlow.steps, nextStep] });
  };

  const handleRemoveStep = (index: number) => {
    if (!selectedFlow) return;
    const steps = selectedFlow.steps.filter((_, stepIndex) => stepIndex !== index);
    onSaveFlow({ ...selectedFlow, steps });
  };

  const handleMoveStep = (index: number, direction: "up" | "down") => {
    if (!selectedFlow) return;
    const next = [...selectedFlow.steps];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    onSaveFlow({ ...selectedFlow, steps: next });
  };

  return (
    <CardTile variant="dense" className="border-slate-200 bg-white">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Flow Builder</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">수업 플로우 제작실</h2>
            <p className="text-sm text-slate-600">프리셋을 조합해 단계별 수업 플레이리스트를 만드세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCreateFlow}
              data-interactive="true"
              className={cn(buttonTone("primary", { size: "md", tone: "indigo" }), "min-h-[44px]")}
            >
              새 플로우
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={!selectedFlow}
              data-interactive="true"
              className={cn(buttonTone("secondary", { size: "md" }), "min-h-[44px]")}
            >
              복제
            </button>
            <button
              type="button"
              onClick={handleDeleteFlow}
              disabled={!selectedFlow}
              data-interactive="true"
              className={cn(buttonTone("secondary", { size: "md" }), "min-h-[44px] border-rose-200 text-rose-600")}
            >
              삭제
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Flow List</p>
              <div className="mt-3 space-y-2">
                {flows.length === 0 ? (
                  <p className="text-sm text-slate-500">아직 플로우가 없습니다.</p>
                ) : (
                  flows.map((flow) => (
                    <button
                      key={flow.id}
                      type="button"
                      onClick={() => setSelectedFlowId(flow.id)}
                      data-interactive="true"
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition",
                        flow.id === selectedFlowId
                          ? "border-indigo-500 bg-indigo-600 text-white"
                          : "border-slate-200 bg-white text-slate-900 hover:bg-slate-100",
                      )}
                    >
                      <span>{flow.name}</span>
                      <span className={cn("text-xs font-medium", flow.id === selectedFlowId ? "text-white/80" : "text-slate-500")}>
                        단계 {flow.steps.length}개
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Board Default</p>
              <div className="mt-3 space-y-2">
                <p className="text-sm font-semibold text-slate-900">{boardTitle ?? "보드 선택 필요"}</p>
                <button
                  type="button"
                  onClick={handleToggleDefault}
                  disabled={!boardId || !selectedFlow}
                  data-interactive="true"
                  className={cn(
                    "flex min-h-[44px] w-full items-center justify-between rounded-xl border px-3 text-sm font-semibold transition",
                    activeForBoard
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700",
                  )}
                >
                  <span>이 보드 기본 플로우</span>
                  <span className={cn(pill.badge, activeForBoard ? "bg-white/20 text-white" : "bg-white text-slate-600")}
                  >
                    {activeForBoard ? "적용" : "미적용"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {selectedFlow ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Flow Settings</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">플로우 이름</p>
                  </div>
                  <span className="text-xs text-slate-500">최근 수정: {flowUpdatedLabel || "-"}</span>
                </div>
                <input
                  value={selectedFlow.name}
                  onChange={(event) => handleRename(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                플로우를 선택하거나 새 플로우를 만들어 주세요.
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Steps</p>
                  <p className="mt-2 text-sm text-slate-600">단계를 추가하고 순서를 조정하세요.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddStep}
                  disabled={!selectedFlow}
                  data-interactive="true"
                  className={cn(buttonTone("secondary", { size: "md" }), "min-h-[44px]")}
                >
                  단계 추가
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {selectedFlow?.steps.length ? (
                  selectedFlow.steps.map((step, index) => {
                    const targetPresets = presetsByTarget[step.target] ?? [];
                    const preset = targetPresets.find((item) => item.id === step.presetId) ?? null;
                    return (
                      <div key={step.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                              {index + 1}
                            </span>
                            <input
                              value={step.label}
                              onChange={(event) => handleUpdateStep(index, { label: event.target.value })}
                              className="min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleMoveStep(index, "up")}
                              disabled={index === 0}
                              data-interactive="true"
                              className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
                            >
                              ↑ 위로
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStep(index, "down")}
                              disabled={index === (selectedFlow?.steps.length ?? 1) - 1}
                              data-interactive="true"
                              className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px]")}
                            >
                              ↓ 아래로
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(index)}
                              data-interactive="true"
                              className={cn(buttonTone("secondary", { size: "sm" }), "min-h-[40px] border-rose-200 text-rose-600")}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-[160px_1fr]">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">대상</label>
                            <select
                              value={step.target}
                              onChange={(event) => {
                                const nextTarget = event.target.value as FlowStepTarget;
                                const nextPreset = presetsByTarget[nextTarget]?.[0] ?? presets[0];
                                handleUpdateStep(index, {
                                  target: nextTarget,
                                  presetId: nextPreset?.id ?? "",
                                  label: step.label || nextPreset?.name || step.label,
                                });
                              }}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                            >
                              {targetOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">프리셋</label>
                            <select
                              value={step.presetId}
                              onChange={(event) => handleUpdateStep(index, { presetId: event.target.value })}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                            >
                              {targetPresets.length === 0 ? (
                                <option value="">사용 가능한 프리셋 없음</option>
                              ) : (
                                targetPresets.map((presetOption) => (
                                  <option key={presetOption.id} value={presetOption.id}>
                                    {presetOption.name}
                                  </option>
                                ))
                              )}
                            </select>
                            <p className="text-xs text-slate-500">
                              {preset ? `현재 선택: ${preset.name}` : "프리셋을 선택하세요."}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">노트</label>
                            <textarea
                              value={step.note ?? ""}
                              onChange={(event) => handleUpdateStep(index, { note: event.target.value })}
                              rows={2}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">자동 다음 (ms)</label>
                            <input
                              type="number"
                              min={0}
                              value={formatAutoNext(step.autoNextAfterMs)}
                              onChange={(event) =>
                                handleUpdateStep(index, {
                                  autoNextAfterMs: event.target.value
                                    ? Number(event.target.value)
                                    : undefined,
                                })
                              }
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                            />
                            <p className="text-xs text-slate-500">비워두면 자동 진행하지 않습니다.</p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_0.6fr]">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">스텝 제목 (Present/HUD)</label>
                            <input
                              value={step.title ?? ""}
                              onChange={(event) => handleUpdateStep(index, { title: event.target.value })}
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                              placeholder="예: 질문 집중 시간"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">타이머 (초)</label>
                            <input
                              type="number"
                              min={0}
                              max={3600}
                              value={formatSeconds(step.seconds)}
                              onChange={(event) =>
                                handleUpdateStep(index, {
                                  seconds: event.target.value ? Number(event.target.value) : undefined,
                                })
                              }
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                              placeholder="0이면 숨김"
                            />
                            <p className="text-xs text-slate-500">0이면 타이머를 숨깁니다.</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <label className="text-xs font-semibold text-slate-600">학생 안내문 (줄바꿈 가능)</label>
                          <textarea
                            value={step.prompt ?? ""}
                            onChange={(event) => handleUpdateStep(index, { prompt: event.target.value })}
                            rows={3}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                            placeholder="예: 5분 동안 조용히 정리하고 질문을 적어주세요."
                          />
                        </div>
                        <div className="mt-3 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Step Actions
                          </p>
                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="space-y-2 text-xs font-semibold text-slate-600">
                              Q&amp;A
                              <select
                                value={step.actions?.qa ?? "none"}
                                onChange={(event) => {
                                  const value = event.target.value as "none" | "open" | "close";
                                  const nextActions = compactActions({
                                    ...step.actions,
                                    qa: value === "none" ? undefined : value,
                                  });
                                  handleUpdateStep(index, { actions: nextActions });
                                }}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                              >
                                <option value="none">없음</option>
                                <option value="open">열기</option>
                                <option value="close">닫기</option>
                              </select>
                            </label>
                            <label className="space-y-2 text-xs font-semibold text-slate-600">
                              Pulse
                              <select
                                value={step.actions?.pulse ?? "none"}
                                onChange={(event) => {
                                  const value = event.target.value as "none" | "reset";
                                  const nextActions = compactActions({
                                    ...step.actions,
                                    pulse: value === "none" ? undefined : "reset",
                                  });
                                  handleUpdateStep(index, { actions: nextActions });
                                }}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                              >
                                <option value="none">없음</option>
                                <option value="reset">리셋</option>
                              </select>
                            </label>
                            <label className="space-y-2 text-xs font-semibold text-slate-600">
                              Poll
                              <select
                                value={step.actions?.poll?.mode ?? "none"}
                                onChange={(event) => {
                                  const value = event.target.value as "none" | "open" | "close";
                                  const nextPoll = value === "none"
                                    ? undefined
                                    : {
                                        mode: value,
                                        pollId: step.actions?.poll?.pollId ?? "",
                                      };
                                  const nextActions = compactActions({
                                    ...step.actions,
                                    poll: nextPoll,
                                  });
                                  handleUpdateStep(index, { actions: nextActions });
                                }}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                              >
                                <option value="none">없음</option>
                                <option value="open">열기</option>
                                <option value="close">닫기</option>
                              </select>
                            </label>
                          </div>
                          {step.actions?.poll?.mode ? (
                            <label className="space-y-2 text-xs font-semibold text-slate-600">
                              Poll ID (비워두면 최근/현재 투표)
                              <input
                                value={step.actions?.poll?.pollId ?? ""}
                                onChange={(event) => {
                                  const pollMode = step.actions?.poll?.mode ?? "open";
                                  const nextActions = compactActions({
                                    ...step.actions,
                                    poll: { mode: pollMode, pollId: event.target.value },
                                  });
                                  handleUpdateStep(index, { actions: nextActions });
                                }}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                                placeholder="UUID"
                              />
                            </label>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    단계가 없습니다. “단계 추가”를 눌러 주세요.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CardTile>
  );
}
