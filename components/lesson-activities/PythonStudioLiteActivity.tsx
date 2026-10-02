"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  capPythonStudioLiteOutput,
  type PythonStudioLiteConfig,
  type PythonStudioLiteState,
} from "@/lib/lesson-activities/pythonStudioLite";
import { getPyodideAssetPaths } from "@/lib/lesson-activities/pyodideAssets";
import { routes } from "@/lib/standards/routes";

import CodingActivityWorkspace from "./CodingActivityWorkspace";
import ResizableSplitPane from "./ResizableSplitPane";

type PythonStudioLitePayload = {
  activityRun: {
    id: string;
    activityType: "python_studio_lite";
    status: "active" | "ended";
    config: PythonStudioLiteConfig;
  };
  state: PythonStudioLiteState;
  status: "in_progress" | "completed";
};

type Props = {
  shareCode: string;
  displayName?: string | null;
};

type RuntimeStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable"
  | "running"
  | "success"
  | "error";

type WorkerMessage =
  | { type: "ready"; id: string }
  | { type: "init:error"; id: string; error?: string }
  | { type: "run:success"; id: string; stdout?: string; stderr?: string }
  | { type: "run:error"; id: string; stdout?: string; stderr?: string };

const PYTHON_WORKER_URL = "/workers/python-studio-lite-worker.js";
const RUNTIME_LOAD_TIMEOUT_MS = 20_000;
const PYTHON_RUN_TIMEOUT_MS = 7_000;
const RUNTIME_UNAVAILABLE_MESSAGE =
  "파이썬 실행 환경을 불러오지 못했어요. 코드는 저장할 수 있어요.";
const RUNTIME_LOADING_MESSAGE = "파이썬 실행 환경을 준비하는 중…";

function createParticipantKey(shareCode: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `py_${shareCode}_${random}`
    .replace(/[^A-Za-z0-9:_-]/g, "_")
    .slice(0, 96);
}

