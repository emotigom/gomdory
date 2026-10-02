"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buildPreviewHtml } from "@/lib/labs/buildPreviewHtml";
import { apiV1Path } from "@/lib/standards/pathTypes";

const STORAGE_KEY = "gomdory.labs.practice.v1";

const STARTER = {
  html: `<main class="app">
  <h1>Practice Workspace</h1>
  <p>HTML/CSS/JS를 수정하고 미리보기로 확인해 보세요.</p>
  <button id="count-btn">클릭: <span id="count">0</span></button>
</main>`,
  css: `:root {
  color-scheme: light;
  font-family: "Inter", "Pretendard", system-ui, -apple-system, sans-serif;
}

body {
  margin: 0;
  padding: 24px;
  background: #f8fafc;
  color: #0f172a;
}

.app {
  max-width: 560px;
  padding: 20px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background: #ffffff;
}

button {
  margin-top: 12px;
  border: 1px solid #0f172a;
  background: #0f172a;
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
}`,
  js: `let count = 0;
const countEl = document.getElementById("count");
const button = document.getElementById("count-btn");

button?.addEventListener("click", () => {
  count += 1;
  if (countEl) countEl.textContent = String(count);
});`,
};

type EnsureResponse = {
  ok: true;
  createdCount: number;
  updatedCount?: number;
};

type EnsureError = {
  ok: false;
  message?: string;
};

type SaveSubmitResponse = {
  ok: boolean;
  message?: string;
};

