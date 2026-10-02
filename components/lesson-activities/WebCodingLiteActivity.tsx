"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  resolveWebCodingLiteHintsEnabled,
  type WebCodingLiteConfig,
  type WebCodingLiteState,
} from "@/lib/lesson-activities/webCodingLite";
import {
  generateWebCodingHint,
  type WebCodingHint,
  type WebCodingHintCategory,
  type WebCodingHintLevel,
} from "@/lib/lesson-activities/webCodingHints";
import { routes } from "@/lib/standards/routes";

import CodeEditorPane, { type CodeEditorLanguage } from "./CodeEditorPane";
import CodingActivityWorkspace from "./CodingActivityWorkspace";
import ResizableSplitPane from "./ResizableSplitPane";

type WebCodingLitePayload = {
  activityRun: {
    id: string;
    activityType: "web_coding_lite";
    status: "active" | "ended";
    config: WebCodingLiteConfig;
  };
  state: WebCodingLiteState;
  status: "in_progress" | "completed";
};

type Props = {
  shareCode: string;
  displayName?: string | null;
};

type EditorTab = "html" | "css" | "js";
type HintPanelLevel = 0 | WebCodingHintLevel;

const tabLabels: Record<EditorTab, string> = {
  html: "HTML",
  css: "CSS",
  js: "JS",
};

const hintCategoryLabels: Record<WebCodingHintCategory, string> = {
  html: "HTML",
  css: "CSS",
  js: "JavaScript",
  runtime: "실행 오류",
  concept: "생각하기",
  next_step: "생각하기",
};

const hintCategoryClasses: Record<WebCodingHintCategory, string> = {
  html: "border-orange-200/40 bg-orange-300/15 text-orange-100",
  css: "border-sky-200/40 bg-sky-300/15 text-sky-100",
  js: "border-yellow-200/40 bg-yellow-300/15 text-yellow-100",
  runtime: "border-amber-200/50 bg-amber-300/15 text-amber-100",
  concept: "border-violet-200/40 bg-violet-300/15 text-violet-100",
  next_step: "border-[var(--theme-border)] bg-[var(--theme-accent)]/15 text-[var(--theme-text-muted)]",
};

function createParticipantKey(shareCode: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `web_${shareCode}_${random}`
    .replace(/[^A-Za-z0-9:_-]/g, "_")
    .slice(0, 96);
}

function getParticipantKey(shareCode: string): string {
  const storageKey = `gomdory:activityParticipant:${shareCode}:web_coding_lite`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const next = createParticipantKey(shareCode);
  window.localStorage.setItem(storageKey, next);
  return next;
}

function escapeScriptClose(value: string): string {
  return value
    .replace(/<\/script/gi, "<\\/script")
    .replace(/<\/style/gi, "<\\/style");
}

