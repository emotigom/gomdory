export type LinkifiedTextSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

const MARKDOWN_LINK_PATTERN = /\[([^\]\n]{0,120})\]\((https?:\/\/[^\s<>'"`)]*)\)/giu;
const URL_CANDIDATE_PATTERN = /(?:https?:\/\/|www\.|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})(?:[^\s<>"'`]*)?/giu;
const TRAILING_URL_PUNCTUATION = /[.,!?;:]+$/u;
const PLACEHOLDER_LINK_LABELS = new Set(["링크", "link", "url"]);
const CLOSING_TO_OPENING: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
  "〉": "〈",
  "》": "《",
};

function hasMore(value: string, needle: string, compare: string) {
  return value.split(needle).length > value.split(compare).length;
}

function trimTrailingPunctuation(value: string) {
  let urlText = value;
  let trailing = "";

  const punctuationMatch = urlText.match(TRAILING_URL_PUNCTUATION);
  if (punctuationMatch?.[0]) {
    urlText = urlText.slice(0, -punctuationMatch[0].length);
    trailing = punctuationMatch[0] + trailing;
  }

  let changed = true;
  while (changed && urlText.length > 0) {
    changed = false;
    const last = urlText[urlText.length - 1];
    const opening = CLOSING_TO_OPENING[last];
    if (opening && hasMore(urlText, last, opening)) {
      urlText = urlText.slice(0, -1);
      trailing = last + trailing;
      changed = true;
    }
  }

  return { urlText, trailing };
}

export function normalizeLinkifiedHref(rawUrl: string) {
  const candidate = rawUrl.startsWith("www.") || !/^https?:\/\//iu.test(rawUrl) ? `https://${rawUrl}` : rawUrl;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.hostname.includes(".")) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function shouldSkipCandidate(text: string, start: number, rawUrl: string) {
  const previous = start > 0 ? text[start - 1] : "";
  if (previous === "@") return true;
  if (!/^https?:\/\//iu.test(rawUrl) && !rawUrl.startsWith("www.") && /[\w.-]/u.test(previous)) {
    return true;
  }
  return false;
}

function getDisplayTextForCardLink(label: string, urlText: string) {
  const normalizedLabel = label.trim();
  if (!normalizedLabel || PLACEHOLDER_LINK_LABELS.has(normalizedLabel.toLowerCase())) {
    return urlText;
  }
  return normalizedLabel;
}

function appendLinkifiedPlainText(segments: LinkifiedTextSegment[], text: string) {
  if (!text) return;

  let cursor = 0;

  for (const match of text.matchAll(URL_CANDIDATE_PATTERN)) {
    const rawCandidate = match[0];
    const index = match.index ?? 0;
    if (!rawCandidate || index < cursor || shouldSkipCandidate(text, index, rawCandidate)) {
      continue;
    }

    const { urlText, trailing } = trimTrailingPunctuation(rawCandidate);
    const href = normalizeLinkifiedHref(urlText);
    if (!href) {
      continue;
    }

    if (index > cursor) {
      segments.push({ type: "text", text: text.slice(cursor, index) });
    }
    segments.push({ type: "link", text: urlText, href });
    if (trailing) {
      segments.push({ type: "text", text: trailing });
    }
    cursor = index + rawCandidate.length;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", text: text.slice(cursor) });
  }
}

export function linkifyPlainText(text: string): LinkifiedTextSegment[] {
  if (!text) return [];

  const segments: LinkifiedTextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(MARKDOWN_LINK_PATTERN)) {
    const rawMarkdown = match[0];
    const label = match[1] ?? "";
    const rawUrl = match[2] ?? "";
    const index = match.index ?? 0;
    if (!rawMarkdown || index < cursor) {
      continue;
    }

    const href = normalizeLinkifiedHref(rawUrl);
    if (!href) {
      continue;
    }

    appendLinkifiedPlainText(segments, text.slice(cursor, index));
    segments.push({ type: "link", text: getDisplayTextForCardLink(label, rawUrl), href });
    cursor = index + rawMarkdown.length;
  }

  appendLinkifiedPlainText(segments, text.slice(cursor));

  return segments.length > 0 ? segments : [{ type: "text", text }];
}
