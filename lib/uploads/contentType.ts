const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  txt: "text/plain",
  log: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
};

export function getFileExtension(filename: string): string {
  const cleaned = (filename || "").split(/[\\/]/).pop() ?? "";
  const dot = cleaned.lastIndexOf(".");
  if (dot <= 0) return "";
  return cleaned.slice(dot + 1).toLowerCase();
}

export function normalizeUploadContentType(input: { contentType?: string | null; filename?: string | null }): string {
  const raw = (input.contentType ?? "").trim().toLowerCase();
  const base = raw.split(";")[0]?.trim() ?? "";
  const ext = getFileExtension(input.filename ?? "");

  if (base) {
    if (base === "application/octet-stream" && EXTENSION_TO_CONTENT_TYPE[ext]) return EXTENSION_TO_CONTENT_TYPE[ext];
    return base;
  }

  if (EXTENSION_TO_CONTENT_TYPE[ext]) return EXTENSION_TO_CONTENT_TYPE[ext];
  return "application/octet-stream";
}
