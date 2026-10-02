const HAN_REGEX = /[\p{Script=Han}]/u;
const HAN_REGEX_GLOBAL = /[\p{Script=Han}]/gu;

export function detectHan(text: string): boolean {
  return HAN_REGEX.test(text);
}

export function findHanSample(text: string): string | null {
  const match = text.match(HAN_REGEX);
  return match ? match[0] : null;
}

export function sanitizeHanAsLastResort(text: string): string {
  if (!text) return text;
  const sanitized = text.replace(HAN_REGEX_GLOBAL, "").trim();
  if (sanitized === text.trim()) return text;
  if (!sanitized) {
    return "한글로만 다시 안내해 드릴게요.";
  }
  return `${sanitized}\n\n(한자 제거 후 다시 정리했어요.)`;
}
