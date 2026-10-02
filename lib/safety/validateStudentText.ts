import { maskPII } from "@/lib/safety/piiMask";
import { sanitizeText, type SanitizeTextOptions } from "@/lib/safety/sanitizeText";

export type ValidationErrorCode = "too_short" | "too_long";

export class ValidationError extends Error {
  code: ValidationErrorCode;
  status: number;

  constructor(code: ValidationErrorCode, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export type ValidateStudentTextOptions = SanitizeTextOptions & {
  minLength?: number;
  allowEmpty?: boolean;
  maskUrls?: boolean;
};

export type ValidateStudentTextResult = {
  ok: true;
  text: string;
  reasons: string[];
};

export function validateStudentText(
  input: string,
  { maxLength = 280, minLength = 1, allowEmpty = false, maskUrls = true, ...sanitizeOptions }: ValidateStudentTextOptions = {},
): ValidateStudentTextResult {
  const sanitized = sanitizeText(input ?? "", { maxLength, ...sanitizeOptions });
  const masked = maskPII(sanitized.text, { maskUrls });
  const text = masked.text.trim();
  const reasons = Array.from(new Set([...sanitized.flags, ...masked.hits]));

  if (!allowEmpty && text.length < minLength) {
    throw new ValidationError("too_short", "입력 내용을 확인해주세요.");
  }

  if (text.length > maxLength) {
    throw new ValidationError("too_long", "입력 내용을 확인해주세요.");
  }

  return { ok: true, text, reasons };
}
