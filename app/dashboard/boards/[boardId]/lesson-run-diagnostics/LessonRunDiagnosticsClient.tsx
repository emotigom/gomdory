"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { LESSON_RUN_PRESETS } from "@/lib/lesson-run/lessonRunPresets";
import { validateStartLessonRun } from "@/lib/lesson-run/validateStartLessonRun";
import type {
  LessonRunState,
  StartLessonRunIdempotencyDisposition,
  StartLessonRunPresetId,
  ValidateStartLessonRunInput,
} from "@/lib/lesson-run/types";
import type { LessonRunDiagnosticsSnapshot } from "@/lib/lesson-run/loadLessonRunDiagnostics";

type Props = {
  boardId: string;
  now: string;
  state: LessonRunState;
  snapshot: LessonRunDiagnosticsSnapshot;
  diagnosticsWarnings: string[];
  dryRunInput: ValidateStartLessonRunInput;
};

type Issue = LessonRunState["warnings"][number];
type DisplayIssue = Omit<Issue, "code"> & { code: string };

const SECRET_FIELD_PATTERN = /(token|secret|password|authorization|cookie|r2_prefix|access|key)/i;

function yesNo(value: boolean) {
  return value ? "yes" : "no";
}

function Badge({ value }: { value: boolean | string }) {
  const text = typeof value === "boolean" ? yesNo(value) : value;
  return (
    <span className="lesson-run-diagnostics-badge rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
      {text}
    </span>
  );
}

function Row({ label, value }: { label: string; value: boolean | string | number | ReactNode | null | undefined }) {
  return (
    <div className="lesson-run-diagnostics-row flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <dt className="min-w-0 text-sm text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-slate-900">
        {typeof value === "boolean" ? <Badge value={value} /> : value ?? "-"}
      </dd>
    </div>
  );
}

const IDEMPOTENCY_DISPOSITION_COPY: Record<
  StartLessonRunIdempotencyDisposition,
  {
    label: string;
    teacherMessage: string;
    duplicateDefense: string;
    recentExpiredGuidance: string;
    multipleOpenSessions: string;
    toneClassName: string;
    badgeClassName: string;
  }
