import { maskPII, type MaskPiiOptions } from "@/lib/safety/piiMask";
import { sanitizeText, type SanitizeTextOptions } from "@/lib/safety/sanitizeText";

export type SafeStudentTextOptions = SanitizeTextOptions & MaskPiiOptions;

export type SafeStudentTextResult = {
  text: string | null;
  flags: string[];
  piiHits: string[];
};

export function safeStudentText(raw: string, options: SafeStudentTextOptions = {}): SafeStudentTextResult {
  const sanitized = sanitizeText(raw ?? "", options);
  const masked = maskPII(sanitized.text, options);
  const text = masked.text.trim();

  return {
    text: text.length > 0 ? text : null,
    flags: sanitized.flags,
    piiHits: masked.hits,
  };
}
