export function makeExcerpt(body: string, maxChars = 140): string {
  const normalized = body.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").trim();

  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;

  const shortened = normalized.slice(0, maxChars).trimEnd();
  return `${shortened}…`;
}
