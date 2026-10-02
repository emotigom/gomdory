"server-only";

const PRESENTATION_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_CODE_LENGTH = 8;

function safeRandomInt(maxExclusive: number): number {
  if (typeof globalThis.crypto !== "undefined" && "getRandomValues" in globalThis.crypto) {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return array[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

export const PRESENTATION_CODE_REGEX = /^[A-Z0-9]{6,10}$/;

export function normalizePresentationCode(code: string): string {
  return code.trim().toUpperCase();
}

export function generatePresentationCode(length = DEFAULT_CODE_LENGTH): string {
  let result = "";

  while (result.length < length) {
    const index = safeRandomInt(PRESENTATION_CODE_CHARSET.length);
    result += PRESENTATION_CODE_CHARSET[index] ?? "";
  }

  return result;
}
