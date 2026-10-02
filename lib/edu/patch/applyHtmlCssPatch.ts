export type PatchWorkspaceFile = {
  content: string;
  contentType: "text/html" | "text/css" | "text/javascript";
};

const SCRIPT_TAG_PATTERN = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const INLINE_HANDLER_PATTERN = /\son[a-z]+\s*=\s*(["']).*?\1/gi;

export type HtmlCssPatch = {
  html?: string;
  css?: string;
};

export type HtmlCssPatchResult = {
  files: Record<string, PatchWorkspaceFile>;
  removedScripts: boolean;
};

export const sanitizePatchedHtml = (html: string) => {
  const withoutScripts = html.replace(SCRIPT_TAG_PATTERN, "");
  const withoutHandlers = withoutScripts.replace(INLINE_HANDLER_PATTERN, "");
  return {
    html: withoutHandlers,
    removedScripts: withoutScripts !== html || withoutHandlers !== withoutScripts,
  };
};

export const applyHtmlCssPatch = (params: {
  currentFiles: Record<string, PatchWorkspaceFile>;
  patch: HtmlCssPatch;
}): HtmlCssPatchResult => {
  const nextFiles: Record<string, PatchWorkspaceFile> = { ...params.currentFiles };
  let removedScripts = false;

  if (typeof params.patch.html === "string") {
    const sanitized = sanitizePatchedHtml(params.patch.html);
    nextFiles["index.html"] = {
      content: sanitized.html,
      contentType: "text/html",
    };
    removedScripts = removedScripts || sanitized.removedScripts;
  }

  if (typeof params.patch.css === "string") {
    nextFiles["style.css"] = {
      content: params.patch.css,
      contentType: "text/css",
    };
  }

  if (!nextFiles["script.js"]) {
    nextFiles["script.js"] = {
      content: "",
      contentType: "text/javascript",
    };
  }

  return { files: nextFiles, removedScripts };
};

export type PatchHistoryState = {
  past: Record<string, PatchWorkspaceFile>[];
  present: Record<string, PatchWorkspaceFile>;
};

export const pushHistory = (state: PatchHistoryState, nextPresent: Record<string, PatchWorkspaceFile>): PatchHistoryState => ({
  past: [...state.past, state.present],
  present: nextPresent,
});

export const undoHistory = (state: PatchHistoryState): PatchHistoryState => {
  if (state.past.length === 0) return state;
  return {
    past: state.past.slice(0, -1),
    present: state.past[state.past.length - 1],
  };
};

export const resetHistory = (initial: Record<string, PatchWorkspaceFile>): PatchHistoryState => ({
  past: [],
  present: initial,
});
