"use client";

import { useMemo, useState } from "react";

import {
  LESSON_ACTIVITY_DEFINITIONS,
  LESSON_TEMPLATES,
  type LessonTemplate,
} from "@/lib/lesson-activities/registry";
import type { ActiveLessonSession } from "@/lib/lesson-activities/types";
import { routes } from "@/lib/standards/routes";
import {
  AiBingoActivityPlaceholder,
  AiJudgmentSortActivityPlaceholder,
  WebCodingLitePlaceholder,
} from "./ActivityPlaceholders";

function ActivityPreview({ activityType }: { activityType: string }) {
  if (activityType === "ai_bingo") return <AiBingoActivityPlaceholder compact />;
  if (activityType === "ai_judgment_sort") return <AiJudgmentSortActivityPlaceholder compact />;
  if (activityType === "web_coding_lite") return <WebCodingLitePlaceholder compact />;
  return null;
}

type LessonActivityLauncherProps = {
  boardId: string;
  initialActiveSession: ActiveLessonSession | null;
};

type LessonSessionResponse = {
  ok: boolean;
  data?: ActiveLessonSession | null;
  error?: { message?: string };
};

function formatLauncherError(prefix: string, error: unknown) {
  const serverMessage = error instanceof Error ? error.message : "";
  return serverMessage ? `${prefix} ${serverMessage}` : prefix;
}

export default function LessonActivityLauncher({ boardId, initialActiveSession }: LessonActivityLauncherProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<LessonTemplate["id"]>(
    initialActiveSession?.templateId ?? LESSON_TEMPLATES[0].id,
  );
  const [activeSession, setActiveSession] = useState<ActiveLessonSession | null>(initialActiveSession);
  const [pendingAction, setPendingAction] = useState<"start" | "end" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedTemplate = useMemo(
    () => LESSON_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? LESSON_TEMPLATES[0],
    [selectedTemplateId],
  );

  const endpoint = routes.api.boards.byId(boardId, "lesson-session");

  async function readJson(response: Response): Promise<LessonSessionResponse> {
    const payload = (await response.json().catch(() => null)) as LessonSessionResponse | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error?.message ?? "수업 실습 상태를 변경하지 못했습니다.");
    }
    return payload;
  }

  async function startSelectedTemplate() {
    if (pendingAction || activeSession?.templateId === selectedTemplate.id) return;
    setPendingAction("start");
    setErrorMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonTemplateId: selectedTemplate.id }),
      });
      const payload = await readJson(response);
      setActiveSession(payload.data ?? null);
    } catch (error) {
      setErrorMessage(formatLauncherError("수업 실습을 시작하지 못했어요.", error));
    } finally {
      setPendingAction(null);
    }
  }

  async function endActiveSession() {
    if (pendingAction || !activeSession) return;
    setPendingAction("end");
    setErrorMessage(null);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      await readJson(response);
      setActiveSession(null);
    } catch (error) {
      setErrorMessage(formatLauncherError("수업 실습을 종료하지 못했어요.", error));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section
      data-testid="lesson-activity-launcher"
      className="hud-card-shell rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-[var(--theme-text)] shadow-[0_18px_48px_rgba(8,47,73,0.22)]"
      aria-label="수업 실습 시작"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--theme-accent)]">Lesson practice OS</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[var(--theme-text)]">수업 실습 시작</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">
            보드에서 실습을 시작하면 학생은 기존 입장 코드로 오늘의 실습을 볼 수 있습니다.
          </p>
        </div>
        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold ${activeSession ? "border-emerald-200/40 bg-emerald-300/10 text-emerald-100" : "border-[var(--theme-border)] bg-[var(--theme-surface-muted)] text-[var(--theme-text-muted)]"}`}>
          {activeSession ? "진행 중" : "대기"}
        </span>
      </div>

      {activeSession ? (
        <div className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3">
          <p className="text-xs font-semibold text-emerald-100">학생 화면에 표시 중</p>
          <p className="mt-1 text-sm font-semibold text-[var(--theme-text)]">{activeSession.title}</p>
          <button
            type="button"
            onClick={() => void endActiveSession()}
            disabled={pendingAction !== null}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-rose-200/30 bg-rose-300/10 px-3 py-2 text-sm font-semibold text-rose-50 transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "end" ? "종료 중..." : "수업 실습 종료"}
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {LESSON_TEMPLATES.map((template, index) => {
          const selected = template.id === selectedTemplate.id;
          const active = activeSession?.templateId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelectedTemplateId(template.id)}
              className={`rounded-xl border px-3 py-3 text-left transition ${selected ? "border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] text-[var(--theme-text)]" : "border-[var(--theme-border)] bg-[var(--theme-card-muted)] text-[var(--theme-text)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-card-muted)]"}`}
              aria-pressed={selected}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span>{template.title}</span>
                {active ? <span className="rounded-full bg-emerald-300/15 px-2 py-0.5 text-[10px] text-emerald-100">진행 중</span> : null}
              </span>
              <span className="mt-1 block text-xs leading-5 text-[var(--theme-text-muted)]">{template.summary}</span>
              {!activeSession ? (
                <span className="mt-2 inline-flex rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--theme-text-muted)]">
                  {index + 1}차시 시작
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void startSelectedTemplate()}
        disabled={pendingAction !== null || activeSession?.templateId === selectedTemplate.id}
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[var(--theme-accent)] px-3 py-2 text-sm font-semibold text-[var(--theme-accent-text)] shadow-lg shadow-cyan-950/25 transition hover:bg-[var(--theme-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendingAction === "start" ? "시작 중..." : activeSession ? "선택한 실습으로 새로 시작" : "시작"}
      </button>

      {errorMessage ? (
        <p role="alert" className="mt-3 rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-xs leading-5 text-rose-100">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] p-3">
        <p className="text-xs font-semibold text-[var(--theme-text)]">선택된 템플릿 활동</p>
        <div className="mt-3 grid gap-2">
          {selectedTemplate.activities.map((activity) => {
            const definition = activity.activityType ? LESSON_ACTIVITY_DEFINITIONS[activity.activityType] : null;
            return (
              <div key={activity.key} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--theme-text)]">{activity.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--theme-text-subtle)]">
                      {definition?.description ?? "파이썬 첫 실행과 코드 읽기 흐름을 연결할 자리입니다."}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
                    {activity.status}
                  </span>
                </div>
                {activity.activityType ? <div className="mt-2"><ActivityPreview activityType={activity.activityType} /></div> : null}
              </div>
            );
          })}
        </div>
        <p className="mt-3 rounded-lg border border-amber-200/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
          AI 빙고, AI 판단 카드 분류, 웹 코딩 실습은 학생별 진행 상태를 기존 활동 상태 저장소에 기록합니다.
        </p>
      </div>
    </section>
  );
}
