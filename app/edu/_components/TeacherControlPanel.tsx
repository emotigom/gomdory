"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import PawToggleIcon from "@/components/icons/PawToggleIcon";
import type { LessonId, LessonLock } from "@/lib/edu/lesson/lessonLock";
import { getFailureTopK, type EduMetricsSummary } from "@/lib/edu/telemetry/eduSessionMetrics";

export type TeacherControlPanelStatus = {
  coachRunning: boolean;
  genRunning: boolean;
  dirty: boolean;
  lastApplyTs?: number;
  lastCodeHash?: string;
};

export type TeacherControlPanelProps = {
  isTeacherMode: boolean;
  lessonLock: LessonLock;
  metricsSummary: EduMetricsSummary;
  onSetLessonId: (id: LessonId) => void;
  onToggleLessonLock: (next: boolean) => void;
  onHardReset: () => void;
  onResetEngine: () => void;
  onAbortAll: () => void;
  onExportDiagnostics: () => void;
  onWarmupWebLLM: () => void;
  autosaveEnabled: boolean;
  onToggleAutosave: (next: boolean) => void;
  undoEnabled: boolean;
  redoEnabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  presentationMode: boolean;
  onTogglePresentationMode: (next: boolean) => void;
  status: TeacherControlPanelStatus;
};

const IconButton = ({
  children,
  title,
  onClick,
  disabled,
  active,
  ariaLabel,
}: {
  children: ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  ariaLabel: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    title={title}
    className={`flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-40 ${
      active ? "text-emerald-500" : ""
    }`}
  >
    {children}
  </button>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 12a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9l1-12" />
  </svg>
);

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <path d="M3 12a9 9 0 0 1 15-6.5" strokeLinecap="round" />
    <path d="M21 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 12a9 9 0 0 1-15 6.5" strokeLinecap="round" />
    <path d="M3 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const PackageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <path d="M3.5 8.5 12 4l8.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 8.5V16l8 4 8-4V8.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 12v8" strokeLinecap="round" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <rect x="4.5" y="11" width="15" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
  </svg>
);

const UnlockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <rect x="4.5" y="11" width="15" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 7-2.7" strokeLinecap="round" />
  </svg>
);

const UndoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <path d="M9 7H5v4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 11c1.8-3 5-5 8.5-5 4.4 0 7.5 2.6 7.5 6.5 0 3.6-2.7 6.5-6.5 6.5" strokeLinecap="round" />
  </svg>
);

const RedoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <path d="M15 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 11c-1.8-3-5-5-8.5-5C6.1 6 3 8.6 3 12.5 3 16.1 5.7 19 9.5 19" strokeLinecap="round" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <path
      d="M12 3 19 6v6c0 4.2-2.6 7.6-7 9-4.4-1.4-7-4.8-7-9V6l7-3Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M9.3 12.1 11 13.8l3.7-3.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
  >
    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MetricItem = ({
  icon,
  value,
  title,
  ariaLabel,
  className,
}: {
  icon: string;
  value: string | number;
  title: string;
  ariaLabel: string;
  className?: string;
}) => (
  <span
    title={title}
    aria-label={ariaLabel}
    className={`inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 ${className ?? ""}`}
  >
    <span aria-hidden="true">{icon}</span>
    <span>{value}</span>
  </span>
);

const TOOLBAR_EXPANDED_KEY = "coach.toolbarExpanded";

const formatStatusTitle = (status: TeacherControlPanelStatus) => {
  const parts = [] as string[];
  if (status.coachRunning) parts.push("코치 실행 중");
  if (status.genRunning) parts.push("생성 중");
  parts.push(status.dirty ? "변경 있음" : "변경 없음");
  if (status.lastApplyTs) {
    parts.push(`마지막 적용: ${new Date(status.lastApplyTs).toLocaleTimeString()}`);
  }
  if (status.lastCodeHash) {
    parts.push(`코드 해시: ${status.lastCodeHash}`);
  }
  return parts.join(" · ");
};

