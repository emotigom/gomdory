export type EduPublishFileMetaInput = {
  path: string;
  contentType?: string;
  sizeBytes?: number;
};

export type EduPublishFileMetaNormalized = {
  path: string;
  contentType: string;
  sizeBytes: number;
};

export type EduValidateResult =
  | { ok: true; normalized: EduPublishFileMetaNormalized[] }
  | { ok: false; code: string; message: string };

export const EDU_PUBLISH_DEFAULT_MAX_FILES = 30;
export const EDU_PUBLISH_DEFAULT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;
export const EDU_PUBLISH_DEFAULT_MAX_SINGLE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_PATH_LEN = 120;
const MAX_SEGMENT_LEN = 64;

const ALLOWED_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".ico",
  ".txt",
  ".woff2",
]);

const DENIED_FILENAMES = new Set([
  "service-worker.js",
  "sw.js",
  "worker.js",
  "_headers",
  "_redirects",
  ".env",
  "wrangler.toml",
]);

function resolveNumber(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatBytesLimit(bytes: number) {
  const mb = Math.max(1, Math.round(bytes / (1024 * 1024)));
  return `${mb}MB`;
}

export type NormalizePathResult = { ok: true; path: string } | { ok: false; message: string };

export function normalizeEduPublishPath(raw: string, maxPathLen = DEFAULT_MAX_PATH_LEN): NormalizePathResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "파일 경로가 올바르지 않아요: (빈 값)" };
  if (trimmed.startsWith("/")) {
    return { ok: false, message: `파일 경로가 올바르지 않아요: ${raw}` };
  }
  if (trimmed.includes("\\") || trimmed.includes(":")) {
    return { ok: false, message: `파일 경로가 올바르지 않아요: ${raw}` };
  }
  if (trimmed.length > maxPathLen) {
    return { ok: false, message: `파일 경로가 올바르지 않아요: ${raw}` };
  }

  const parts = trimmed.split("/");
  for (const part of parts) {
    if (!part || part === "." || part === "..") {
      return { ok: false, message: `파일 경로가 올바르지 않아요: ${raw}` };
    }
    if (part.length > MAX_SEGMENT_LEN) {
      return { ok: false, message: `파일 경로가 올바르지 않아요: ${raw}` };
    }
    if (part.startsWith(".")) {
      return { ok: false, message: `파일 경로가 올바르지 않아요: ${raw}` };
    }
  }

  return { ok: true, path: parts.join("/") };
}

export type EduPublishValidationLimits = {
  maxFiles?: number;
  maxTotalBytes?: number;
  maxSingleBytes?: number;
};

export function validateEduPublishFiles(files: EduPublishFileMetaInput[], limits: EduPublishValidationLimits = {}): EduValidateResult {
  const maxFiles = limits.maxFiles ?? resolveNumber(process.env.EDU_PUBLISH_MAX_FILES, EDU_PUBLISH_DEFAULT_MAX_FILES);
  const maxTotalBytes = limits.maxTotalBytes ?? resolveNumber(process.env.EDU_PUBLISH_MAX_TOTAL_BYTES, EDU_PUBLISH_DEFAULT_MAX_TOTAL_BYTES);
  const maxSingleBytes = limits.maxSingleBytes ?? resolveNumber(process.env.EDU_PUBLISH_MAX_SINGLE_FILE_BYTES, EDU_PUBLISH_DEFAULT_MAX_SINGLE_BYTES);
  const maxPathLen = DEFAULT_MAX_PATH_LEN;

  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, code: "INVALID_FILES", message: "파일 목록이 올바르지 않아요." };
  }

  if (files.length > maxFiles) {
    return { ok: false, code: "TOO_MANY_FILES", message: `파일이 너무 많아요(최대 ${maxFiles}개).` };
  }

  const normalized: EduPublishFileMetaNormalized[] = [];
  const seen = new Set<string>();
  const topLevelDirs = new Set<string>();
  let hasRootLevelFile = false;
  let totalBytes = 0;
  let hasIndex = false;

  for (const file of files) {
    if (!file || typeof file.path !== "string") {
      return { ok: false, code: "INVALID_FILES", message: "파일 경로가 올바르지 않아요: (알 수 없음)" };
    }

    const normalizedPath = normalizeEduPublishPath(file.path, maxPathLen);
    if (!normalizedPath.ok) {
      return { ok: false, code: "INVALID_PATH", message: normalizedPath.message };
    }

    if (normalizedPath.path.length > maxPathLen) {
      return { ok: false, code: "INVALID_PATH", message: `파일 경로가 올바르지 않아요: ${file.path}` };
    }

    const lowerPath = normalizedPath.path.toLowerCase();
    if (lowerPath === "index.html") {
      hasIndex = true;
    }

    const slashIndex = lowerPath.indexOf("/");
    if (slashIndex < 0) {
      hasRootLevelFile = true;
    } else {
      topLevelDirs.add(lowerPath.slice(0, slashIndex));
    }

    if (seen.has(lowerPath)) {
      return { ok: false, code: "DUPLICATE_PATH", message: `중복된 파일명이 있어요: ${file.path}` };
    }

    const filename = lowerPath.split("/").pop() ?? lowerPath;
    if (DENIED_FILENAMES.has(filename)) {
      return {
        ok: false,
        code: "DENIED_FILENAME",
        message: `금지된 파일명이 포함되어 있어요: ${filename}`,
      };
    }

    const dotIndex = filename.lastIndexOf(".");
    const ext = dotIndex >= 0 ? filename.slice(dotIndex) : "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return {
        ok: false,
        code: "INVALID_EXTENSION",
        message: `허용되지 않은 파일 형식이에요: ${ext || "unknown"}`,
      };
    }

    const sizeBytes = Number(file.sizeBytes ?? 0);
    if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
      return { ok: false, code: "INVALID_SIZE", message: `파일 크기가 올바르지 않아요: ${file.path}` };
    }
    if (sizeBytes > maxSingleBytes) {
      return {
        ok: false,
        code: "TOO_LARGE_FILE",
        message: `파일이 너무 커요(최대 ${formatBytesLimit(maxSingleBytes)}).`,
      };
    }

    const contentType = typeof file.contentType === "string" ? file.contentType.trim() : "";
    if (!contentType) {
      return { ok: false, code: "INVALID_CONTENT_TYPE", message: `파일 정보가 올바르지 않아요: ${file.path}` };
    }

    totalBytes += sizeBytes;
    if (totalBytes > maxTotalBytes) {
      return {
        ok: false,
        code: "TOO_LARGE_TOTAL",
        message: `전체 용량이 너무 커요(최대 ${formatBytesLimit(maxTotalBytes)}).`,
      };
    }

    seen.add(lowerPath);
    normalized.push({
      path: normalizedPath.path,
      contentType,
      sizeBytes,
    });
  }

  if (!hasIndex && !hasRootLevelFile && topLevelDirs.size === 1) {
    const [singleTopLevelDir] = [...topLevelDirs];
    if (singleTopLevelDir) {
      hasIndex = normalized.some((file) => file.path.toLowerCase() === `${singleTopLevelDir}/index.html`);
    }
  }

  if (!hasIndex) {
    return { ok: false, code: "MISSING_INDEX", message: "index.html 파일이 필요해요." };
  }

  return { ok: true, normalized };
}