function getParticipantKey(shareCode: string): string {
  const storageKey = `gomdory:activityParticipant:${shareCode}:python_studio_lite`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const next = createParticipantKey(shareCode);
  window.localStorage.setItem(storageKey, next);
  return next;
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSuspiciousLoop(source: string): boolean {
  return /^\s*while\s+(True|1)\s*:/m.test(source);
}

export default function PythonStudioLiteActivity({
  shareCode,
  displayName,
}: Props) {
  const [participantKey, setParticipantKey] = useState<string | null>(null);
  const [payload, setPayload] = useState<PythonStudioLitePayload | null>(null);
  const [code, setCode] = useState("");
  const [stdin, setStdin] = useState("");
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [consoleExpanded, setConsoleExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"save" | "submit" | "reset" | null>(
    null,
  );
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const pendingCleanupRef = useRef(new Set<() => void>());
  const runtimeBaseUrl = getPyodideAssetPaths(
    payload?.activityRun.config.runtime.baseUrl,
  ).baseUrl;

  const ended = payload?.activityRun.status === "ended";
  const submitted = payload?.state.submitted === true;
  const initialBusy = loading || saving !== null;
  const runBusy = runtimeStatus === "loading" || runtimeStatus === "running";
  const savedLabel = formatTimestamp(payload?.state.savedAt ?? null);
  const submittedLabel = formatTimestamp(payload?.state.submittedAt ?? null);
  const dirty = payload
    ? code !== payload.state.code ||
      stdin !== payload.state.stdin ||
      stdout !== payload.state.stdout ||
      stderr !== payload.state.stderr
    : false;
  const loopWarning = isSuspiciousLoop(code);

  const resetWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  const getWorker = useCallback(() => {
    if (typeof window === "undefined" || typeof Worker === "undefined")
      return null;
    if (!workerRef.current) workerRef.current = new Worker(PYTHON_WORKER_URL);
    return workerRef.current;
  }, []);

  useEffect(
    () => () => {
      for (const cleanup of pendingCleanupRef.current) cleanup();
      pendingCleanupRef.current.clear();
      resetWorker();
    },
    [resetWorker],
  );

  useEffect(() => {
    setParticipantKey(getParticipantKey(shareCode));
  }, [shareCode]);

  useEffect(() => {
    if (!participantKey) return;
    const controller = new AbortController();
    async function loadState() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          activityType: "python_studio_lite",
        });
        if (displayName) params.set("displayName", displayName);
        const response = await fetch(
          `${routes.api.share.activityState(shareCode)}?${params.toString()}`,
          {
            headers: { "x-gomdory-participant-key": participantKey ?? "" },
            signal: controller.signal,
          },
        );
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: PythonStudioLitePayload;
          error?: { message?: string };
        } | null;
        if (!response.ok || !json?.ok || !json.data)
          throw new Error(
            json?.error?.message ?? "파이썬 실습을 불러오지 못했습니다.",
          );
        setPayload(json.data);
        setCode(json.data.state.code);
        setStdin(json.data.state.stdin);
        setStdout(json.data.state.stdout);
        setStderr(json.data.state.stderr);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "파이썬 실습을 불러오지 못했습니다.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadState();
    return () => controller.abort();
  }, [displayName, participantKey, shareCode]);

  const persist = useCallback(
    async (operation: "save_code" | "submit" | "reset_to_starter") => {
      if (!participantKey || !payload) return;
      if (
        operation === "reset_to_starter" &&
        !window.confirm("처음 코드로 되돌릴까요? 현재 편집 내용은 사라집니다.")
      )
        return;
      setSaving(
        operation === "save_code"
          ? "save"
          : operation === "submit"
            ? "submit"
            : "reset",
      );
      setError(null);
      try {
        const response = await fetch(
          routes.api.share.activityState(shareCode),
          {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-gomdory-participant-key": participantKey,
            },
            body: JSON.stringify({
              activityType: "python_studio_lite",
              operation,
              activityRunId: payload.activityRun.id,
              displayName,
              code,
              stdin,
              stdout: capPythonStudioLiteOutput(stdout),
              stderr: capPythonStudioLiteOutput(stderr),
            }),
          },
        );
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: PythonStudioLitePayload;
          error?: { message?: string };
        } | null;
        if (!response.ok || !json?.ok || !json.data)
          throw new Error(
            json?.error?.message ?? "파이썬 코드를 저장하지 못했습니다.",
          );
        setPayload(json.data);
        setCode(json.data.state.code);
        setStdin(json.data.state.stdin);
        setStdout(json.data.state.stdout);
        setStderr(json.data.state.stderr);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "파이썬 코드를 저장하지 못했습니다.",
        );
      } finally {
        setSaving(null);
      }
    },
    [
      code,
      displayName,
      participantKey,
      payload,
      shareCode,
      stderr,
      stdin,
      stdout,
    ],
  );

  const sendWorkerRequest = useCallback(
    (message: Record<string, unknown>, timeoutMs: number) => {
      const currentWorker = getWorker();
      if (!currentWorker)
        return Promise.reject(new Error(RUNTIME_UNAVAILABLE_MESSAGE));
      const worker = currentWorker;
      const id = `py_${Date.now()}_${requestIdRef.current++}`;
      return new Promise<WorkerMessage>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          worker.removeEventListener("message", onMessage);
          resetWorker();
          reject(
            new Error(
              "파이썬 실행 시간이 너무 길어 중단했어요. 무한 반복 코드를 확인해 주세요.",
            ),
          );
        }, timeoutMs);
        function cleanup() {
          window.clearTimeout(timer);
          worker.removeEventListener("message", onMessage);
          pendingCleanupRef.current.delete(cleanup);
        }
        function onMessage(event: MessageEvent<WorkerMessage>) {
          if (event.data.id !== id) return;
          cleanup();
          resolve(event.data);
        }
        pendingCleanupRef.current.add(cleanup);
        worker.addEventListener("message", onMessage);
        worker.postMessage({ ...message, id, baseUrl: runtimeBaseUrl });
      });
    },
    [getWorker, resetWorker, runtimeBaseUrl],
  );

  const prepareRuntime = useCallback(async () => {
    setError(null);
    setRuntimeStatus("loading");
    try {
      const result = await sendWorkerRequest(
        { type: "init" },
        RUNTIME_LOAD_TIMEOUT_MS,
      );
      if (result.type === "init:error")
        throw new Error(result.error ?? RUNTIME_UNAVAILABLE_MESSAGE);
      setRuntimeStatus("ready");
    } catch (error) {
      setRuntimeStatus("unavailable");
      setError(
        error instanceof Error ? error.message : RUNTIME_UNAVAILABLE_MESSAGE,
      );
    }
  }, [sendWorkerRequest]);

  const runPython = useCallback(async () => {
    setError(null);
    setRuntimeStatus(
      runtimeStatus === "ready" ||
        runtimeStatus === "success" ||
        runtimeStatus === "error"
        ? "running"
        : "loading",
    );
    try {
      const result = await sendWorkerRequest(
        { type: "run", code, stdin },
        runtimeStatus === "ready" ||
          runtimeStatus === "success" ||
          runtimeStatus === "error"
          ? PYTHON_RUN_TIMEOUT_MS
          : RUNTIME_LOAD_TIMEOUT_MS + PYTHON_RUN_TIMEOUT_MS,
      );
      if (result.type === "run:success") {
        setStdout(capPythonStudioLiteOutput(result.stdout ?? ""));
        setStderr(capPythonStudioLiteOutput(result.stderr ?? ""));
        setRuntimeStatus("success");
      } else if (result.type === "run:error") {
        setStdout(capPythonStudioLiteOutput(result.stdout ?? ""));
        setStderr(
          capPythonStudioLiteOutput(
            result.stderr ?? "파이썬 코드를 실행하지 못했어요.",
          ),
        );
        setRuntimeStatus("error");
      } else {
        throw new Error(RUNTIME_UNAVAILABLE_MESSAGE);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : RUNTIME_UNAVAILABLE_MESSAGE;
      setStderr(capPythonStudioLiteOutput(message));
      setRuntimeStatus(message.includes("너무 길어") ? "error" : "unavailable");
      setError(message);
    }
  }, [code, runtimeStatus, sendWorkerRequest, stdin]);

  const activityConfig = payload?.activityRun.config;
  const missionSteps = activityConfig?.missionSteps ?? [];
  const challenge = activityConfig?.challenge;

  const statusLabel = useMemo(() => {
    if (loading) return "불러오는 중";
    if (submitted) return "제출 완료";
    if (savedLabel) return `저장됨 · ${savedLabel}`;
    return "작성 중";
  }, [loading, savedLabel, submitted]);

  const runStatusLabel = useMemo(() => {
    if (runtimeStatus === "loading") return "준비 중";
    if (runtimeStatus === "running") return "실행 중";
    if (runtimeStatus === "success") return "실행 완료";
    if (runtimeStatus === "error" || runtimeStatus === "unavailable")
      return "오류 발생";
    if (runtimeStatus === "ready") return "준비 완료";
    return "대기 중";
  }, [runtimeStatus]);

  return (
    <CodingActivityWorkspace
      testId="python-studio-lite-activity"
      accent="violet"
      eyebrow="Python Studio Lite"
      title={activityConfig?.title ?? "파이썬 실습실"}
      description={
        activityConfig?.instruction ??
        "파이썬 코드를 쓰고 입력/출력을 확인해요."
      }
      detail="브라우저 안의 선택적 Worker 실행 환경을 사용하며, 코드는 서버에서 실행하지 않습니다."
      badges={
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full border border-violet-200/30 bg-violet-300/10 px-3 py-1 text-violet-50">
            {statusLabel}
          </span>
          <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-accent)]/10 px-3 py-1 text-[var(--theme-text)]">
            {runStatusLabel}
          </span>
          {dirty ? (
            <span className="rounded-full border border-amber-200/30 bg-amber-300/10 px-3 py-1 text-amber-50">
              저장되지 않은 변경 있음
            </span>
          ) : null}
          {submittedLabel ? (
            <span className="rounded-full border border-emerald-200/30 bg-emerald-300/10 px-3 py-1 text-emerald-50">
              제출 {submittedLabel}
            </span>
          ) : null}
        </div>
      }
      status={
        runtimeStatus === "loading" ? (
          <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-accent)]/10 p-3 text-sm font-bold text-[var(--theme-text)]">
            {RUNTIME_LOADING_MESSAGE}
          </div>
        ) : null
      }
      alerts={
        <>
          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-rose-300/30 bg-rose-500/15 p-3 text-sm font-bold text-rose-50"
            >
              {error}
            </div>
          ) : null}
          {runtimeStatus === "unavailable" ? (
            <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm font-bold text-amber-50 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">{RUNTIME_UNAVAILABLE_MESSAGE}</span>
              <button
                type="button"
                onClick={prepareRuntime}
                disabled={loading || ended}
                className="min-h-10 shrink-0 rounded-xl bg-amber-200 px-3 py-2 text-sm font-black text-amber-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                다시 시도
              </button>
            </div>
          ) : null}
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs font-bold leading-5 text-amber-50">
            무한 반복 코드는 화면이 멈출 수 있어요. Worker 실행은{" "}
            {Math.round(PYTHON_RUN_TIMEOUT_MS / 1000)}초가 지나면 중단을
            시도하지만 완벽한 샌드박스는 아닙니다.
            {loopWarning ? (
              <span className="mt-1 block text-amber-100">
                while True: 또는 while 1: 패턴이 보여요. 실행 전에 종료 조건을
                확인해 주세요.
              </span>
            ) : null}
          </div>
        </>
      }
      missionTitle="미니 미션"
      mission={
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5">
            {missionSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {challenge ? (
            <div className="rounded-2xl border border-violet-200/25 bg-violet-300/10 p-3 text-xs leading-5 text-violet-50">
              <p className="font-black">{challenge.title}</p>
              <p className="mt-1 font-bold">{challenge.description}</p>
              <p className="mt-1 text-violet-100/80">
                예: {challenge.examples.join(" / ")}
              </p>
            </div>
          ) : null}
        </div>
      }
    >
      <div data-testid="coding-workspace-main-grid" className="min-w-0 max-w-full">
        <ResizableSplitPane
          defaultLeftPercent={64}
          minLeftPercent={45}
          maxLeftPercent={72}
          storageKey="gomdory:python-studio-lite:split-pane"
          left={
            <label className="block min-w-0 rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3">
          <span className="mb-2 block text-sm font-black text-violet-100">
            코드 편집기
          </span>
          <textarea
            data-testid="python-studio-code-editor"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck={false}
            className="h-[min(66vh,680px)] min-h-[360px] w-full max-w-full resize-y rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-4 font-mono text-sm leading-6 text-[var(--theme-text)] outline-none focus:border-violet-200 focus:ring-4 focus:ring-violet-200/15 lg:min-h-[420px]"
            disabled={loading || ended}
          />
            </label>
          }
          right={
            <div className="grid min-w-0 content-start gap-4">
          <label className="min-w-0 rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3">
            <span className="mb-1 block text-sm font-black text-[var(--theme-text-muted)]">
              입력값
            </span>
            <span className="mb-2 block text-xs font-bold leading-5 text-[var(--theme-text-muted)]/75">
              input()이 나오면 오른쪽 입력값을 줄마다 하나씩 사용해요. 실행
              결과에는 입력한 값도 함께 보여요.
            </span>
            <textarea
              data-testid="python-studio-stdin"
              value={stdin}
              onChange={(event) => setStdin(event.target.value)}
              className="min-h-24 w-full max-w-full resize-y rounded-2xl border border-[var(--theme-border)] theme-code-block p-3 font-mono text-sm leading-6 outline-none focus:border-[var(--theme-border-strong)] focus:ring-4 focus:ring-[var(--theme-focus)]"
              placeholder="input()에 들어갈 값을 줄마다 적어 보세요."
              disabled={loading || ended}
            />
          </label>

          <div className="min-w-0 rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3">
            <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-black text-emerald-100">실행 결과</h4>
              <button
                type="button"
                onClick={() => setConsoleExpanded(true)}
                className="min-h-9 rounded-xl border border-emerald-200/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-black text-emerald-50 hover:bg-emerald-300/20"
              >
                결과 크게 보기
              </button>
            </div>
            <div className="grid min-w-0 gap-3">
              <pre
                data-testid="python-studio-stdout"
                className="max-h-96 min-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl theme-console-block p-3 font-mono text-sm leading-relaxed lg:min-h-56"
              >
                {stdout || "표준 출력(stdout)이 여기에 표시돼요."}
              </pre>
              <pre
                data-testid="python-studio-stderr"
                className="max-h-72 min-h-28 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-rose-300/15 bg-[var(--theme-bg)] p-3 font-mono text-sm leading-relaxed text-rose-100"
              >
                {stderr || "오류(stderr)가 있으면 여기에 표시돼요."}
              </pre>
            </div>
          </div>

          {consoleExpanded ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--theme-card)] p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="python-studio-console-title"
            >
              <div className="flex max-h-[92vh] w-full max-w-5xl min-w-0 flex-col rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-4 text-[var(--theme-text)] shadow-2xl shadow-slate-950/60">
                <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                  <div>
                    <h3
                      id="python-studio-console-title"
                      className="text-lg font-black text-emerald-100"
                    >
                      실행 결과
                    </h3>
                    <p className="mt-1 text-xs font-bold text-[var(--theme-text-subtle)]">
                      stdout/stderr를 줄바꿈이 보존되는 콘솔 텍스트로 보여줘요.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConsoleExpanded(false)}
                    className="min-h-10 rounded-xl bg-[var(--theme-surface-muted)] px-3 py-2 text-sm font-black text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)]"
                  >
                    닫기
                  </button>
                </div>
                <div className="grid min-h-0 min-w-0 flex-1 gap-3 lg:grid-cols-2">
                  <section className="min-h-0 min-w-0">
                    <h4 className="mb-2 text-sm font-black text-[var(--theme-text)]">
                      stdout
                    </h4>
                    <pre className="max-h-[68vh] min-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-[var(--theme-border)] theme-console-block p-4 font-mono text-sm leading-relaxed">
                      {stdout || "표준 출력(stdout)이 여기에 표시돼요."}
                    </pre>
                  </section>
                  <section className="min-h-0 min-w-0">
                    <h4 className="mb-2 text-sm font-black text-rose-100">
                      stderr
                    </h4>
                    <pre className="max-h-[68vh] min-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-rose-300/15 bg-[var(--theme-bg)] p-4 font-mono text-sm leading-relaxed text-rose-100">
                      {stderr || "오류(stderr)가 있으면 여기에 표시돼요."}
                    </pre>
                  </section>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className="sticky bottom-3 z-10 grid min-w-0 grid-cols-2 gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/90 p-2 shadow-2xl shadow-slate-950/40 backdrop-blur sm:grid-cols-4"
            data-testid="python-studio-action-bar"
          >
            <button
              type="button"
              onClick={runPython}
              disabled={loading || runBusy || ended}
              className="min-h-11 rounded-xl bg-violet-300 px-3 py-2 text-sm font-black text-violet-950 hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runtimeStatus === "loading"
                ? "준비 중"
                : runtimeStatus === "running"
                  ? "실행 중"
                  : "실행"}
            </button>
            <button
              type="button"
              onClick={() => persist("save_code")}
              disabled={initialBusy || ended}
              className="min-h-11 rounded-xl bg-[var(--theme-accent)] px-3 py-2 text-sm font-black text-[var(--theme-accent-text)] hover:bg-[var(--theme-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving === "save" ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={() => persist("submit")}
              disabled={initialBusy || ended}
              className="min-h-11 rounded-xl bg-emerald-300 px-3 py-2 text-sm font-black text-emerald-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving === "submit" ? "제출 중..." : "제출하기"}
            </button>
            <button
              type="button"
              onClick={() => persist("reset_to_starter")}
              disabled={initialBusy || ended}
              className="min-h-11 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] px-3 py-2 text-sm font-black text-[var(--theme-text)] hover:bg-[var(--theme-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving === "reset" ? "복원 중..." : "처음 코드로 되돌리기"}
            </button>
          </div>

          {ended ? (
            <p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs font-bold leading-5 text-amber-50">
              수업 활동이 종료되어 코드를 더 이상 저장할 수 없습니다.
            </p>
          ) : null}
            </div>
          }
        />
      </div>
    </CodingActivityWorkspace>
  );
}