export default function TeacherControlPanel({
  isTeacherMode,
  lessonLock,
  metricsSummary,
  onSetLessonId,
  onToggleLessonLock,
  onHardReset,
  onResetEngine,
  onAbortAll,
  onExportDiagnostics,
  onWarmupWebLLM,
  autosaveEnabled,
  onToggleAutosave,
  undoEnabled,
  redoEnabled,
  onUndo,
  onRedo,
  presentationMode,
  onTogglePresentationMode,
  status,
}: TeacherControlPanelProps) {
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(TOOLBAR_EXPANDED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [warnPulse, setWarnPulse] = useState(false);
  const [hardFailPulse, setHardFailPulse] = useState(false);
  const prevWarnCountRef = useRef(metricsSummary.warnCount);
  const prevHardFailCountRef = useRef(metricsSummary.hardFailCount);
  const statusTitle = formatStatusTitle(status);
  const abortDisabled = !status.coachRunning && !status.genRunning;
  const failureTop = getFailureTopK(metricsSummary, 3);
  const hasFailureTop = failureTop.length > 0;
  const lessonButtons: Array<{ id: LessonId; label: string; title: string }> = [
    { id: "P1", label: "1", title: "1교시: 자기소개" },
    { id: "P2", label: "2", title: "2교시: 아이돌 팬페이지" },
    { id: "P3", label: "3", title: "3교시: 포트폴리오" },
    { id: "P4", label: "4", title: "4교시: three.js 입문" },
  ];
  const templateVersion = 1;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(TOOLBAR_EXPANDED_KEY);
      if (stored === "true" || stored === "false") {
        setIsToolbarExpanded(stored === "true");
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TOOLBAR_EXPANDED_KEY, String(isToolbarExpanded));
    } catch {
      // ignore storage failures
    }
  }, [isToolbarExpanded]);

  useEffect(() => {
    if (!isTeacherMode) return;
    const previous = prevWarnCountRef.current;
    prevWarnCountRef.current = metricsSummary.warnCount;
    if (!presentationMode) return;
    if (metricsSummary.warnCount > previous) {
      setWarnPulse(true);
      const timer = window.setTimeout(() => setWarnPulse(false), 700);
      return () => window.clearTimeout(timer);
    }
  }, [isTeacherMode, metricsSummary.warnCount, presentationMode]);

  useEffect(() => {
    if (!isTeacherMode) return;
    const previous = prevHardFailCountRef.current;
    prevHardFailCountRef.current = metricsSummary.hardFailCount;
    if (!presentationMode) return;
    if (metricsSummary.hardFailCount > previous) {
      setHardFailPulse(true);
      const timer = window.setTimeout(() => setHardFailPulse(false), 700);
      return () => window.clearTimeout(timer);
    }
  }, [isTeacherMode, metricsSummary.hardFailCount, presentationMode]);

  if (!isTeacherMode) return null;

  const toolbarToggleLabel = isToolbarExpanded ? "도구 접기" : "도구 펼치기";
  const toolbarToggleTitle = isToolbarExpanded ? "도구 닫기" : "도구 열기";
  const toolbarPanelClasses = `flex w-full flex-wrap items-center gap-2 transition-[max-height,opacity] duration-200 ${
    isToolbarExpanded
      ? "max-h-[720px] overflow-visible opacity-100"
      : "max-h-0 overflow-hidden opacity-0 pointer-events-none"
  }`;

  return (
    <div
      className={`mt-3 flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-3 text-xs ${
        isToolbarExpanded ? "py-2" : "py-1.5"
      }`}
      role="group"
      aria-label="교사용 컨트롤 패널"
      data-toolbar-expanded={isToolbarExpanded ? "true" : "false"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsToolbarExpanded((prev) => !prev)}
          aria-label={toolbarToggleLabel}
          title={toolbarToggleTitle}
          className={`group flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 shadow-sm transition hover:border-sky-300 hover:bg-black/5 hover:text-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 ${
            isToolbarExpanded ? "" : "text-slate-600"
          }`}
        >
          <span className="transition-transform duration-200 ease-out group-hover:scale-110 group-focus-visible:scale-110 group-active:scale-95">
            <PawToggleIcon expanded={isToolbarExpanded} size={22} className="text-current" />
          </span>
          <span className="sr-only">도구</span>
        </button>
        {!isToolbarExpanded ? (
          <>
            <button
              type="button"
              onClick={onWarmupWebLLM}
              aria-label="AI 미리 준비"
              title="AI 미리 준비"
              className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
            >
              AI 미리 준비
            </button>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 ${
                status.dirty ? "text-emerald-500" : ""
              }`}
              title={statusTitle}
              aria-label="상태 표시"
            >
              <ShieldCheckIcon />
            </div>
          </>
        ) : null}
      </div>
      <div className={toolbarPanelClasses} aria-hidden={!isToolbarExpanded}>
        <div className="flex items-center gap-1">
          <MetricItem
            icon="📊"
            value={`${metricsSummary.progressPct}%`}
            title="진행률"
            ariaLabel="진행률"
          />
          <MetricItem
            icon="✅"
            value={metricsSummary.doneCount}
            title="완료 수"
            ariaLabel="완료 수"
          />
          <MetricItem
            icon="⚠️"
            value={metricsSummary.warnCount}
            title="경고 수"
            ariaLabel="경고 수"
            className={warnPulse ? "animate-[warn-pulse_0.7s_ease-out_1]" : undefined}
          />
          <MetricItem
            icon="⛔"
            value={metricsSummary.hardFailCount}
            title="중대한 실패 수"
            ariaLabel="중대한 실패 수"
            className={hardFailPulse ? "animate-[warn-pulse_0.7s_ease-out_1]" : undefined}
          />
          {hasFailureTop ? (
            <div
              className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500"
              title="최근 실패 Top3"
              aria-label="최근 실패 Top3"
            >
              <span className="text-[10px] font-semibold text-slate-400">최근 실패 Top3</span>
              <div className="flex items-center gap-2">
                {failureTop.map((item) => (
                  <span key={item.key} className="inline-flex items-center gap-1">
                    <span>{item.key}</span>
                    <span className="text-slate-700">{item.count}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-500"
              title="최근 실패 없음"
              aria-label="최근 실패 없음"
            >
              <span aria-hidden="true">✅</span>
              <span className="text-[10px] font-semibold text-slate-400">정상</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMetricsOpen((prev) => !prev)}
            aria-label={metricsOpen ? "운영 패널 접기" : "운영 패널 펼치기"}
            title={metricsOpen ? "운영 패널 접기" : "운영 패널 펼치기"}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
          >
            <ChevronIcon open={metricsOpen} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          {lessonButtons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              onClick={() => onSetLessonId(lesson.id)}
              aria-label={`${lesson.label}교시 선택`}
              title={lesson.title}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-[11px] font-semibold text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-600 ${
                lessonLock.lessonId === lesson.id ? "text-sky-600" : ""
              }`}
            >
              {lesson.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onToggleLessonLock(!lessonLock.enabled)}
            aria-label="레슨 잠금 토글"
            title={lessonLock.enabled ? "레슨 잠금 해제" : "레슨 잠금"}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-lg text-slate-500 shadow-sm transition hover:border-amber-300 hover:text-amber-500 ${
              lessonLock.enabled ? "text-amber-500" : ""
            }`}
          >
            {lessonLock.enabled ? "🔒" : "🔓"}
          </button>
          <span
            className="ml-1 rounded-full border border-slate-200/80 bg-white px-2 py-1 text-[10px] font-semibold text-slate-400"
            title={`템플릿 버전 ${templateVersion}`}
            aria-label={`템플릿 버전 ${templateVersion}`}
          >
            v1
          </span>
        </div>
        <button
          type="button"
          onClick={onWarmupWebLLM}
          aria-label="AI 미리 준비"
          title="AI 미리 준비"
          className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
        >
          AI 미리 준비
        </button>
        <IconButton title="전체 리셋" ariaLabel="전체 리셋" onClick={onHardReset}>
          <TrashIcon />
        </IconButton>
        <IconButton title="엔진 리셋" ariaLabel="엔진 리셋" onClick={onResetEngine}>
          <RefreshIcon />
        </IconButton>
        <IconButton
          title="전체 중단"
          ariaLabel="전체 중단"
          onClick={onAbortAll}
          disabled={abortDisabled}
        >
          <StopIcon />
        </IconButton>
        <IconButton title="진단 내보내기" ariaLabel="진단 내보내기" onClick={onExportDiagnostics}>
          <PackageIcon />
        </IconButton>
        <IconButton
          title={presentationMode ? "Presentation mode 끄기" : "Presentation mode (학생 UI 최소화)"}
          ariaLabel="Presentation mode 토글"
          onClick={() => onTogglePresentationMode(!presentationMode)}
          active={presentationMode}
        >
          <span aria-hidden="true">🎥</span>
        </IconButton>
        <IconButton
          title={autosaveEnabled ? "오토세이브: 켜짐" : "오토세이브: 꺼짐"}
          ariaLabel="오토세이브 토글"
          onClick={() => onToggleAutosave(!autosaveEnabled)}
          active={autosaveEnabled}
        >
          {autosaveEnabled ? <LockIcon /> : <UnlockIcon />}
        </IconButton>
        <IconButton title="되돌리기" ariaLabel="되돌리기" onClick={onUndo} disabled={!undoEnabled}>
          <UndoIcon />
        </IconButton>
        <IconButton title="다시하기" ariaLabel="다시하기" onClick={onRedo} disabled={!redoEnabled}>
          <RedoIcon />
        </IconButton>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 ${
            status.dirty ? "text-emerald-500" : ""
          }`}
          title={statusTitle}
          aria-label="상태 표시"
        >
          <ShieldCheckIcon />
        </div>
        {metricsOpen ? (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200/70 bg-white/80 px-2 py-2">
            <div className="flex flex-wrap items-center gap-2">
              {(["INPUT", "COACH", "GEN", "APPLY"] as const).map((step) => (
                <div
                  key={step}
                  className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500"
                  title={`STEP ${step}`}
                  aria-label={`STEP ${step} 성공 ${metricsSummary.step[step].ok} 실패 ${metricsSummary.step[step].fail}`}
                >
                  <span aria-hidden="true">
                    {step === "INPUT" ? "⌨️" : step === "COACH" ? "🧠" : step === "GEN" ? "⚙️" : "✅"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true">✅</span>
                    <span>{metricsSummary.step[step].ok}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span aria-hidden="true">❌</span>
                    <span>{metricsSummary.step[step].fail}</span>
                  </span>
                </div>
              ))}
            </div>
            <div
              className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500"
              title="최근 경고"
              aria-label="최근 경고 코드"
            >
              <span aria-hidden="true">⚠️</span>
              <span>
                {metricsSummary.recentWarnCodes.length > 0
                  ? metricsSummary.recentWarnCodes.join(" · ")
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <IconButton
                title="전체 중단"
                ariaLabel="전체 중단"
                onClick={onAbortAll}
                disabled={abortDisabled}
              >
                <StopIcon />
              </IconButton>
              <IconButton title="엔진 리셋" ariaLabel="엔진 리셋" onClick={onResetEngine}>
                <RefreshIcon />
              </IconButton>
              <IconButton title="전체 리셋" ariaLabel="전체 리셋" onClick={onHardReset}>
                <TrashIcon />
              </IconButton>
              <IconButton
                title="진단 내보내기"
                ariaLabel="진단 내보내기"
                onClick={onExportDiagnostics}
              >
                <PackageIcon />
              </IconButton>
            </div>
          </div>
        ) : null}
      </div>
      <style jsx>{`
        @keyframes warn-pulse {
          0% {
            box-shadow: 0 0 0 rgba(248, 113, 113, 0);
          }
          40% {
            box-shadow: 0 0 12px rgba(248, 113, 113, 0.5);
          }
          100% {
            box-shadow: 0 0 0 rgba(248, 113, 113, 0);
          }
        }
      `}</style>
    </div>
  );
}
