import { maskPii } from "@/lib/security/piiMask";
import { sanitizeText } from "@/lib/safety/sanitizeText";

const URL_PATTERN = /\b(?:https?:\/\/|javascript:|data:)[^\s]+/gi;

const PROFANITY_LIST = ["fuck", "shit", "bastard", "씨발", "개새"]; // minimal to reduce false positives

export interface SanitizeStudentTextOptions {
  maxLength?: number;
}

export interface SanitizedStudentText {
  text: string;
  flagged: boolean;
  reasons: string[];
}

export function sanitizeStudentText(
  rawText: string,
  { maxLength = 280 }: SanitizeStudentTextOptions = {},
): SanitizedStudentText {
  const sanitized = sanitizeText(rawText ?? "", { maxLength });
  let text = sanitized.text;
  const reasons: string[] = [];
  let flagged = false;

  reasons.push(...sanitized.reasons);

  const sanitizedUrls = text.replace(URL_PATTERN, "");
  if (sanitizedUrls !== text) {
    text = sanitizedUrls;
    reasons.push("url_removed");
  }

  const piiResult = maskPii(text);
  if (piiResult.text !== text) {
    text = piiResult.text;
    reasons.push(...piiResult.reasons);
  }

  for (const word of PROFANITY_LIST) {
    const pattern = new RegExp(word, "gi");
    if (pattern.test(text)) {
      flagged = true;
      reasons.push("profanity");
      text = text.replace(pattern, (match) => "*".repeat(Math.max(2, match.length)));
    }
  }

  return { text, flagged, reasons: Array.from(new Set(reasons)) };
}
