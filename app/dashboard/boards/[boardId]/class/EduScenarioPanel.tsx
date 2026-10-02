"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/http/apiFetch";
import { apiV1Path } from "@/lib/standards/pathTypes";
import { getScenarioSteps, type LessonId, type ScenarioStep } from "@/lib/edu/scenario";

type ScenarioPanelProps = {
  boardId: string;
};

type ScenarioStorage = {
  lessonId: LessonId;
  stepIndex: number;
};

type BroadcastResponse = { ok?: boolean; error?: { message?: string } } | null;

const LESSON_OPTIONS: { value: LessonId; label: string }[] = [
  { value: 1, label: "1교시" },
  { value: 2, label: "2교시" },
  { value: 3, label: "3교시" },
  { value: 4, label: "4교시" },
];

function getStorageKey(boardId: string) {
  return `edu:scenario:${boardId}`;
}

function clampIndex(index: number, steps: ScenarioStep[]) {
  if (steps.length === 0) return -1;
  if (index < -1) return -1;
  if (index >= steps.length) return steps.length - 1;
  return index;
}

export default function EduScenarioPanel({ boardId }: ScenarioPanelProps) {
  const [lessonId, setLessonId] = useState<LessonId>(1);
  const [stepIndex, setStepIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo(() => getScenarioSteps(lessonId), [lessonId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(getStorageKey(boardId));
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ScenarioStorage;
      if (parsed.lessonId) {
        setLessonId(parsed.lessonId);
      }
      if (typeof parsed.stepIndex === "number") {
        const initialSteps = getScenarioSteps(parsed.lessonId ?? 1);
        setStepIndex(clampIndex(parsed.stepIndex, initialSteps));
      }
    } catch {
      window.localStorage.removeItem(getStorageKey(boardId));
    }
  }, [boardId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: ScenarioStorage = {
      lessonId,
      stepIndex: clampIndex(stepIndex, steps),
    };
    window.localStorage.setItem(getStorageKey(boardId), JSON.stringify(payload));
  }, [boardId, lessonId, stepIndex, steps]);

  const sendScenarioStep = useCallback(
    async (nextIndex: number) => {
      if (!steps[nextIndex]) return;
      setLoading(true);
      setError(null);
      setStatusMessage(null);
      try {
        const step = steps[nextIndex];
        const response = await apiFetch(apiV1Path("edu/broadcast"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            boardId,
            message: step.message,
            ctaType: step.ctaType,
            ctaLabel: step.ctaType === "none" ? undefined : step.ctaLabel,
          }),
        });
        const payload = (await response.json().catch(() => null)) as BroadcastResponse;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error?.message ?? "안내 전송에 실패했습니다.");
        }
        setStepIndex(nextIndex);
        setStatusMessage("안내를 보냈습니다.");
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "안내 전송에 실패했습니다.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [boardId, steps],
  );

  const handleStart = useCallback(() => {
    void sendScenarioStep(0);
  }, [sendScenarioStep]);

  const handleNext = useCallback(() => {
    if (steps.length === 0) return;
    const nextIndex = (stepIndex + 1 + steps.length) % steps.length;
    void sendScenarioStep(nextIndex);
  }, [sendScenarioStep, stepIndex, steps.length]);

  const handlePrev = useCallback(() => {
    if (steps.length === 0) return;
    const prevIndex = stepIndex < 0 ? steps.length - 1 : (stepIndex - 1 + steps.length) % steps.length;
    void sendScenarioStep(prevIndex);
  }, [sendScenarioStep, stepIndex, steps.length]);

  const handleClear = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await apiFetch(apiV1Path("edu/broadcast/clear"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId }),
      });
      const payload = (await response.json().catch(() => null)) as BroadcastResponse;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "안내 지우기에 실패했습니다.");
      }
      setStatusMessage("안내를 지웠습니다.");
      setStepIndex(-1);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "안내 지우기에 실패했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  const handleLessonChange = useCallback(
    (value: LessonId) => {
      setLessonId(value);
      setStepIndex(-1);
      setStatusMessage(null);
      setError(null);
    },
    [],
  );

  const stepStatus = stepIndex >= 0 ? `${stepIndex + 1}/${steps.length}` : "-";

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-800">시나리오 안내</p>
        <p className="text-[11px] text-slate-400">한 번의 클릭으로 미리 준비된 안내를 보냅니다.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={lessonId}
          onChange={(event) => handleLessonChange(Number(event.target.value) as LessonId)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
        >
          {LESSON_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-slate-400">현재 안내: {stepStatus}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={loading}
          className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-400"
        >
          {lessonId}교시 시작 안내 보내기
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          다음 안내
        </button>
        <button
          type="button"
          onClick={handlePrev}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          이전 안내
        </button>
        <button
          type="button"
          onClick={() => void handleClear()}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          안내 지우기
        </button>
      </div>
      {statusMessage ? <p className="text-xs font-semibold text-emerald-600">{statusMessage}</p> : null}
      {error ? <p className="text-xs font-semibold text-rose-500">{error}</p> : null}
    </div>
  );
}
