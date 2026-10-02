"use client";

import { useEffect, useId, useRef, useState } from "react";

import { getConfiguredMonacoBaseUrl, getMonacoAssetPaths } from "@/lib/lesson-activities/monacoAssets";
import { WEB_CODING_LITE_CODE_MAX_LENGTH } from "@/lib/lesson-activities/webCodingLite";

export type CodeEditorLanguage = "html" | "css" | "javascript";

type MonacoEditorInstance = {
  dispose: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  updateOptions: (options: { readOnly?: boolean }) => void;
  onDidChangeModelContent: (listener: () => void) => { dispose: () => void };
  addCommand?: (keybinding: number, handler: () => void) => void;
};

type MonacoApi = {
  KeyMod?: { CtrlCmd: number };
  KeyCode?: { KeyS: number; Enter: number };
  editor: {
    create: (
      element: HTMLElement,
      options: {
        value: string;
        language: CodeEditorLanguage;
        theme: string;
        readOnly: boolean;
        minimap: { enabled: boolean };
        fontSize: number;
        fontFamily: string;
        wordWrap: "on";
        automaticLayout: boolean;
        tabSize: number;
        insertSpaces: boolean;
        scrollBeyondLastLine: boolean;
        smoothScrolling: boolean;
        renderLineHighlight: "line";
        overviewRulerLanes: number;
        contextmenu: boolean;
        ariaLabel: string;
      },
    ) => MonacoEditorInstance;
    defineTheme: (name: string, theme: Record<string, unknown>) => void;
    setTheme: (name: string) => void;
  };
};

type MonacoAmdRequire = {
  (modules: string[], onLoad: (monaco: MonacoApi) => void, onError?: (error: unknown) => void): void;
  config?: (config: { paths: Record<string, string> }) => void;
};

declare global {
  interface Window {
    monaco?: MonacoApi;
    require?: MonacoAmdRequire;
    MonacoEnvironment?: { getWorkerUrl?: (_moduleId: string, label: string) => string };
    __gomdoryMonacoLoaderPromise?: Promise<MonacoApi>;
    __gomdoryMonacoLoaderBaseUrl?: string;
  }
}

type Props = {
  language: CodeEditorLanguage;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  ariaLabel: string;
  onSaveShortcut?: () => void;
  onPreviewShortcut?: () => void;
};

const MONACO_THEME = "gomdory-dark-hud";
const MONACO_LOAD_TIMEOUT_MS = 10_000;
const MONACO_EDITOR_MODE_STORAGE_KEY = "gomdory:webStudioLite:editorMode";

function configureMonacoWorkers(baseUrl: string) {
  const paths = getMonacoAssetPaths(baseUrl);
  window.MonacoEnvironment = {
    getWorkerUrl: () => {
      const code = [
        `self.MonacoEnvironment={baseUrl:${JSON.stringify(paths.baseUrl)}};`,
        `try{importScripts(${JSON.stringify(paths.workerMainUrl)});}catch(error){console.warn("Gomdory Monaco worker unavailable",error);}`,
      ].join("");
      return `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
    },
  };
}

function loadScript(src: string, timeoutMs = MONACO_LOAD_TIMEOUT_MS): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[data-gomdory-monaco-loader="true"]`);
  if (existing?.dataset.gomdoryMonacoLoaderError === "true") existing.remove();

  const current = document.querySelector<HTMLScriptElement>(`script[data-gomdory-monaco-loader="true"]`);
  if (current) {
    return new Promise((resolve, reject) => {
      if (window["require"] || current.dataset.gomdoryMonacoLoaderLoaded === "true") {
        resolve();
        return;
      }
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        current.dataset.gomdoryMonacoLoaderError = "true";
        current.remove();
        reject(new Error("Monaco loader timed out"));
      }, timeoutMs);
      current.addEventListener("load", () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
      current.addEventListener("error", () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        current.dataset.gomdoryMonacoLoaderError = "true";
        reject(new Error("Monaco loader failed"));
      }, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      script.dataset.gomdoryMonacoLoaderError = "true";
      script.remove();
      reject(new Error("Monaco loader timed out"));
    }, timeoutMs);
    script.src = src;
    script.async = true;
    script.defer = true;
    script.dataset.gomdoryMonacoLoader = "true";
    script.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.dataset.gomdoryMonacoLoaderLoaded = "true";
      resolve();
    };
    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.dataset.gomdoryMonacoLoaderError = "true";
      reject(new Error("Monaco loader failed"));
    };
    document.head.appendChild(script);
  });
}

