export type FileProtocolPayload = {
  title?: string;
  files?: Record<string, unknown>;
};

export type AiMessagePayload = {
  type: "message";
  message: string;
};

export type AiFilesPayload = {
  type: "files";
  message: string;
  files: Record<string, string>;
};

export type AiResponsePayload = AiMessagePayload | AiFilesPayload;

export type AiParseError = {
  ok: false;
  code: "EDU_FILES_SCHEMA_INVALID";
  detail: string;
};

export type AiParseResult = { ok: true; payload: AiResponsePayload } | AiParseError;

type ContentType = "text/html" | "text/css" | "text/javascript";

export type NormalizedFile = {
  content: string;
  contentType: ContentType;
};

export type NormalizeFilesOptions = {
  allowedFilenames: string[];
  allowedExtensions?: string[];
  maxFileBytes?: number;
  maxTotalBytes?: number;
};

const DEFAULT_ALLOWED_EXTENSIONS = [".html", ".css", ".js"];
const DEFAULT_MAX_FILE_BYTES = 50_000;
const DEFAULT_MAX_TOTAL_BYTES = 200_000;

const CONTENT_TYPE_BY_EXTENSION: Record<string, ContentType> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
};

const textEncoder = new TextEncoder();

const getContentBytes = (content: string) => textEncoder.encode(content).length;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const describeType = (value: unknown) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
};

const withSchemaDetail = (detail: string) => `non-string file content: ${detail}`;

const validateFilesRecord = (
  value: unknown,
): { ok: true; files: Record<string, string> } | { ok: false; detail: string } => {
  if (!isRecord(value)) {
    return { ok: false, detail: withSchemaDetail(`files is ${describeType(value)}`) };
  }

  for (const [filename, content] of Object.entries(value)) {
    if (typeof content !== "string") {
      return {
        ok: false,
        detail: withSchemaDetail(`"${filename}" is ${describeType(content)}`),
      };
    }
  }

  return { ok: true, files: value as Record<string, string> };
};

const normalizePayload = (value: unknown): AiParseResult | null => {
  if (!isRecord(value)) {
    return null;
  }

  const type = typeof value.type === "string" ? value.type : null;
  const message = typeof value.message === "string" ? value.message : null;
  const hasFilesKey = "files" in value;

  if (type === "message") {
    if (!message) return null;
    return { ok: true, payload: { type: "message", message } };
  }

  if (type === "files" || hasFilesKey) {
    const filesResult = validateFilesRecord(value.files);
    if (!filesResult.ok) {
      return { ok: false, code: "EDU_FILES_SCHEMA_INVALID", detail: filesResult.detail };
    }
    return { ok: true, payload: { type: "files", message: message ?? "", files: filesResult.files } };
  }

  if (message) {
    return { ok: true, payload: { type: "message", message } };
  }

  return null;
};

const parseJsonCandidate = (candidate: string): unknown | null => {
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
};

