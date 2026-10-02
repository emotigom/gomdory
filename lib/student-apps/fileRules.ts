export const STUDENT_APP_MAX_FILE_COUNT = 100;
export const STUDENT_APP_MAX_TOTAL_SIZE_BYTES = 20 * 1024 * 1024;
export const STUDENT_APP_MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
// Base64 expands a full 20MiB project to about 26.67MiB. Reserve a further
// 1.33MiB for JSON paths, MIME types, and submission metadata. Keep this
// conservative JSON transport guard until submissions move to direct-to-R2.
export const STUDENT_APP_MAX_REQUEST_CONTENT_LENGTH = 28 * 1024 * 1024;

const TYPE_BY_EXTENSION: Record<string, readonly string[]> = {
  ".html": ["text/html"], ".htm": ["text/html"], ".css": ["text/css"],
  ".js": ["application/javascript", "text/javascript", "application/x-javascript"], ".mjs": ["text/javascript", "application/javascript"],
  ".json": ["application/json", "text/json"], ".txt": ["text/plain"], ".md": ["text/markdown", "text/plain"], ".csv": ["text/csv", "application/csv"], ".xml": ["application/xml", "text/xml"],
  ".map": ["application/json", "application/octet-stream"], ".webmanifest": ["application/manifest+json", "application/json"],
  ".png": ["image/png"], ".jpg": ["image/jpeg"], ".jpeg": ["image/jpeg"],
  ".webp": ["image/webp"], ".gif": ["image/gif"], ".svg": ["image/svg+xml"], ".ico": ["image/x-icon", "image/vnd.microsoft.icon"], ".avif": ["image/avif"],
  ".mp3": ["audio/mpeg", "audio/mp3"], ".wav": ["audio/wav", "audio/x-wav", "audio/wave"],
  ".ogg": ["audio/ogg", "application/ogg"], ".m4a": ["audio/mp4", "audio/x-m4a"],
  ".aac": ["audio/aac", "audio/x-aac"],
  ".mid": ["audio/midi", "audio/x-midi", "audio/mid", "application/midi", "application/x-midi"],
  ".midi": ["audio/midi", "audio/x-midi", "audio/mid", "application/midi", "application/x-midi"],
  ".woff": ["font/woff", "application/font-woff", "application/x-font-woff"],
  ".woff2": ["font/woff2", "application/font-woff2"],
  ".ttf": ["font/ttf", "application/font-sfnt", "application/x-font-ttf"],
  ".otf": ["font/otf", "application/font-sfnt"],
  ".mp4": ["video/mp4"], ".webm": ["video/webm"],
};
const DANGEROUS_EXTENSIONS = new Set([".exe", ".bat", ".cmd", ".sh", ".php", ".py", ".rb", ".jar", ".pem", ".key", ".env"]);
const SAFE_IGNORED_EXTENSIONS = new Set([".zip", ".psd", ".ai", ".ppt", ".pptx", ".doc", ".docx", ".pages", ".keynote"]);

export type StudentAppFileRuleIssue = "invalid_path" | "dangerous_file" | "unsupported_file_type" | "mime_type_mismatch" | "file_too_large";
export type StudentAppFileClassification = "supported" | "ignored-safe" | "blocked-dangerous";
export type StudentAppFileRuleResult = { skip: true; classification: "ignored-safe" } | { skip: false; classification: StudentAppFileClassification; extension: string; contentType: string; issue?: StudentAppFileRuleIssue };

export function getStudentAppExtension(path: string) {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

export function isStudentAppSystemFile(path: string) {
  const normalized = path.replace(/\\+/g, "/");
  const base = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
  return normalized.split("/").some((part) => part.toLowerCase() === "__macosx") || base === ".ds_store" || base === "thumbs.db";
}

export function isSafeStudentAppPath(path: string) {
  return Boolean(path) && !path.startsWith("/") && !/^[A-Za-z]:/.test(path) && !path.includes("\\") && !path.split("/").some((part) => part === ".." || part === ".") && !/[\x00-\x1F\x7F]/.test(path);
}

export function contentTypeForStudentAppPath(path: string) {
  return TYPE_BY_EXTENSION[getStudentAppExtension(path)]?.[0] ?? "application/octet-stream";
}

export function checkStudentAppFileRule(input: { path: string; contentType?: string | null; sizeBytes?: number }) : StudentAppFileRuleResult {
  if (isStudentAppSystemFile(input.path)) return { skip: true, classification: "ignored-safe" };
  if (!isSafeStudentAppPath(input.path)) return { skip: false, classification: "blocked-dangerous", extension: "", contentType: "application/octet-stream", issue: "invalid_path" };
  const extension = getStudentAppExtension(input.path);
  const allowedTypes = TYPE_BY_EXTENSION[extension];
  const contentType = input.contentType?.trim().toLowerCase() || contentTypeForStudentAppPath(input.path);
  if (DANGEROUS_EXTENSIONS.has(extension)) return { skip: false, classification: "blocked-dangerous", extension, contentType, issue: "dangerous_file" };
  if (SAFE_IGNORED_EXTENSIONS.has(extension)) return { skip: false, classification: "ignored-safe", extension, contentType };
  if (!allowedTypes) return { skip: false, classification: "blocked-dangerous", extension, contentType, issue: "unsupported_file_type" };
  if (input.contentType?.trim() && !allowedTypes.includes(contentType)) return { skip: false, classification: "blocked-dangerous", extension, contentType, issue: "mime_type_mismatch" };
  if (typeof input.sizeBytes === "number" && input.sizeBytes > STUDENT_APP_MAX_FILE_SIZE_BYTES) return { skip: false, classification: "blocked-dangerous", extension, contentType, issue: "file_too_large" };
  return { skip: false, classification: "supported", extension, contentType };
}

export function studentAppIssueMessage(issue: StudentAppFileRuleIssue) {
  switch (issue) {
    case "invalid_path": return { reason: "안전하지 않은 파일 경로", solution: "폴더 밖을 가리키는 경로(..)를 제거하고 다시 선택해요." };
    case "dangerous_file": return { reason: "실행하거나 위험할 수 있는 파일", solution: "실행 파일과 비밀키 파일은 빼고 웹 작품 파일만 제출해요." };
    case "unsupported_file_type": return { reason: "지원하지 않는 파일 형식", solution: "웹에서 사용하는 파일인지 확인하고, 원본 문서는 제외한 뒤 다시 제출해요." };
    case "mime_type_mismatch": return { reason: "파일 형식과 MIME type이 맞지 않아요", solution: "파일을 다시 내보내거나 확장자를 실제 파일 형식에 맞춰요." };
    case "file_too_large": return { reason: "파일 하나가 15MB를 넘어요", solution: "영상·음원·이미지 크기를 줄인 뒤 다시 제출해요." };
  }
}
