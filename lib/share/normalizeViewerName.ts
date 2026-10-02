const MAX_VIEWER_NAME_LENGTH = 24;
const DEFAULT_VIEWER_NAME = "익명";
const DEFAULT_DISPLAY_LIMIT = 14;

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
const BIDI_CHARS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const ZERO_WIDTH_CHARS = /[\u200B-\u200D\u2060\uFEFF]/g;

function cleanupViewerName(value: string) {
  return value
    .replace(CONTROL_CHARS, " ")
    .replace(BIDI_CHARS, "")
    .replace(ZERO_WIDTH_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeViewerName(input: unknown): string {
  try {
    if (typeof input !== "string") return DEFAULT_VIEWER_NAME;
    const trimmed = input.trim();
    if (!trimmed) return DEFAULT_VIEWER_NAME;

    const cleaned = cleanupViewerName(trimmed);
    if (!cleaned) return DEFAULT_VIEWER_NAME;

    const limited = Array.from(cleaned).slice(0, MAX_VIEWER_NAME_LENGTH).join("").trim();
    return limited || DEFAULT_VIEWER_NAME;
  } catch {
    return DEFAULT_VIEWER_NAME;
  }
}

export function truncateViewerName(input: string, limit = DEFAULT_DISPLAY_LIMIT): string {
  const normalized = normalizeViewerName(input);
  const chars = Array.from(normalized);
  if (chars.length <= limit) return normalized;
  return `${chars.slice(0, limit).join("")}…`;
}