const findJsonCodeBlock = (text: string) => {
  const match = text.match(/```json\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : null;
};

const parseBalancedJson = (text: string): unknown | null => {
  let startIndex = text.indexOf("{");
  while (startIndex !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{") {
        depth += 1;
        continue;
      }

      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(startIndex, index + 1);
          const parsed = parseJsonCandidate(candidate);
          if (parsed) {
            return parsed;
          }
          break;
        }
      }
    }

    startIndex = text.indexOf("{", startIndex + 1);
  }

  return null;
};

export function parseFirstJsonValue(text: string): unknown | null {
  if (!text) return null;

  const codeBlock = findJsonCodeBlock(text);
  if (codeBlock) {
    const parsed = parseJsonCandidate(codeBlock);
    if (parsed) return parsed;
  }

  const balancedParsed = parseBalancedJson(text);
  if (balancedParsed) return balancedParsed;

  return null;
}

export function parseFirstJsonPayload(text: string): AiParseResult | null {
  const parsed = parseFirstJsonValue(text);
  if (!parsed) return null;
  return normalizePayload(parsed);
}

export function normalizeFiles(
  input: unknown,
  {
    allowedFilenames,
    allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS,
    maxFileBytes = DEFAULT_MAX_FILE_BYTES,
    maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
  }: NormalizeFilesOptions,
): Record<string, NormalizedFile> {
  if (!isRecord(input)) {
    return {};
  }

  const allowedNameSet = new Set(allowedFilenames);
  const allowedExtensionSet = new Set(allowedExtensions);
  const entries = Object.entries(input);
  const result: Record<string, NormalizedFile> = {};
  let totalBytes = 0;

  for (const [filename, value] of entries) {
    if (!allowedNameSet.has(filename)) {
      continue;
    }

    const extension = Object.keys(CONTENT_TYPE_BY_EXTENSION).find((ext) => filename.endsWith(ext));
    if (!extension || !allowedExtensionSet.has(extension)) {
      continue;
    }

    let content: string | null = null;
    if (typeof value === "string") {
      content = value;
    } else if (isRecord(value) && typeof value.content === "string") {
      content = value.content;
    }

    if (content === null) {
      continue;
    }

    const bytes = getContentBytes(content);
    if (bytes > maxFileBytes || totalBytes + bytes > maxTotalBytes) {
      continue;
    }

    totalBytes += bytes;
    result[filename] = {
      content,
      contentType: CONTENT_TYPE_BY_EXTENSION[extension],
    };
  }

  return result;
}

type RequiredRefsMetrics = {
  missingRefsDetected: boolean;
  fixedCss: boolean;
  fixedJs: boolean;
};

const insertBeforeClosingTag = (html: string, tagName: "head" | "body", insertion: string) => {
  const closingTag = new RegExp(`</${tagName}>`, "i");
  const match = html.match(closingTag);
  if (match && typeof match.index === "number") {
    return `${html.slice(0, match.index)}${insertion}${html.slice(match.index)}`;
  }

  if (tagName === "head") {
    const openingTag = html.match(/<head[^>]*>/i);
    if (openingTag && typeof openingTag.index === "number") {
      const insertIndex = openingTag.index + openingTag[0].length;
      return `${html.slice(0, insertIndex)}${insertion}${html.slice(insertIndex)}`;
    }
    return `${insertion}${html}`;
  }

  return `${html}${insertion}`;
};

export function ensureRequiredRefs(
  files: Record<string, NormalizedFile>,
): { files: Record<string, NormalizedFile>; metrics: RequiredRefsMetrics } {
  const indexFile = files["index.html"];
  const metrics: RequiredRefsMetrics = {
    missingRefsDetected: false,
    fixedCss: false,
    fixedJs: false,
  };

  if (!indexFile) {
    return { files, metrics };
  }

  let html = indexFile.content;
  const hasStyleRef = html.includes("style.css");
  const hasScriptJs = Boolean(files["script.js"]);
  const hasMainJs = Boolean(files["main.js"]);
  const jsName = hasScriptJs ? "script.js" : hasMainJs ? "main.js" : null;
  const hasJsRef = jsName ? html.includes(jsName) : true;

  if (!hasStyleRef && files["style.css"]) {
    metrics.missingRefsDetected = true;
    html = insertBeforeClosingTag(
      html,
      "head",
      '\n<link rel="stylesheet" href="./style.css">\n',
    );
    metrics.fixedCss = true;
  }

  if (jsName && !hasJsRef) {
    metrics.missingRefsDetected = true;
    html = insertBeforeClosingTag(
      html,
      "body",
      `\n<script type="module" src="./${jsName}"></script>\n`,
    );
    metrics.fixedJs = true;
  }

  if (!metrics.fixedCss && !metrics.fixedJs) {
    return { files, metrics };
  }

  return {
    files: {
      ...files,
      "index.html": {
        ...indexFile,
        content: html,
      },
    },
    metrics,
  };
}
