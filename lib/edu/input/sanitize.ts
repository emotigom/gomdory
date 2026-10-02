export type Sanitized = {
  sanitized: string;
  changed: boolean;
  flags: {
    tooShort: boolean;
    tooLong: boolean;
    hasProfanity: boolean;
    hasWeirdChars: boolean;
    looksLikePaste: boolean;
  };
};

const MIN_LENGTH = 6;
const MAX_LENGTH = 800;
const WEIRD_CHAR_RATIO = 0.3;
const PROFANITY_LIST = ["fuck", "shit", "bastard", "씨발", "개새"];

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const countWeirdChars = (value: string) => {
  let weird = 0;
  let total = 0;
  for (const char of value) {
    total += 1;
    if (!/[가-힣A-Za-z0-9\s.,!?"'“”‘’()\-—:;…]/.test(char)) {
      weird += 1;
    }
  }
  return { weird, total };
};

const maskProfanity = (value: string) => {
  let result = value;
  let hasProfanity = false;
  for (const word of PROFANITY_LIST) {
    const pattern = new RegExp(word, "gi");
    if (pattern.test(result)) {
      hasProfanity = true;
      result = result.replace(pattern, (match) => "*".repeat(Math.max(2, match.length)));
    }
  }
  return { result, hasProfanity };
};

const tidySymbols = (value: string) => {
  let result = value;
  result = result.replace(/(\p{Extended_Pictographic})\p{Extended_Pictographic}+/gu, "$1");
  result = result.replace(/([~!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/—-])\1{2,}/g, "$1$1");
  result = result.replace(/[^\p{L}\p{N}\s.,!?"'“”‘’()\-—:;…]/gu, " ");
  return normalizeWhitespace(result);
};

export function sanitizeUserInput(raw: string): Sanitized {
  const normalized = normalizeWhitespace(raw);
  const length = normalized.length;
  const { weird, total } = countWeirdChars(normalized);
  const hasWeirdChars = total > 0 && weird / total >= WEIRD_CHAR_RATIO;
  const { result: profanityMasked, hasProfanity } = maskProfanity(normalized);
  const tooShort = length > 0 && length < MIN_LENGTH;
  const tooLong = length > MAX_LENGTH;
  const looksLikePaste =
    raw.length > 400 && (raw.split(/\n/).length > 3 || /[^\s]{40,}/.test(raw));

  let sanitized = profanityMasked;
  if (tooLong) {
    sanitized = `${sanitized.slice(0, MAX_LENGTH).trimEnd()}…`;
  }
  if (hasWeirdChars) {
    sanitized = tidySymbols(sanitized);
  }
  sanitized = normalizeWhitespace(sanitized);

  const noAutoOverride =
    tooShort && !tooLong && !hasProfanity && !hasWeirdChars && !looksLikePaste;
  if (noAutoOverride) {
    return {
      sanitized: raw,
      changed: false,
      flags: { tooShort, tooLong, hasProfanity, hasWeirdChars, looksLikePaste },
    };
  }

  const changed = sanitized !== raw;
  return {
    sanitized,
    changed,
    flags: { tooShort, tooLong, hasProfanity, hasWeirdChars, looksLikePaste },
  };
}