> = {
  new_start_allowed: {
    label: "새 수업창 가능",
    teacherMessage: "새 수업창을 열 수 있습니다.",
    duplicateDefense: "중복으로 이어 쓸 열린 수업창은 없습니다.",
    recentExpiredGuidance: "방금 종료된 수업창 안내는 없습니다.",
    multipleOpenSessions: "여러 열린 수업창 충돌은 없습니다.",
    toneClassName: "border-emerald-200 bg-emerald-50",
    badgeClassName: "border-emerald-200 bg-white text-emerald-800",
  },
  reuse_open_session: {
    label: "기존 열린 수업창 재사용",
    teacherMessage: "이미 열린 수업창이 있어 새로 만들지 않고 기존 창을 이어서 사용해야 합니다.",
    duplicateDefense: "같은 요청 재시도는 기존 열린 수업창 재사용으로 처리해야 합니다.",
    recentExpiredGuidance: "방금 종료된 수업창 안내보다 현재 열린 수업창 재사용이 우선입니다.",
    multipleOpenSessions: "여러 열린 수업창 충돌은 없습니다.",
    toneClassName: "border-sky-200 bg-sky-50",
    badgeClassName: "border-sky-200 bg-white text-sky-800",
  },
  resume_existing_session: {
    label: "중복 클릭 방어",
    teacherMessage: "이미 열린 수업창이 있어 새로 만들지 않고 기존 창을 이어서 사용해야 합니다.",
    duplicateDefense: "요청 식별값이 없어도 중복 클릭으로 보고 새 수업창 생성을 막습니다.",
    recentExpiredGuidance: "방금 종료된 수업창 안내보다 현재 열린 수업창 재개가 우선입니다.",
    multipleOpenSessions: "여러 열린 수업창 충돌은 없습니다.",
    toneClassName: "border-sky-200 bg-sky-50",
    badgeClassName: "border-sky-200 bg-white text-sky-800",
  },
  recent_expired_session: {
    label: "최근 종료 확인 필요",
    teacherMessage: "방금 종료된 수업창이 있어 연장/재시작 판단이 필요합니다.",
    duplicateDefense: "현재 열린 수업창은 없지만 최근 종료 이력을 먼저 확인해야 합니다.",
    recentExpiredGuidance: "최근 종료된 수업창이 있어 자동 새 시작 대신 연장/재시작 판단을 요구합니다.",
    multipleOpenSessions: "여러 열린 수업창 충돌은 없습니다.",
    toneClassName: "border-amber-200 bg-amber-50",
    badgeClassName: "border-amber-200 bg-white text-amber-800",
  },
  conflict_multiple_open_sessions: {
    label: "여러 열린 수업창 충돌",
    teacherMessage: "여러 열린 수업창이 있어 먼저 상태를 정리해야 합니다.",
    duplicateDefense: "중복 시작을 막기 위해 자동 재사용하지 않습니다.",
    recentExpiredGuidance: "최근 종료 안내보다 열린 수업창 충돌 정리가 우선입니다.",
    multipleOpenSessions: "여러 열린 수업창이 있어 새 수업창 계산을 막습니다.",
    toneClassName: "border-rose-200 bg-rose-50",
    badgeClassName: "border-rose-200 bg-white text-rose-800",
  },
  invalid_idempotency_key: {
    label: "요청 식별값 오류",
    teacherMessage: "요청 식별값이 올바르지 않아 시작할 수 없습니다.",
    duplicateDefense: "요청 식별값을 신뢰할 수 없어 중복 방어 판단을 중단합니다.",
    recentExpiredGuidance: "요청 식별값을 먼저 수정해야 최근 종료 여부를 판단할 수 있습니다.",
    multipleOpenSessions: "요청 식별값 오류를 먼저 해결해야 열린 수업창 충돌도 확인할 수 있습니다.",
    toneClassName: "border-rose-200 bg-rose-50",
    badgeClassName: "border-rose-200 bg-white text-rose-800",
  },
};

function fallbackIdempotencyPreview(ok: boolean) {
  return ok ? IDEMPOTENCY_DISPOSITION_COPY.new_start_allowed : null;
}