async function loadMonaco(): Promise<MonacoApi> {
  if (typeof window === "undefined") throw new Error("Monaco can only load in the browser");
  if (window.monaco) return window.monaco;
  const baseUrl = getConfiguredMonacoBaseUrl();
  if (window.__gomdoryMonacoLoaderPromise && window.__gomdoryMonacoLoaderBaseUrl === baseUrl) return window.__gomdoryMonacoLoaderPromise;

  const paths = getMonacoAssetPaths(baseUrl);
  window.__gomdoryMonacoLoaderBaseUrl = baseUrl;
  window.__gomdoryMonacoLoaderPromise = (async () => {
    try {
      configureMonacoWorkers(baseUrl);
      await loadScript(paths.loaderUrl);
      const amdRequire = window["require"];
      if (!amdRequire?.config) throw new Error("Monaco AMD loader unavailable");
      amdRequire.config({ paths: { vs: paths.amdVsPath } });
      return await new Promise<MonacoApi>((resolve, reject) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("Monaco editor timed out"));
        }, MONACO_LOAD_TIMEOUT_MS);
        amdRequire(["vs/editor/editor.main"], (monaco) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          monaco.editor.defineTheme(MONACO_THEME, {
            base: "vs-dark",
            inherit: true,
            rules: [
              { token: "", foreground: "cffafe", background: "020617" },
              { token: "tag", foreground: "67e8f9" },
              { token: "attribute.name", foreground: "fde68a" },
              { token: "string", foreground: "bbf7d0" },
              { token: "keyword", foreground: "c4b5fd" },
            ],
            colors: {
              "editor.background": "#020617",
              "editor.foreground": "#cffafe",
              "editorCursor.foreground": "#67e8f9",
              "editor.lineHighlightBackground": "#0f172a",
              "editor.selectionBackground": "#155e75aa",
              "editor.inactiveSelectionBackground": "#164e6380",
              "editorLineNumber.foreground": "#64748b",
              "editorLineNumber.activeForeground": "#a5f3fc",
            },
          });
          monaco.editor.setTheme(MONACO_THEME);
          resolve(monaco);
        }, (error) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      delete window.__gomdoryMonacoLoaderPromise;
      throw error;
    }
  })();

  return window.__gomdoryMonacoLoaderPromise;
}

function shouldStartSimple(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = window.localStorage.getItem(MONACO_EDITOR_MODE_STORAGE_KEY);
    if (saved === "simple") return true;
    if (saved === "advanced") return false;
  } catch {
    return true;
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const smallScreen = window.matchMedia("(max-width: 767px)").matches;
  const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
  return reducedMotion || smallScreen || saveData;
}

function TextareaFallback({ language, value, onChange, readOnly = false, ariaLabel }: Props) {
  const helpId = useId();
  return (
    <div className="min-w-0">
      <textarea
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        spellCheck={false}
        maxLength={WEB_CODING_LITE_CODE_MAX_LENGTH}
        readOnly={readOnly}
        aria-label={ariaLabel}
        aria-describedby={helpId}
        data-testid="web-coding-lite-textarea-fallback"
        data-language={language}
        className="h-[46vh] min-h-[300px] max-h-[560px] w-full max-w-full resize-y overflow-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/90 px-3 py-3 font-mono text-[13px] leading-5 text-[var(--theme-text)] outline-none focus:border-[var(--theme-border-strong)] focus:ring-4 focus:ring-[var(--theme-focus)] read-only:cursor-default read-only:opacity-80 sm:h-[440px]"
      />
      <p id={helpId} className="sr-only">
        간단 편집기입니다. HTML, CSS, JavaScript 중 선택된 탭의 코드를 입력합니다.
      </p>
    </div>
  );
}

