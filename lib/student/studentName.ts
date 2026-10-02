const MAX_STUDENT_NAME_LENGTH = 20;
const STUDENT_NAME_ALLOWED_CHARS = /[^A-Za-z0-9가-힣\s]/g;

export function normalizeStudentName(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed) {
    return "";
  }

  const cleaned = trimmed.replace(/[\u0000-\u001F\u007F<>`"'\\]/g, "").trim();

  return cleaned.slice(0, MAX_STUDENT_NAME_LENGTH);
}

export function sanitizeStudentName(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed) {
    return "";
  }

  const cleaned = trimmed.replace(STUDENT_NAME_ALLOWED_CHARS, "").replace(/\s+/g, " ").trim();

  return cleaned.slice(0, MAX_STUDENT_NAME_LENGTH);
}
