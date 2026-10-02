import { detectHan, findHanSample } from "@/lib/edu/hanGuard";
const AWKWARD_KOREAN_PATTERNS = [/수영자/];
const KANA_REGEX = /[\u3040-\u30ff]/u;
const KANA_REGEX_GLOBAL = /[\u3040-\u30ff]/gu;

export function containsHan(s: string): boolean {
  return detectHan(s);
}

export function explainHanFound(s: string): { found: boolean; sample?: string } {
  const sample = findHanSample(s);
  if (!sample) {
    return { found: false };
  }
  return { found: true, sample };
}

export function containsAwkwardKorean(s: string): boolean {
  return AWKWARD_KOREAN_PATTERNS.some((pattern) => pattern.test(s));
}

export function detectKana(s: string): boolean {
  return KANA_REGEX.test(s);
}

export function sanitizeKanaAsLastResort(s: string): string {
  if (!s) return s;
  const sanitized = s.replace(KANA_REGEX_GLOBAL, "").trim();
  if (sanitized === s.trim()) return s;
  if (!sanitized) {
    return "한글로만 다시 안내해 드릴게요.";
  }
  return sanitized;
}