export function CodeEditorPane({ language, value, onChange, readOnly = false, ariaLabel, onSaveShortcut, onPreviewShortcut }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const latestValueRef = useRef(value);
  const [mounted, setMounted] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);
  const [monacoFailed, setMonacoFailed] = useState(false);
  const [loadingMonaco, setLoadingMonaco] = useState(false);

  latestValueRef.current = value;

  useEffect(() => {
    setMounted(true);
    setSimpleMode(shouldStartSimple());
  }, []);

  useEffect(() => {
    if (!mounted || simpleMode || monacoFailed || !containerRef.current) return undefined;
    let disposed = false;
    let changeSubscription: { dispose: () => void } | null = null;
    setLoadingMonaco(true);

    loadMonaco()
      .then((monaco) => {
        if (disposed || !containerRef.current) return;
        const editor = monaco.editor.create(containerRef.current, {
          value: latestValueRef.current,
          language,
          theme: MONACO_THEME,
          readOnly,
          minimap: { enabled: false },
          fontSize: 15,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          renderLineHighlight: "line",
          overviewRulerLanes: 0,
          contextmenu: false,
          ariaLabel,
        });
        editorRef.current = editor;
        changeSubscription = editor.onDidChangeModelContent(() => {
          const next = editor.getValue();
          if (next.length > WEB_CODING_LITE_CODE_MAX_LENGTH) {
            const truncated = next.slice(0, WEB_CODING_LITE_CODE_MAX_LENGTH);
            editor.setValue(truncated);
            onChange(truncated);
            return;
          }
          onChange(next);
        });
        if (monaco.KeyMod && monaco.KeyCode && onSaveShortcut) {
          editor.addCommand?.(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, onSaveShortcut);
        }
        if (monaco.KeyMod && monaco.KeyCode && onPreviewShortcut) {
          editor.addCommand?.(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, onPreviewShortcut);
        }
      })
      .catch(() => {
        if (!disposed) setMonacoFailed(true);
      })
      .finally(() => {
        if (!disposed) setLoadingMonaco(false);
      });

    return () => {
      disposed = true;
      changeSubscription?.dispose();
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, [ariaLabel, language, mounted, monacoFailed, onChange, onPreviewShortcut, onSaveShortcut, readOnly, simpleMode]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== value) editor.setValue(value);
  }, [value]);

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly });
  }, [readOnly]);

  const useTextarea = !mounted || simpleMode || monacoFailed;
  const activeModeLabel = useTextarea ? "간단 편집기" : "고급 편집기";
  const toggleLabel = useTextarea ? "고급 편집기" : "간단 편집기";

  const setMode = (nextSimple: boolean) => {
    setSimpleMode(nextSimple);
    setMonacoFailed(false);
    try {
      window.localStorage.setItem(MONACO_EDITOR_MODE_STORAGE_KEY, nextSimple ? "simple" : "advanced");
    } catch {
      // Storage may be unavailable in locked-down browsers; keep the in-memory mode only.
    }
  };

  const retryAdvancedEditor = () => setMode(false);

  return (
    <div className="block min-w-0">
      <div className="mb-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="block text-xs font-black uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{ariaLabel}</span>
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-[var(--theme-text-subtle)]">
          <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-card-muted)] px-2 py-1 font-black text-[var(--theme-text)]">{activeModeLabel}</span>
          {loadingMonaco ? <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-2 py-1 text-[var(--theme-text-muted)]">고급 편집기를 불러오는 중…</span> : null}
          {monacoFailed ? <span className="rounded-full border border-amber-200/30 bg-amber-300/10 px-2 py-1 text-amber-100">고급 편집기를 불러오지 못해 간단 편집기로 열었어요.</span> : null}
          {monacoFailed ? (
            <button
              type="button"
              onClick={retryAdvancedEditor}
              className="min-h-9 rounded-full border border-amber-200/40 bg-amber-300/10 px-3 py-1 font-black text-amber-50 outline-none hover:bg-amber-300/20 focus-visible:ring-4 focus-visible:ring-amber-200/20"
            >
              고급 편집기 다시 시도
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setMode(!useTextarea)}
            className="min-h-9 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card-muted)] px-3 py-1 font-black text-[var(--theme-text)] outline-none hover:border-[var(--theme-border-strong)] focus-visible:ring-4 focus-visible:ring-cyan-200/20"
            aria-pressed={!useTextarea}
          >
            {toggleLabel}
          </button>
        </div>
      </div>

      {useTextarea ? (
        <TextareaFallback language={language} value={value} onChange={onChange} readOnly={readOnly} ariaLabel={ariaLabel} />
      ) : (
        <div
          ref={containerRef}
          role="group"
          aria-label={ariaLabel}
          data-testid="web-coding-lite-monaco-container"
          className="h-[46vh] min-h-[300px] max-h-[560px] w-full max-w-full overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/90 outline-none focus-within:border-[var(--theme-border-strong)] focus-within:ring-4 focus-within:ring-[var(--theme-focus)] sm:h-[440px]"
        />
      )}

      <span className="mt-1 block text-right text-[11px] text-[var(--theme-text-subtle)]">
        {value.length.toLocaleString()} / {WEB_CODING_LITE_CODE_MAX_LENGTH.toLocaleString()}
      </span>
    </div>
  );
}

export default CodeEditorPane;