function shortenIdentifier(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function IssueSummary({ issues }: { issues: DisplayIssue[] }) {
  if (issues.length === 0) return <p className="text-sm text-slate-500">None</p>;

  return (
    <ul className="space-y-2">
      {issues.map((issue, index) => {
        const renderedIssue = displayIssue(issue);
        return (
          <li key={`${issue.code}-${issue.refId ?? index}`} className="rounded border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
            <div className="font-medium text-slate-950">{renderedIssue.code}</div>
            <div className="mt-1">{renderedIssue.message}</div>
            {issue.refId ? <div className="mt-1 text-xs text-slate-500">ref: {issue.refId}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}

const ISSUE_LABELS: Partial<Record<Issue["code"], string>> = {
  no_share_code: "Share code is missing",
  no_deployment: "No student app deployment",
  no_open_student_app_session: "Student app window is closed",
  student_app_session_expired: "Recent student app window ended",
  student_app_session_not_started: "Student app window has not started",
  student_app_session_open_while_edu_class_locked: "Submissions open while class is locked",
  multiple_open_student_app_sessions: "Multiple student app windows are open",
  query_student_app_without_open_session: "Coding route can open while submissions are closed",
  active_class_without_student_app_window: "Class is active but submissions are closed",
  student_app_window_without_active_class: "Submissions open without active class",
  gallery_open_while_submissions_closed: "Gallery visibility is separate",
  gallery_open_while_edu_class_locked: "Gallery visible while class is locked",
  courseware_session_parallel_to_student_app_flow: "Courseware session is parallel",
  share_access_missing: "Student access proof is missing",
};

function displayIssue(issue: DisplayIssue): DisplayIssue {
  if (issue.code === "edu_class_unavailable") {
    return {
      ...issue,
      message: "The EDU class row was not available, so lock state may be partial. This does not mean the student app deployment is missing.",
    };
  }

  if (issue.code === "diagnostics_load_warning") return issue;

  const typedCode = issue.code as Issue["code"];
  return {
    ...issue,
    code: ISSUE_LABELS[typedCode] ?? issue.code,
  };
}

function diagnosticWarningIssue(message: string, index: number): DisplayIssue {
  return {
    code: message.includes("edu_classes") ? "edu_class_unavailable" : "diagnostics_load_warning",
    message,
    severity: "warning",
    refId: `load-${index + 1}`,
  };
}

function IssueList({ title, issues }: { title: string; issues: DisplayIssue[] }) {
  return (
    <section className="lesson-run-diagnostics-card rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {issues.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">None</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${issue.refId ?? index}`} className="rounded border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
              {(() => {
                const renderedIssue = displayIssue(issue);
                return (
                  <>
                    <div className="font-medium text-slate-950">{renderedIssue.code}</div>
                    <div className="mt-1">{renderedIssue.message}</div>
                  </>
                );
              })()}
              {issue.refId ? <div className="mt-1 text-xs text-slate-500">ref: {issue.refId}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function removeSecretLookingFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeSecretLookingFields);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SECRET_FIELD_PATTERN.test(key))
      .map(([key, entry]) => [key, removeSecretLookingFields(entry)]),
  );
}

export default function LessonRunDiagnosticsClient({
  boardId,
  now,
  state,
  snapshot,
  diagnosticsWarnings,
  dryRunInput,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<StartLessonRunPresetId>("45m");
  const diagnosticsWarningIssues = diagnosticsWarnings.map(diagnosticWarningIssue);
  const dryRunResult = useMemo(
    () =>
      validateStartLessonRun({
        ...dryRunInput,
        requestedPreset: selectedPresetId,
      }),
    [dryRunInput, selectedPresetId],
  );
  const selectedPreset = LESSON_RUN_PRESETS[selectedPresetId];
  const previewValues = dryRunResult.normalizedInput ?? selectedPreset;
  const idempotencyDisposition = dryRunResult.idempotencyDisposition;
  const idempotencyPreview = idempotencyDisposition
    ? IDEMPOTENCY_DISPOSITION_COPY[idempotencyDisposition]
    : fallbackIdempotencyPreview(dryRunResult.ok);
  const reusableSessionIdPreview = dryRunResult.reusableSessionId ? shortenIdentifier(dryRunResult.reusableSessionId) : null;
  const copyPayload = useMemo(
    () =>
      JSON.stringify(
        removeSecretLookingFields({
          boardId,
          now,
          state,
          dryRunPreview: {
            selectedPreset: selectedPresetId,
            ok: dryRunResult.ok,
            durationMinutes: previewValues.durationMinutes,
            submissionsOpen: previewValues.submissionsOpen,
            uploadsOpen: previewValues.uploadsOpen,
            galleryMode: previewValues.galleryMode,
            autoLock: previewValues.autoLock,
            blockingReasons: dryRunResult.blockingReasons,
            warnings: dryRunResult.warnings,
            conflicts: dryRunResult.conflicts,
            teacherMessage: dryRunResult.teacherMessage,
            recommendedTeacherAction: dryRunResult.recommendedTeacherAction,
            httpStatusCandidate: dryRunResult.httpStatusCandidate,
            idempotencyDisposition: dryRunResult.idempotencyDisposition,
            reusableSessionId: dryRunResult.reusableSessionId ? shortenIdentifier(dryRunResult.reusableSessionId) : undefined,
            idempotencyWarning: dryRunResult.idempotencyWarning,
          },
          sourceSummary: {
            board: snapshot.board
              ? {
                  id: snapshot.board.id,
                  title: snapshot.board.title,
                  hasShareCode: Boolean(snapshot.board.share_code),
                  activeSessionId: snapshot.board.active_session_id,
                  classState: snapshot.board.class_state,
                }
              : null,
            rowCounts: {
              studentAppClassSessions: snapshot.studentAppClassSessions.length,
              classSessions: snapshot.classSessions.length,
              studentAppDeployments: snapshot.studentAppDeployments.length,
              lessonActivityRuns: snapshot.lessonActivityRuns.length,
              coursewareSessions: snapshot.coursewareSessions.length,
            },
            loadWarnings: snapshot.loadWarnings,
            diagnosticsWarnings,
          },
        }),
        null,
        2,
      ),
    [boardId, diagnosticsWarnings, dryRunResult, now, previewValues, selectedPresetId, snapshot, state],
  );

  async function copyDiagnostics() {
    await navigator.clipboard.writeText(copyPayload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main data-lesson-run-diagnostics-scope className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">Lesson run diagnostics</p>
            <h1 className="mt-1 break-words text-2xl font-semibold text-slate-950">{snapshot.board?.title ?? boardId}</h1>
            <p className="mt-2 break-all text-sm text-slate-500">{boardId}</p>
          </div>
          <div className="lesson-run-diagnostics-control flex shrink-0 gap-2">
            <button
              type="button"
              onClick={copyDiagnostics}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-100"
            >
              {copied ? "Copied" : "Copy diagnostics"}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-100"
            >
              Refresh
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="lesson-run-diagnostics-card rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-950">Source</h2>
            <dl className="mt-3">
              <Row label="board name" value={snapshot.board?.title ?? null} />
              <Row label="share code exists" value={state.hasShareCode} />
              <Row label="deployment exists" value={state.hasStudentAppDeployment} />
              <Row label="open student app session" value={state.hasOpenStudentAppSession} />
              <Row label="active class session" value={state.hasActiveClassSession} />
              <Row label="edu class locked" value={state.eduClassLocked} />
            </dl>
          </div>

          <div className="lesson-run-diagnostics-card rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-950">Availability</h2>
            <dl className="mt-3">
              <Row label="submissionsOpen" value={state.submissionsOpen} />
              <Row label="uploadsOpen" value={state.uploadsOpen} />
              <Row label="studentWorkspaceAvailable" value={state.studentWorkspaceAvailable} />
              <Row label="galleryMaybeAvailable" value={state.galleryMaybeAvailable} />
              <Row label="sessionExpired" value={state.sessionExpired} />
              <Row label="hasLessonActivity" value={state.hasLessonActivity} />
            </dl>
          </div>

          <div className="lesson-run-diagnostics-card rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-base font-semibold text-slate-950">Resolved State</h2>
            <dl className="mt-3">
              <Row label="teacherPrimaryStatus" value={state.teacherPrimaryStatus} />
              <Row label="studentPrimaryStatus" value={state.studentPrimaryStatus} />
              <Row label="recommendedTeacherAction" value={state.recommendedTeacherAction} />
              <Row label="active student app sessions" value={state.activeStudentAppSessionIds.length} />
              <Row label="expired student app sessions" value={state.expiredStudentAppSessionIds.length} />
              <Row label="published deployments" value={state.publishedDeploymentIds.length} />
            </dl>
          </div>
        </section>

        <section className="lesson-run-diagnostics-card mt-4 rounded-lg border border-indigo-200 bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-indigo-700">아직 실제 수업은 열리지 않습니다</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">수업 시작 미리보기</h2>
              <p className="mt-2 text-sm text-slate-600">
                선택한 preset으로 진단만 계산합니다. 아래 항목을 해결해야 시작할 수 있는지 미리 확인할 수 있습니다.
              </p>
            </div>
            <label className="lesson-run-diagnostics-control flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700">
              Preset preview
              <select
                value={selectedPresetId}
                onChange={(event) => setSelectedPresetId(event.target.value as StartLessonRunPresetId)}
                className="min-h-10 min-w-52 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm"
              >
                {Object.values(LESSON_RUN_PRESETS).map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.teacherLabel}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-950">Preset</h3>
              <dl className="mt-3">
                <Row label="selected preset" value={selectedPreset.teacherLabel} />
                <Row label="duration" value={`${previewValues.durationMinutes} minutes`} />
                <Row label="submissionsOpen" value={previewValues.submissionsOpen} />
                <Row label="uploadsOpen" value={previewValues.uploadsOpen} />
                <Row label="galleryMode" value={previewValues.galleryMode} />
                <Row label="autoLock" value={previewValues.autoLock} />
              </dl>
              <p className="mt-3 text-sm text-slate-600">
                {previewValues.submissionsOpen || previewValues.uploadsOpen
                  ? "이 preset으로 계산하면 제출/업로드가 사용 가능 상태로 표시됩니다."
                  : "이 preset으로 계산하면 제출/업로드는 사용 가능 상태로 표시되지 않습니다."}
              </p>
            </div>

            <div className="rounded border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-950">Validator</h3>
              <dl className="mt-3">
                <Row label="ok" value={dryRunResult.ok} />
                <Row label="teacherMessage" value={dryRunResult.teacherMessage} />
                <Row label="recommendedTeacherAction" value={dryRunResult.recommendedTeacherAction} />
                <Row label="httpStatusCandidate" value={dryRunResult.httpStatusCandidate} />
              </dl>
            </div>

            <div className="rounded border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-950">Preview Scope</h3>
              <p className="mt-3 text-sm text-slate-600">
                이 영역은 diagnostics 안에서만 동작하는 dry-run입니다. DB write, server action, student board 변경을 만들지 않습니다.
              </p>
            </div>
          </div>

          {idempotencyPreview ? (
            <div className={`mt-4 rounded border p-4 ${idempotencyPreview.toneClassName}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-950">Idempotency / reuse preview</h3>
                  <p className="mt-2 text-sm text-slate-700">{idempotencyPreview.teacherMessage}</p>
                </div>
                <span className={`w-fit rounded border px-2 py-1 text-xs font-medium ${idempotencyPreview.badgeClassName}`}>
                  {idempotencyPreview.label}
                </span>
              </div>
              <dl className="mt-3">
                <Row label="idempotencyDisposition" value={idempotencyDisposition ?? "new_start_allowed"} />
                {reusableSessionIdPreview ? (
                  <Row label="reusableSessionId" value={<span className="break-all font-mono text-xs">{reusableSessionIdPreview}</span>} />
                ) : null}
                <Row label="duplicate/double-click defense" value={idempotencyPreview.duplicateDefense} />
                <Row label="recent expired guidance" value={idempotencyPreview.recentExpiredGuidance} />
                <Row label="multiple open sessions conflict" value={idempotencyPreview.multipleOpenSessions} />
                <Row label="idempotencyWarning" value={dryRunResult.idempotencyWarning ?? "None"} />
              </dl>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-950">blockingReasons</h3>
              <IssueSummary issues={dryRunResult.blockingReasons} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-950">warnings</h3>
              <IssueSummary issues={dryRunResult.warnings} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-950">conflicts</h3>
              <IssueSummary issues={dryRunResult.conflicts} />
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <IssueList title="Blocking Reasons" issues={state.blockingReasons} />
          <IssueList title="Warnings" issues={[...state.warnings, ...diagnosticsWarningIssues]} />
          <IssueList title="Conflicts" issues={state.conflicts} />
        </section>

        {snapshot.loadWarnings.length > 0 ? (
          <section className="lesson-run-diagnostics-card mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-base font-semibold text-amber-950">Load Warnings</h2>
            <ul className="mt-3 space-y-1 text-sm text-amber-900">
              {snapshot.loadWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <details className="lesson-run-diagnostics-card mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-base font-semibold text-slate-950">Raw Source Summary</summary>
          <pre className="mt-3 max-h-96 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
            {JSON.stringify(
              removeSecretLookingFields({
                now,
                sourceTables: snapshot.sourceTables,
                rowCounts: {
                  studentAppClassSessions: snapshot.studentAppClassSessions.length,
                  classSessions: snapshot.classSessions.length,
                  studentAppDeployments: snapshot.studentAppDeployments.length,
                  lessonActivityRuns: snapshot.lessonActivityRuns.length,
                  coursewareSessions: snapshot.coursewareSessions.length,
                },
                activeStudentAppSessionIds: state.activeStudentAppSessionIds,
                activeClassSessionIds: state.activeClassSessionIds,
                publishedDeploymentIds: state.publishedDeploymentIds,
              }),
              null,
              2,
            )}
          </pre>
        </details>
      </div>
    </main>
  );
}