export function buildWebCodingLitePreviewSrcDoc(
  html: string,
  css: string,
  js: string,
): string {
  const safeCss = escapeScriptClose(css);
  const safeJs = escapeScriptClose(js);
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${safeCss}</style>
</head>
<body>
${html}
<script>
window.onerror = function(message, source, lineno, colno) {
  window.parent.postMessage({ source: "gomdory-web-coding-lite-preview", type: "runtime_error", message: String(message), line: lineno, column: colno }, "*");
};
window.addEventListener("unhandledrejection", function(event) {
  window.parent.postMessage({ source: "gomdory-web-coding-lite-preview", type: "runtime_error", message: String(event.reason && event.reason.message ? event.reason.message : event.reason) }, "*");
});
try {
${safeJs}
} catch (error) {
  window.parent.postMessage({ source: "gomdory-web-coding-lite-preview", type: "runtime_error", message: String(error && error.message ? error.message : error) }, "*");
}
<\/script>
</body>
</html>`;
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

export default function WebCodingLiteActivity({
  shareCode,
  displayName,
}: Props) {
  const [participantKey, setParticipantKey] = useState<string | null>(null);
  const [payload, setPayload] = useState<WebCodingLitePayload | null>(null);
  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [js, setJs] = useState("");
  const [previewSrcDoc, setPreviewSrcDoc] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [previewTimedOut, setPreviewTimedOut] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("html");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"save" | "submit" | "reset" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState<HintPanelLevel>(0);
  const [hintPanelOpen, setHintPanelOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const submitted = payload?.state.submitted === true;
  const ended = payload?.activityRun.status === "ended";
  const dirty = payload
    ? html !== payload.state.html ||
      css !== payload.state.css ||
      js !== payload.state.js
    : false;
  const busy = loading || saving !== null;
  const savedLabel = formatTimestamp(payload?.state.savedAt ?? null);
  const submittedLabel = formatTimestamp(payload?.state.submittedAt ?? null);
  const activeValue = useMemo(
    () => ({ html, css, js })[activeTab],
    [activeTab, css, html, js],
  );
  const activeLanguage: CodeEditorLanguage =
    activeTab === "js" ? "javascript" : activeTab;
  const hintsEnabled = payload
    ? resolveWebCodingLiteHintsEnabled(payload.activityRun.config)
    : true;
  const currentHint = useMemo<WebCodingHint | null>(() => {
    if (!hintsEnabled || hintLevel === 0) return null;
    return generateWebCodingHint({
      html,
      css,
      js,
      runtimeError,
      activityTemplateId: payload?.activityRun.config.title,
      hintLevel,
    });
  }, [
    css,
    hintLevel,
    hintsEnabled,
    html,
    js,
    payload?.activityRun.config.title,
    runtimeError,
  ]);
  const statusText = ended
    ? "수업이 종료되어 더 이상 저장할 수 없어요."
    : submitted
      ? `제출 완료${submittedLabel ? ` · ${submittedLabel}` : ""}`
      : dirty
        ? "저장하지 않은 변경 사항이 있어요."
        : savedLabel
          ? `저장 완료 · ${savedLabel}`
          : "아직 저장 전이에요.";

  useEffect(() => {
    try {
      setParticipantKey(getParticipantKey(shareCode));
    } catch {
      setParticipantKey(createParticipantKey(shareCode));
    }
  }, [shareCode]);

  useEffect(() => {
    if (!participantKey) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(
          routes.api.share.activityState(shareCode),
          window.location.origin,
        );
        url.searchParams.set("activityType", "web_coding_lite");
        if (displayName) url.searchParams.set("displayName", displayName);
        const response = await fetch(url, {
          headers: { "x-gomdory-participant-key": participantKey },
          cache: "no-store",
        });
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: WebCodingLitePayload;
          error?: { message?: string };
        } | null;
        if (!response.ok || !json?.ok || !json.data)
          throw new Error(
            json?.error?.message ?? "웹 코딩 실습을 불러오지 못했습니다.",
          );
        if (!cancelled) {
          setPayload(json.data);
          setHtml(json.data.state.html);
          setCss(json.data.state.css);
          setJs(json.data.state.js);
          setRuntimeError(null);
          setPreviewTimedOut(false);
          setPreviewSrcDoc(
            buildWebCodingLitePreviewSrcDoc(
              json.data.state.html,
              json.data.state.css,
              json.data.state.js,
            ),
          );
          setPreviewKey((key) => key + 1);
        }
      } catch (loadError) {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "웹 코딩 실습을 불러오지 못했습니다.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [displayName, participantKey, shareCode]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        !iframeRef.current?.contentWindow ||
        event.source !== iframeRef.current.contentWindow
      )
        return;
      const data = event.data as {
        source?: string;
        type?: string;
        message?: string;
        line?: number;
        column?: number;
      } | null;
      if (
        !data ||
        data.source !== "gomdory-web-coding-lite-preview" ||
        data.type !== "runtime_error"
      )
        return;
      const safeMessage = String(data.message ?? "미리보기 오류").slice(0, 500);
      const position = data.line
        ? ` (${data.line}${data.column ? `:${data.column}` : ""})`
        : "";
      setRuntimeError(`${safeMessage}${position}`);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!previewSrcDoc) return undefined;
    setPreviewTimedOut(false);
    const timer = window.setTimeout(() => setPreviewTimedOut(true), 3000);
    return () => window.clearTimeout(timer);
  }, [previewKey, previewSrcDoc]);

  const setActiveValue = useCallback(
    (next: string) => {
      if (activeTab === "html") setHtml(next);
      if (activeTab === "css") setCss(next);
      if (activeTab === "js") setJs(next);
    },
    [activeTab],
  );

  useEffect(() => {
    if (!hintsEnabled) {
      setHintPanelOpen(false);
      setHintLevel(0);
    }
  }, [hintsEnabled]);

  const showNextHint = useCallback(() => {
    if (!hintsEnabled) return;
    setHintPanelOpen(true);
    setHintLevel((level) =>
      level === 0 ? 1 : level < 3 ? ((level + 1) as WebCodingHintLevel) : 3,
    );
  }, [hintsEnabled]);

  const runPreview = useCallback(() => {
    setRuntimeError(null);
    setPreviewTimedOut(false);
    setPreviewSrcDoc(buildWebCodingLitePreviewSrcDoc(html, css, js));
    setPreviewKey((key) => key + 1);
  }, [css, html, js]);

  const patchState = useCallback(
    async (operation: "save_code" | "submit" | "reset_to_starter") => {
      if (!payload || !participantKey || ended) return;
      setSaving(
        operation === "submit"
          ? "submit"
          : operation === "reset_to_starter"
            ? "reset"
            : "save",
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
              activityType: "web_coding_lite",
              operation,
              activityRunId: payload.activityRun.id,
              html,
              css,
              js,
              displayName,
            }),
          },
        );
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          data?: WebCodingLitePayload;
          error?: { message?: string };
        } | null;
        if (!response.ok || !json?.ok || !json.data)
          throw new Error(
            json?.error?.message ?? "웹 코딩 실습을 저장하지 못했습니다.",
          );
        setPayload(json.data);
        setHtml(json.data.state.html);
        setCss(json.data.state.css);
        setJs(json.data.state.js);
        setRuntimeError(null);
        setPreviewTimedOut(false);
        setPreviewSrcDoc(
          buildWebCodingLitePreviewSrcDoc(
            json.data.state.html,
            json.data.state.css,
            json.data.state.js,
          ),
        );
        setPreviewKey((key) => key + 1);
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "웹 코딩 실습을 저장하지 못했습니다.",
        );
      } finally {
        setSaving(null);
      }
    },
    [css, displayName, ended, html, js, participantKey, payload, shareCode],
  );

  const resetToStarter = useCallback(() => {
    if (
      !window.confirm(
        "처음 코드로 되돌릴까요? 현재 수정한 HTML/CSS/JavaScript는 사라집니다.",
      )
    )
      return;
    void patchState("reset_to_starter");
  }, [patchState]);

  const saveFromShortcut = useCallback(() => {
    if (busy || ended) return;
    void patchState("save_code");
  }, [busy, ended, patchState]);

  const handleEditorShortcuts = (event: KeyboardEvent<HTMLElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      saveFromShortcut();
    }
    if (key === "enter") {
      event.preventDefault();
      runPreview();
    }
  };

  return (
    <CodingActivityWorkspace
      testId="web-coding-lite-activity"
      accent="cyan"
      onKeyDownCapture={handleEditorShortcuts}
      eyebrow="Web Studio Lite"
      title="웹 코딩 실습실"
      description="HTML, CSS, JavaScript를 수정하고 결과를 바로 확인해 보세요."
      detail="제출 후에도 수업이 끝나기 전까지 수정할 수 있어요. 저장 버튼을 눌러야 진행 상황이 남습니다."
      badges={
        <span
          className={`w-fit shrink-0 rounded-full border px-3 py-1 text-[11px] font-black ${submitted ? "border-emerald-200/50 bg-emerald-300/15 text-emerald-100" : dirty ? "border-amber-200/50 bg-amber-300/15 text-amber-100" : "border-[var(--theme-border)] bg-[var(--theme-accent)]/10 text-[var(--theme-text-muted)]"}`}
        >
          {submitted
            ? "제출 완료"
            : dirty
              ? "수정 중"
              : savedLabel
                ? "저장 완료"
                : "저장 필요"}
        </span>
      }
      status={
        <div
          className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 text-xs leading-5 text-[var(--theme-text)]"
          data-testid="web-coding-lite-status"
        >
          {statusText}
        </div>
      }
      alerts={
        <>
          {loading ? (
            <p className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-sm text-[var(--theme-text-muted)]">
              웹 코딩 실습을 준비하고 있어요...
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-2xl border border-rose-300/30 bg-rose-400/10 p-3 text-xs leading-5 text-rose-100"
            >
              {error}
            </p>
          ) : null}
        </>
      }
      missionTitle="힌트 코치"
      missionDefaultOpen={false}
      mission={
        payload && hintsEnabled ? (
          <div className="min-w-0" data-testid="web-coding-lite-hint-coach">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black text-[var(--theme-text)]">힌트 코치</p>
                <p className="text-xs leading-5 text-violet-100/80">
                  코드를 대신 완성하지 않고, 막힌 지점을 단계별로 짧게 짚어줘요.
                </p>
              </div>
              <button
                type="button"
                onClick={showNextHint}
                disabled={hintLevel === 3 && hintPanelOpen}
                className="min-h-10 shrink-0 rounded-xl bg-violet-300 px-3 py-2 text-xs font-black text-violet-950 hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {hintLevel === 0 || !hintPanelOpen
                  ? "힌트 보기"
                  : currentHint?.canShowNextHint
                    ? "다음 힌트"
                    : "마지막 힌트"}
              </button>
            </div>
            {currentHint && hintPanelOpen ? (
              <div
                className="mt-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3"
                data-testid="web-coding-lite-hint-panel"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-violet-200/40 bg-violet-300/10 px-2 py-0.5 text-[11px] font-black text-violet-100">
                        {currentHint.level}단계 힌트
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${hintCategoryClasses[currentHint.category]}`}
                      >
                        {hintCategoryLabels[currentHint.category]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-black text-[var(--theme-text)]">
                      {currentHint.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-violet-50">
                      {currentHint.message}
                    </p>
                    {runtimeError && currentHint.category === "runtime" ? (
                      <p className="mt-2 rounded-xl border border-amber-200/30 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100">
                        오류 메시지: {runtimeError}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setHintPanelOpen(false)}
                    className="shrink-0 rounded-lg border border-[var(--theme-border)] px-2 py-1 text-[11px] font-bold text-[var(--theme-text)] hover:border-violet-200"
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : payload ? (
          <div
            className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 text-xs leading-5 text-[var(--theme-text-muted)]"
            data-testid="web-coding-lite-hints-disabled"
          >
            현재 수업에서는 선생님이 힌트를 꺼두었어요.
          </div>
        ) : null
      }
    >
      {payload ? (
        <div data-testid="coding-workspace-main-grid" className="min-w-0 max-w-full">
          <ResizableSplitPane
            defaultLeftPercent={58}
            minLeftPercent={45}
            maxLeftPercent={70}
            storageKey="gomdory:web-coding-lite:split-pane"
            left={
              <div className="min-w-0 rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3">
            <div
              className="grid grid-cols-3 gap-2"
              role="tablist"
              aria-label="코드 편집 탭"
            >
              {(Object.keys(tabLabels) as EditorTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`min-h-11 min-w-0 rounded-xl border px-2 py-2 text-xs font-black transition sm:text-sm ${activeTab === tab ? "border-[var(--theme-border-strong)] bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-[0_0_0_3px_rgba(103,232,249,0.18)]" : "border-[var(--theme-border)] bg-[var(--theme-card-muted)] text-[var(--theme-text)] hover:border-[var(--theme-border-strong)]"}`}
                  aria-selected={activeTab === tab}
                  role="tab"
                >
                  <span className="truncate">{tabLabels[tab]}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 min-w-0">
              <CodeEditorPane
                language={activeLanguage}
                value={activeValue}
                readOnly={ended}
                ariaLabel={tabLabels[activeTab]}
                onChange={setActiveValue}
                onSaveShortcut={saveFromShortcut}
                onPreviewShortcut={runPreview}
              />
            </div>
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[1fr_1fr_1.25fr]">
              <button
                type="button"
                onClick={() => void patchState("save_code")}
                disabled={busy || ended}
                className="min-h-11 rounded-2xl bg-[var(--theme-accent)] px-4 py-2 text-sm font-black text-[var(--theme-accent-text)] hover:bg-[var(--theme-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === "save"
                  ? "저장 중..."
                  : savedLabel && !dirty
                    ? "저장 완료"
                    : "저장"}
              </button>
              <button
                type="button"
                onClick={() => void patchState("submit")}
                disabled={busy || ended}
                className="min-h-11 rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-black text-emerald-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === "submit"
                  ? "제출 중..."
                  : submitted
                    ? "다시 제출하기"
                    : "제출하기"}
              </button>
              <button
                type="button"
                onClick={resetToStarter}
                disabled={busy || ended}
                className="min-h-11 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] px-4 py-2 text-sm font-black text-[var(--theme-text)] hover:border-[var(--theme-border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === "reset" ? "되돌리는 중..." : "처음 코드로 되돌리기"}
              </button>
            </div>
              </div>
            }
            right={
              <div className="min-w-0 rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black text-[var(--theme-text)]">미리보기</p>
                <p className="text-xs leading-5 text-[var(--theme-text-subtle)]">
                  sandbox=&quot;allow-scripts&quot; iframe에서만 실행됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={runPreview}
                className="shrink-0 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-accent)]/10 px-3 py-2 text-xs font-black text-[var(--theme-text)] hover:bg-[var(--theme-accent)]/20"
              >
                미리보기 새로고침
              </button>
            </div>
            {runtimeError ? (
              <p
                role="alert"
                data-testid="web-coding-lite-preview-error"
                className="mt-3 rounded-xl border border-amber-200/40 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100"
              >
                코드를 실행하는 중 오류가 발생했어요. {runtimeError}
              </p>
            ) : null}
            {previewTimedOut ? (
              <p className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card-muted)] px-3 py-2 text-xs leading-5 text-[var(--theme-text)]">
                미리보기가 오래 걸리고 있어요. 코드에 무한 반복이 있으면
                새로고침 버튼으로 다시 시작해 주세요.
              </p>
            ) : null}
            <iframe
              key={previewKey}
              ref={iframeRef}
              title="웹 코딩 실습 미리보기"
              srcDoc={previewSrcDoc}
              sandbox="allow-scripts"
              onLoad={() => setPreviewTimedOut(false)}
              className="mt-3 h-[52vh] min-h-[360px] w-full min-w-0 max-w-full rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] sm:h-[560px]"
            />
              </div>
            }
          />
        </div>
      ) : null}
    </CodingActivityWorkspace>
  );
}