export default function PracticeWorkspaceClient({
  boardId,
  practiceEnabled,
}: {
  boardId?: string;
  practiceEnabled?: boolean;
}) {
  const [html, setHtml] = useState(STARTER.html);
  const [css, setCss] = useState(STARTER.css);
  const [js, setJs] = useState(STARTER.js);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [templateStatus, setTemplateStatus] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"save" | "submit" | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { html?: string; css?: string; js?: string };
      if (typeof parsed.html === "string") setHtml(parsed.html);
      if (typeof parsed.css === "string") setCss(parsed.css);
      if (typeof parsed.js === "string") setJs(parsed.js);
    } catch {
      // ignore malformed local storage
    }
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({ html, css, js, updatedAt: new Date().toISOString() });
    window.localStorage.setItem(STORAGE_KEY, payload);
  }, [html, css, js]);

  const srcDoc = useMemo(() => {
    void previewRevision;
    return buildPreviewHtml({ html, css, js });
  }, [html, css, js, previewRevision]);

  const refreshPreview = useCallback(() => {
    setPreviewRevision((prev) => prev + 1);
  }, []);

  const handleReset = useCallback(() => {
    setHtml(STARTER.html);
    setCss(STARTER.css);
    setJs(STARTER.js);
    refreshPreview();
  }, [refreshPreview]);

  const handleCopySnippet = useCallback(async () => {
    const snippet = `${"```html"}\n${html}\n\n${"```css"}\n${css}\n\n${"```js"}\n${js}\n${"```"}`;
    await navigator.clipboard.writeText(snippet);
    setTemplateStatus("코드 스니펫을 복사했어요.");
    setTemplateError(null);
  }, [html, css, js]);

  const handleEnsureTemplate = useCallback(async () => {
    if (!boardId || templateLoading) return;
    setTemplateLoading(true);
    setTemplateError(null);
    setTemplateStatus(null);
    try {
      const response = await fetch(apiV1Path("edu/course/ensure"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, mode: "practiceTemplate" }),
      });
      const payload = (await response.json()) as EnsureResponse | EnsureError;
      if (!response.ok || !payload.ok) {
        setTemplateError((payload as EnsureError).message ?? "템플릿 생성에 실패했습니다.");
        return;
      }
      const result = payload as EnsureResponse;
      const changed = result.createdCount + (result.updatedCount ?? 0);
      setTemplateStatus(changed === 0 ? "이미 준비되어 있어요." : "템플릿을 준비했어요.");
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "템플릿 생성에 실패했습니다.");
    } finally {
      setTemplateLoading(false);
    }
  }, [boardId, templateLoading]);

  const handleBoardAction = useCallback(
    async (action: "save" | "submit") => {
      if (!practiceEnabled || !boardId || actionLoading) return;
      setActionLoading(action);
      setActionError(null);
      setActionStatus(null);
      try {
        const response = await fetch(apiV1Path("labs/practice/cards"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId, action, title: "실습 제출", html, css, js }),
        });
        const payload = (await response.json()) as SaveSubmitResponse;
        if (!response.ok || !payload.ok) {
          setActionError(payload.message ?? "카드 저장에 실패했습니다.");
          return;
        }
        setActionStatus(action === "save" ? "보드에 저장했습니다." : "제출 카드로 등록했습니다.");
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "카드 저장에 실패했습니다.");
      } finally {
        setActionLoading(null);
      }
    },
    [actionLoading, boardId, css, html, js, practiceEnabled],
  );

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-neutral-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Practice Workspace</h2>
          <div className="flex gap-2">
            <button className="rounded border px-2 py-1 text-xs" type="button" onClick={refreshPreview}>
              미리보기 새로고침 (⌘/Ctrl+Enter)
            </button>
            <button className="rounded border px-2 py-1 text-xs" type="button" onClick={handleReset}>
              템플릿으로 초기화
            </button>
            <button className="rounded border px-2 py-1 text-xs" type="button" onClick={handleCopySnippet}>
              코드 스니펫 복사
            </button>
            <button
              className="rounded border px-2 py-1 text-xs"
              type="button"
              disabled={!practiceEnabled || !boardId || actionLoading !== null}
              onClick={() => void handleBoardAction("save")}
            >
              {actionLoading === "save" ? "저장 중..." : "보드에 저장"}
            </button>
            <button
              className="rounded border border-neutral-900 bg-neutral-900 px-2 py-1 text-xs text-white"
              type="button"
              disabled={!practiceEnabled || !boardId || actionLoading !== null}
              onClick={() => void handleBoardAction("submit")}
            >
              {actionLoading === "submit" ? "제출 중..." : "제출"}
            </button>
          </div>
        </div>
        {actionStatus ? <p className="mt-2 text-xs text-emerald-600">{actionStatus}</p> : null}
        {actionError ? <p className="mt-2 text-xs text-rose-600">{actionError}</p> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {[
          { label: "index.html", value: html, setter: setHtml },
          { label: "style.css", value: css, setter: setCss },
          { label: "script.js", value: js, setter: setJs },
        ].map((editor) => (
          <label key={editor.label} className="flex flex-col gap-1 text-xs font-semibold text-neutral-700">
            {editor.label}
            <textarea
              className="h-56 rounded border border-neutral-300 bg-neutral-950 p-3 font-mono text-xs text-neutral-100"
              value={editor.value}
              onChange={(event) => editor.setter(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  refreshPreview();
                }
              }}
            />
          </label>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-200 p-2">
        <iframe
          title="practice-preview"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          className="h-72 w-full rounded border border-neutral-200 bg-white"
        />
      </div>

      <div className="rounded-lg border border-neutral-200 p-4 text-xs text-neutral-600">
        <p className="font-semibold text-neutral-900">4교시 실습 템플릿 생성</p>
        <button
          type="button"
          onClick={handleEnsureTemplate}
          disabled={!boardId || templateLoading}
          className="mt-2 rounded-md border border-neutral-900 bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300"
        >
          {!boardId ? "보드에서 실행해주세요." : templateLoading ? "생성 중..." : "4교시 실습 템플릿 생성"}
        </button>
        {templateStatus ? <p className="mt-2 text-emerald-600">{templateStatus}</p> : null}
        {templateError ? <p className="mt-2 text-rose-600">{templateError}</p> : null}
      </div>
    </section>
  );
}
