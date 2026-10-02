const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const HTML_TAG_REGEX = /<[^>]*>/g;

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export type SanitizeTextOptions = {
  maxLength?: number;
  maxLines?: number;
  maxRepeat?: number;
  maxConsecutiveSpaces?: number;
  maxConsecutiveNewlines?: number;
};

export type SanitizedTextResult = {
  text: string;
  flags: string[];
  reasons: string[];
};

function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, (match) => ESCAPE_MAP[match] ?? match);
}

function reduceRepeats(input: string, maxRepeat: number) {
  if (!input) return input;
  let result = "";
  let last = "";
  let run = 0;

  for (const char of input) {
    if (char === last) {
      run += 1;
      if (run <= maxRepeat) {
        result += char;
      }
    } else {
      last = char;
      run = 1;
      result += char;
    }
  }

  return result;
}

function clampRuns(input: string, pattern: RegExp, max: number, replacement: string) {
  let changed = false;
  const next = input.replace(pattern, () => {
    changed = true;
    return replacement.repeat(max);
  });
  return { value: next, changed };
}

export function sanitizeText(rawText: string, options: SanitizeTextOptions = {}): SanitizedTextResult {
  const {
    maxLength = 400,
    maxLines = 6,
    maxRepeat = 4,
    maxConsecutiveSpaces = 2,
    maxConsecutiveNewlines = 2,
  } = options;
  const flags: string[] = [];

  let text = rawText ?? "";

  const withoutControl = text.replace(ZERO_WIDTH_REGEX, "").replace(CONTROL_CHAR_REGEX, "");
  if (withoutControl !== text) {
    flags.push("control_chars");
  }
  text = withoutControl;

  const stripped = text.replace(HTML_TAG_REGEX, "");
  if (stripped !== text) {
    text = stripped;
  }

  text = escapeHtml(text);

  text = text.replace(/\r\n/g, "\n").replace(/\t/g, " ");

  const spaceClamp = clampRuns(text, / {3,}/g, maxConsecutiveSpaces, " ");
  text = spaceClamp.value;

  const newlineClamp = clampRuns(text, /\n{3,}/g, maxConsecutiveNewlines, "\n");
  text = newlineClamp.value;
  if (spaceClamp.changed || newlineClamp.changed) {
    flags.push("spammy");
  }

  const lines = text.split("\n");
  if (lines.length > maxLines) {
    text = lines.slice(0, maxLines).join("\n");
    flags.push("truncated");
  }

  const reduced = reduceRepeats(text, maxRepeat);
  if (reduced !== text) {
    text = reduced;
    flags.push("spammy");
  }

  text = text.trim();

  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
    flags.push("truncated");
  }

  const uniqueFlags = Array.from(new Set(flags));
  return { text, flags: uniqueFlags, reasons: uniqueFlags };
}
