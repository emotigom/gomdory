import type { EduAiRedactionResult, EduAiRedactionCategory } from "./aiOrchestratorTypes";

const add = (counts: EduAiRedactionResult["counts"], c: EduAiRedactionCategory) => (counts[c] = (counts[c] ?? 0) + 1);

export function redactEduAiText(input: unknown): EduAiRedactionResult {
  const text = typeof input === "string" ? input : "";
  const counts: EduAiRedactionResult["counts"] = {};
  let out = text;
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => (add(counts, "email"), "[REDACTED_EMAIL]"));
  out = out.replace(/\b(?:\+?82[- ]?)?0?1[0-9][- ]?\d{3,4}[- ]?\d{4}\b/g, () => (add(counts, "phone"), "[REDACTED_PHONE]"));
  out = out.replace(/\b\d{8,}\b/g, () => (add(counts, "long_id"), "[REDACTED_SCHOOL_INFO]"));
  out = out.replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,})\b/g, () => (add(counts, "token"), "[REDACTED_TOKEN]"));
  out = out.replace(/(https?:\/\/[^\s?]+)\?[^\s]+/g, (_, base) => (add(counts, "url_query"), `${base}?[REDACTED_URL_QUERY]`));
  out = out.replace(/(내 이름은\s*)([^\s,.!?]+)/g, (_, p1) => (add(counts, "name"), `${p1}[REDACTED_NAME]`));
  out = out.replace(/(저는\s*)([^\s,.!?]+)(입니다)/g, (_, p1, _n, p3) => (add(counts, "name"), `${p1}[REDACTED_NAME]${p3}`));
  const categories = Object.keys(counts) as EduAiRedactionCategory[];
  return { redactedText: out, applied: categories.length > 0, categories, counts };
}
