export type ManualFile = {
  name: string;
  path: string;
  contentType?: string;
  contentText?: string;
  contentBase64?: string;
};

export type LocalPreviewBuild = { html: string; objectUrls: string[]; warnings: string[] };

const PREVIEW_CSP =
  "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none';";

const SKIP_REWRITE_PREFIXES = ["http://", "https://", "data:", "blob:", "#", "mailto:", "javascript:", "/"];
const NOISE_PATH_PATTERNS = [/^__MACOSX\//i, /\/\.DS_Store$/i, /^\.DS_Store$/i, /\/Thumbs\.db$/i, /^Thumbs\.db$/i];
const IMG_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"]);
const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
};

const normalizePath = (value: string) => value.trim().replace(/\\+/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");
const shouldIgnorePath = (path: string) => !path || path.endsWith("/") || NOISE_PATH_PATTERNS.some((pattern) => pattern.test(path));
const extOf = (path: string) => path.split(".").pop()?.toLowerCase() ?? "";
const isRelative = (v: string) => !!v.trim() && !SKIP_REWRITE_PREFIXES.some((p) => v.trim().startsWith(p));

const safeDecodeBase64ToText = (input: string) => {
  try {
    const binary = atob(input);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
};

const resolveRelativePath = (rawPath: string, fromDir: string) => {
  const parts = normalizePath(`${fromDir}/${rawPath}`).split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!stack.length) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
};

const stripCommonRoot = (paths: string[]) => {
  if (!paths.length || !paths.every((p) => p.includes("/"))) return paths;
  const roots = paths.map((p) => p.split("/")[0]);
  if (!roots.every((r) => r === roots[0])) return paths;
  const stripped = paths.map((p) => p.slice(roots[0].length + 1));
  return stripped.some((p) => !p) ? paths : stripped;
};

function buildImageDataUrl(file: ManualFile, resolvedPath: string) {
  const ext = extOf(resolvedPath);
  const mime = file.contentType || IMAGE_MIME_BY_EXT[ext] || "application/octet-stream";

  if (ext === "svg") {
    const svgText = file.contentText ?? (file.contentBase64 ? safeDecodeBase64ToText(file.contentBase64) : null);
    if (svgText) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  }

  if (file.contentBase64) {
    return `data:${mime};base64,${file.contentBase64}`;
  }

  return null;
}

export function buildLocalPreviewDocument(files: ManualFile[]): LocalPreviewBuild | null {
  const normalized = files.map((f) => ({ ...f, path: normalizePath(f.path) })).filter((f) => !shouldIgnorePath(f.path));
  const stripped = stripCommonRoot(normalized.map((f) => f.path));
  const normalizedFiles = normalized.map((f, i) => ({ ...f, path: stripped[i] }));

  const indexFile = normalizedFiles.find((file) => file.path.toLowerCase() === "index.html");
  if (!indexFile) return null;

  let html = indexFile.contentText ?? null;
  if (!html && indexFile.contentBase64) html = safeDecodeBase64ToText(indexFile.contentBase64);
  if (!html) return null;

  const warnings = new Set<string>();
  const fileMap = new Map(normalizedFiles.map((f) => [f.path, f]));
  const indexDir = indexFile.path.includes("/") ? indexFile.path.slice(0, indexFile.path.lastIndexOf("/")) : "";

  html = html.replace(/<link([^>]*?)href=(['"])([^'"]+)\2([^>]*)>/gi, (full, pre, q, href) => {
    if (!isRelative(href)) return full;
    const resolved = resolveRelativePath(href, indexDir);
    if (!resolved) return full;
    const target = fileMap.get(resolved);
    if (!target?.contentText) {
      warnings.add("missing_asset");
      return full;
    }

    const cssText = target.contentText.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (urlFull, quote, value) => {
      const rewritten = rewriteAsset(value, resolved.includes("/") ? resolved.slice(0, resolved.lastIndexOf("/")) : "", warnings, fileMap);
      return `url(${quote}${rewritten}${quote})`;
    });

    return `<style data-inlined-from="${resolved}">${cssText}</style>`;
  });

  html = html.replace(/<script([^>]*?)src=(['"])([^'"]+)\2([^>]*)><\/script>/gi, (full, pre, q, src) => {
    if (!isRelative(src)) return full;
    const resolved = resolveRelativePath(src, indexDir);
    if (!resolved) return full;
    const target = fileMap.get(resolved);
    const text = target?.contentText || (target?.contentBase64 ? safeDecodeBase64ToText(target.contentBase64) : null);
    if (!text) {
      warnings.add("missing_asset");
      return full;
    }
    return `<script data-inlined-from="${resolved}">${text}</script>`;
  });

  const rewriteFromIndex = (original: string) => rewriteAsset(original, indexDir, warnings, fileMap);

  html = html
    .replace(/\b(src|href)\s*=\s*"([^"]+)"/gi, (full, attr, value) => `${attr}="${rewriteFromIndex(value)}"`)
    .replace(/\b(src|href)\s*=\s*'([^']+)'/gi, (full, attr, value) => `${attr}='${rewriteFromIndex(value)}'`)
    .replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (full, quote, value) => `url(${quote}${rewriteFromIndex(value)}${quote})`);

  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${cspMeta}`) : `${cspMeta}${html}`;

  return { html, objectUrls: [], warnings: warnings.size ? ["일부 연결 파일을 미리보기에 넣지 못했습니다."] : [] };
}

function rewriteAsset(original: string, fromDir: string, warnings: Set<string>, fileMap: Map<string, ManualFile>) {
  if (!isRelative(original)) return original;
  const resolved = resolveRelativePath(original, fromDir);
  if (!resolved) return original;
  const target = fileMap.get(resolved);
  if (!target) {
    warnings.add("missing_asset");
    return original;
  }

  if (IMG_EXT.has(extOf(resolved))) {
    const dataUrl = buildImageDataUrl(target, resolved);
    if (dataUrl) return dataUrl;
  }

  return original;
}
