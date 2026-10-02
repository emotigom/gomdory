import { detectKana } from "@/lib/edu/text/koreanGuard";

export type CoachSanitizeResult = {
  text: string;
  flags: {
    hadKana: boolean;
    hadMarkdown: boolean;
    tooLong: boolean;
    hadMeta: boolean;
  };
};

const KANA_REGEX_GLOBAL = /[\u3040-\u30ff]/gu;
const MARKDOWN_LINE_REGEX = /^-{3,}$/;
const LIST_LINE_REGEX = /^-\s+/;
const META_PATTERNS = [
  /영어로 인식/i,
  /모델/i,
  /시스템/i,
  /토큰/i,
  /한자 제거/i,
  /정책/i,
  /프롬프트/i,
  /출력 형식/i,
  /마크다운/i,
];

const splitSentences = (text: string) =>
  text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];

export function sanitizeCoachText(raw: string): CoachSanitizeResult {
  let text = raw.replace(/\r\n/g, "\n").trim();
  let hadMarkdown = false;
  let hadMeta = false;
  const hadKana = detectKana(text);

  const lines = text.split("\n");
  const cleanedLines: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    cleanedLines.push(listBuffer.join(" "));
    listBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    if (MARKDOWN_LINE_REGEX.test(trimmed)) {
      hadMarkdown = true;
      continue;
    }
    if (LIST_LINE_REGEX.test(trimmed)) {
      hadMarkdown = true;
      listBuffer.push(trimmed.replace(LIST_LINE_REGEX, ""));
      continue;
    }
    flushList();
    cleanedLines.push(trimmed);
  }
  flushList();

  const joined = cleanedLines.join(" ");
  const stripped = joined.replace(/```/g, "").replace(/\*\*/g, "").replace(/__/g, "");
  if (stripped !== joined) {
    hadMarkdown = true;
  }
  text = stripped;

  const sentences = splitSentences(text);
  if (sentences.length > 0) {
    const filtered = sentences.filter(
      (sentence) => !META_PATTERNS.some((pattern) => pattern.test(sentence)),
    );
    if (filtered.length !== sentences.length) {
      hadMeta = true;
      text = filtered.join(" ");
    }
  } else {
    const hasMeta = META_PATTERNS.some((pattern) => pattern.test(text));
    if (hasMeta) {
      hadMeta = true;
      text = "";
    }
  }

  if (hadKana) {
    text = text.replace(KANA_REGEX_GLOBAL, "");
  }

  const trimmed = text.replace(/\s+/g, " ").trim();
  const sentenceParts = splitSentences(trimmed);
  let tooLong = false;
  if (sentenceParts.length > 3) {
    tooLong = true;
    text = sentenceParts.slice(0, 3).join(" ").trim();
  } else {
    text = trimmed;
  }

  return {
    text,
    flags: {
      hadKana,
      hadMarkdown,
      tooLong,
      hadMeta,
    },
  };
}
