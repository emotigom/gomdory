"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createZip } from "@/lib/board/zipWriter";
import OverlayModal from "@/app/edu/_components/OverlayModal";
import SplitPane from "@/components/ui/SplitPane";

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export type WorkspaceFile = {
  content: string;
  contentType: "text/html" | "text/css" | "text/javascript";
};

export type WorkspaceProps = {
  files: Record<string, WorkspaceFile>;
  onFilesChange: (nextFiles: Record<string, WorkspaceFile>) => void;
  onResetToTemplate?: () => void;
  lessonTitle?: string;
  projectTitle?: string;
  previewSlug?: string | null;
  initialPresentOpen?: boolean;
};

export const buildPreviewDoc = (files: Record<string, WorkspaceFile>) => {
  const html = files["index.html"]?.content ?? "<!doctype html><html><body></body></html>";
  const css = files["style.css"]?.content ?? "";
  const js = files["script.js"]?.content ?? files["main.js"]?.content ?? "";

  let doc = html;
  // srcDoc 기반 프리뷰에서는 상대경로가 현재 라우트로 해석되어 script.js가 HTML/404를 받는 일이 있어,
  // 로컬 파일 참조(style.css/script.js/main.js)를 제거하고 inline으로 고정한다.
  doc = doc
    .replace(/<link[^>]*href=["']\.\/style\.css["'][^>]*>\s*/gi, "")
    .replace(/<link[^>]*href=["']style\.css["'][^>]*>\s*/gi, "")
    .replace(/<script[^>]*src=["']\.\/script\.js["'][^>]*><\/script>\s*/gi, "")
    .replace(/<script[^>]*src=["']script\.js["'][^>]*><\/script>\s*/gi, "")
    .replace(/<script[^>]*src=["']\.\/main\.js["'][^>]*><\/script>\s*/gi, "")
    .replace(/<script[^>]*src=["']main\.js["'][^>]*><\/script>\s*/gi, "");

  if (doc.includes("</head>")) {
    doc = doc.replace("</head>", `<style>${css}</style></head>`);
  } else {
    doc = `<style>${css}</style>${doc}`;
  }

  if (doc.includes("</body>")) {
    doc = doc.replace("</body>", `<script>${js}</script></body>`);
  } else {
    doc = `${doc}<script>${js}</script>`;
  }

  return doc;
};

export default function Workspace({
  files,
  onFilesChange,
  onResetToTemplate,
  lessonTitle,
  projectTitle,
  previewSlug,
  initialPresentOpen = false,
}: WorkspaceProps) {
  const ENABLE_CSS_FORMATTER = true;
  const [activeFile, setActiveFile] = useState<string>(Object.keys(files)[0] ?? "");
  const [mobilePane, setMobilePane] = useState<"preview" | "code">("preview");
  const [presentOpen, setPresentOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setActiveFile((prev) => (prev && files[prev] ? prev : Object.keys(files)[0] ?? ""));
  }, [files]);

  useEffect(() => {
    if (initialPresentOpen) {
      setPresentOpen(true);
    }
  }, [initialPresentOpen]);

  const previewDoc = useMemo(() => buildPreviewDoc(files), [files]);
  const previewKey = useMemo(() => `preview-${hashString(previewDoc)}`, [previewDoc]);
  const activeContent = activeFile ? files[activeFile]?.content ?? "" : "";
  const modalTitle = `${lessonTitle ?? "교시"} · ${projectTitle ?? "프로젝트"}`;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const INDENT = "  "; // 2 spaces (교육용 안전값)

  useEffect(() => {
    const frame = previewIframeRef.current;
    if (!frame) return;
    const expectedHash = hashString(previewDoc);
    const timer = window.setTimeout(() => {
      const currentSrcdoc = frame.getAttribute("srcdoc") ?? previewDoc;
      const previewHtmlHash = hashString(currentSrcdoc);
      const matchesCommitted = previewHtmlHash === expectedHash;
      console.info("[decorate] preview_state", {
        previewHtmlHash,
        matchesCommitted,
      });
      if (!matchesCommitted) {
        console.warn("[decorate] preview source mismatch", {
          iframeSrc: frame.getAttribute("src") ?? null,
          srcdocLength: currentSrcdoc.length,
          lastUpdatedAt: Date.now(),
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [previewDoc, previewKey]);

  const isCssFile = (filename?: string | null) =>
    typeof filename === "string" && filename.toLowerCase().endsWith(".css");
  const normalizeEol = (value: string) => value.replace(/\r\n?/g, "\n");
  const trimTrailingSpaces = (value: string) =>
    value
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n");
  const ensureFinalNewline = (value: string) => (value.endsWith("\n") ? value : `${value}\n`);

  const formatCssLoose = (input: string) => {
    let value = input;
    // 너무 공격적이지 않게: 기본 공백/줄바꿈 정리(초심자 가독성)
    value = value.replace(/\s*{\s*/g, " {\n  ");
    value = value.replace(/;\s*/g, ";\n  ");
    value = value.replace(/\s*}\s*/g, "\n}\n");
    value = value.replace(/\n\s*\n\s*\n+/g, "\n\n");
    value = value
      .split("\n")
      .map((line) => line.replace(/^\s{3,}/, "  "))
      .join("\n");
    return value;
  };

  const handleFileChange = (value: string) => {
    if (!activeFile) {
      return;
    }

    onFilesChange({
      ...files,
      [activeFile]: {
        ...files[activeFile],
        content: value,
      },
    });
  };

  const applyEdit = (nextValue: string, nextSelStart: number, nextSelEnd = nextSelStart) => {
    // 수업 중단 방지: handleFileChange만 호출하고, selection은 다음 프레임에 조정
    handleFileChange(nextValue);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      try {
        el.focus();
        el.setSelectionRange(nextSelStart, nextSelEnd);
      } catch {
        // selection 실패는 무시(먹통 금지)
      }
    });
  };

  const handleCodeKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 가드레일: IME 조합/단축키는 절대 방해 금지
    if (event.nativeEvent.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const el = event.currentTarget;
    const value = el.value ?? "";
    const selStart = el.selectionStart ?? 0;
    const selEnd = el.selectionEnd ?? 0;

    const hasSelection = selEnd > selStart;

    try {
      // 1) Tab / Shift+Tab 들여쓰기/내어쓰기 (선택 영역이면 라인 단위)
      if (event.key === "Tab") {
        event.preventDefault();

        const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
        const lineEnd = (() => {
          const idx = value.indexOf("\n", selEnd);
          return idx === -1 ? value.length : idx;
        })();

        // 선택이 없으면 커서 위치에 indent 삽입
        if (!hasSelection) {
          const nextValue = value.slice(0, selStart) + INDENT + value.slice(selEnd);
          applyEdit(nextValue, selStart + INDENT.length);
          return;
        }

        const block = value.slice(lineStart, lineEnd);
        const lines = block.split("\n");

        if (event.shiftKey) {
          // outdent: 각 줄 앞의 최대 2칸 공백 제거
          let removedTotalFirstLine = 0;
          let removedTotal = 0;
          const outdented = lines.map((line, idx) => {
            if (line.startsWith(INDENT)) {
              if (idx === 0) removedTotalFirstLine = INDENT.length;
              removedTotal += INDENT.length;
              return line.slice(INDENT.length);
            }
            if (line.startsWith(" ")) {
              // 1칸만 있는 경우도 안전 처리
              if (idx === 0) removedTotalFirstLine = 1;
              removedTotal += 1;
              return line.slice(1);
            }
            return line;
          });
          const nextBlock = outdented.join("\n");
          const nextValue = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);

          const nextStart = Math.max(lineStart, selStart - removedTotalFirstLine);
          const nextEnd = Math.max(nextStart, selEnd - removedTotal);
          applyEdit(nextValue, nextStart, nextEnd);
          return;
        }

        // indent
        const indented = lines.map((line) => INDENT + line).join("\n");
        const nextValue = value.slice(0, lineStart) + indented + value.slice(lineEnd);
        applyEdit(nextValue, selStart + INDENT.length, selEnd + INDENT.length * lines.length);
        return;
      }

      // 2) Enter 자동 들여쓰기(현재 줄의 leading whitespace 복사)
      if (event.key === "Enter") {
        event.preventDefault();
        const lineStart = value.lastIndexOf("\n", selStart - 1) + 1;
        const beforeCursorInLine = value.slice(lineStart, selStart);
        const match = beforeCursorInLine.match(/^[ \t]+/);
        const prefix = match ? match[0] : "";
        const insertion = "\n" + prefix;
        const nextValue = value.slice(0, selStart) + insertion + value.slice(selEnd);
        const nextPos = selStart + insertion.length;
        applyEdit(nextValue, nextPos);
        return;
      }

      // 3) 괄호/따옴표 자동 닫기 + 선택 영역 감싸기
      const pairs: Record<string, string> = {
        "(": ")",
        "[": "]",
        "{": "}",
        "\"": "\"",
        "'": "'",
        "`": "`",
      };
      const close = pairs[event.key];
      if (close) {
        event.preventDefault();
        if (hasSelection) {
          const selected = value.slice(selStart, selEnd);
          const nextValue =
            value.slice(0, selStart) + event.key + selected + close + value.slice(selEnd);
          // 선택 영역은 그대로 유지(안쪽 선택)
          applyEdit(nextValue, selStart + 1, selEnd + 1);
          return;
        }
        // selection 없으면 쌍 삽입 후 커서를 가운데로
        const nextValue = value.slice(0, selStart) + event.key + close + value.slice(selEnd);
        applyEdit(nextValue, selStart + 1);
        return;
      }
    } catch {
      // 예외 시: 먹통 방지 → 기본 동작으로 폴백(여기선 preventDefault를 이미 했을 수 있으니, 위에서만 try-catch 사용)
      // 안전을 위해 아무 것도 하지 않는다.
      return;
    }
  };

  const handleDownload = async () => {
    const entries = Object.entries(files).map(([filename, file]) => ({
      filename,
      data: new TextEncoder().encode(file.content),
    }));
    const zipBuffer = createZip(entries);
    const zipData = new Uint8Array(zipBuffer.byteLength);
    zipData.set(zipBuffer);
    const blob = new Blob([zipData], { type: "application/zip" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "workspace.zip";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (!onResetToTemplate) {
      return;
    }

    const confirmed = window.confirm(
      "템플릿으로 되돌리면 지금까지의 수정 내용이 사라져요. 계속할까요?",
    );
    if (confirmed) {
      onResetToTemplate();
    }
  };

  const openPreviewInNewTab = (html: string) => {
    const blob = new Blob([html], { type: "text/html" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  };

  const handleOpenInNewTab = () => {
    openPreviewInNewTab(previewDoc);
  };

  const handleCopyLink = async () => {
    if (!navigator.clipboard?.writeText) return;
    const link = previewSlug
      ? `${window.location.origin}/edu/view/${previewSlug}`
      : "로컬 미리보기입니다. 게시 후 공유 링크를 사용할 수 있어요.";
    await navigator.clipboard.writeText(link);
  };

  const onCssFormatClick = () => {
    if (!ENABLE_CSS_FORMATTER) return;
    if (!activeFile || !isCssFile(activeFile)) return;
    try {
      const base = ensureFinalNewline(trimTrailingSpaces(normalizeEol(activeContent)));
      const next = ensureFinalNewline(trimTrailingSpaces(formatCssLoose(base)));
      if (next === base) {
        setToast("이미 정리됨");
        return;
      }
      handleFileChange(next);
      setToast("정리됨");
    } catch {
      setToast("정리 실패");
    }
  };

  const codePane = (
    <div
      className={`flex h-full min-h-[45vh] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/60 lg:min-h-0 ${
        mobilePane === "code" ? "flex" : "hidden"
      } lg:flex`}
    >
      <div className="border-b border-slate-200/70 px-4 py-2 text-xs font-semibold text-slate-500">
        {activeFile || "파일 선택"}
      </div>
      <textarea
        ref={textareaRef}
        value={activeContent}
        onChange={(event) => handleFileChange(event.target.value)}
        onKeyDown={handleCodeKeyDown}
        style={{ tabSize: 2 }}
        className="flex-1 min-h-0 resize-none overflow-auto rounded-b-2xl bg-transparent px-5 py-4 font-mono text-[15px] leading-[1.65] tracking-[0.01em] text-slate-700 outline-none"
      />
    </div>
  );

  const previewPane = (
    <div
      className={`flex h-full min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-h-0 ${
        mobilePane === "preview" ? "flex" : "hidden"
      } lg:flex`}
    >
      <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-2 text-xs font-semibold text-slate-500">
        <span>Canvas · index.html</span>
        <button
          type="button"
          onClick={() => setPresentOpen(true)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
        >
          발표 모드
        </button>
      </div>
      <iframe
        key={previewKey}
        ref={previewIframeRef}
        title="lesson-preview"
        srcDoc={previewDoc}
        className="min-h-0 w-full flex-1 rounded-b-2xl"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );

  return (
    <div className="edu-panel flex h-full min-h-0 flex-col bg-white/70">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">작업공간</h3>
          <p className="text-sm text-slate-500">
            파일을 편집하면 바로 오른쪽 프리뷰에 반영됩니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onResetToTemplate ? (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:text-rose-700"
            >
              템플릿으로 되돌리기
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-sky-300 hover:text-sky-600"
          >
            다운로드
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {Object.keys(files).map((filename) => {
              const isActive = filename === activeFile;
              return (
                <button
                  key={filename}
                  type="button"
                  onClick={() => setActiveFile(filename)}
                  className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {filename}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-2 lg:hidden">
              {(["preview", "code"] as const).map((pane) => {
                const isActive = mobilePane === pane;
                return (
                  <button
                    key={pane}
                    type="button"
                    onClick={() => setMobilePane(pane)}
                    className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {pane === "preview" ? "Preview" : "Code"}
                  </button>
                );
              })}
            </div>
            {ENABLE_CSS_FORMATTER && isCssFile(activeFile) ? (
              <button
                type="button"
                onClick={onCssFormatClick}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800"
                aria-label="CSS 정리(포맷)"
                title="CSS 정리(포맷)"
              >
                <span aria-hidden="true">✨</span>
              </button>
            ) : null}
          </div>
        </div>
        {toast ? (
          <p className="px-1 text-xs text-slate-500" aria-live="polite">
            {toast}
          </p>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col gap-6 lg:gap-8">
          <div className="flex min-h-0 flex-1 flex-col gap-6 lg:hidden">{codePane}{previewPane}</div>
          <div className="hidden min-h-0 flex-1 lg:flex">
            <SplitPane
              left={codePane}
              right={previewPane}
              storageKey="workspace.splitPx"
              minLeftPx={360}
              minRightPx={360}
              defaultRatio={0.35}
              className="min-h-0 flex-1"
            />
          </div>
        </div>
      </div>

      <OverlayModal
        open={presentOpen}
        onClose={() => setPresentOpen(false)}
        title={modalTitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800"
            >
              새 탭 열기
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800"
            >
              링크 복사
            </button>
          </div>
        }
      >
        <iframe
          title="lesson-preview-modal"
          srcDoc={previewDoc}
          className="h-[85vh] w-full max-h-[85vh] rounded-xl border border-slate-200 bg-white sm:h-[90vh] sm:max-h-[90vh]"
          sandbox="allow-scripts allow-same-origin"
        />
      </OverlayModal>
    </div>
  );
}
