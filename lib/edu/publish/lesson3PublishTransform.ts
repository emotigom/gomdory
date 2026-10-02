export type ParsedHtmlDocument = { raw: string; doc: Document | null };

const PUBLISH_INTRO_TEXT = "퀴즈를 선택해 점수를 확인해 보세요.";

const ensureNoopener = (rel: string): string => {
  const tokens = rel
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens.includes("noopener")) {
    tokens.push("noopener");
  }
  return tokens.join(" ");
};

const isExternalHref = (href: string): boolean => /^https?:\/\//i.test(href.trim());

export const parseHtmlDocument = (html: string): ParsedHtmlDocument => {
  if (typeof DOMParser === "undefined") return { raw: html, doc: null };
  const parser = new DOMParser();
  return { raw: html, doc: parser.parseFromString(html, "text/html") };
};

export const serializeHtmlDocument = (parsed: ParsedHtmlDocument): string => {
  if (!parsed.doc) return parsed.raw;
  const doctype = parsed.doc.doctype
    ? `<!DOCTYPE ${parsed.doc.doctype.name}${parsed.doc.doctype.publicId ? ` PUBLIC "${parsed.doc.doctype.publicId}"` : ""}${parsed.doc.doctype.systemId ? ` "${parsed.doc.doctype.systemId}"` : ""}>`
    : "";
  return `${doctype}${parsed.doc.documentElement.outerHTML}`;
};

export const transformLesson3ForPublish = (html: string): string => {
  if (!html) return html;

  const parsed = parseHtmlDocument(html);
  if (parsed.doc) {
    parsed.doc.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      if (!isExternalHref(href)) return;
      anchor.setAttribute("rel", ensureNoopener(anchor.getAttribute("rel") ?? ""));
    });

    const intro = parsed.doc.querySelector('[data-slot="p3.subtitle"]');
    if (intro) {
      intro.textContent = PUBLISH_INTRO_TEXT;
    }

    return serializeHtmlDocument(parsed);
  }

  const withNoopener = html.replace(/<a\b([^>]*?)>/gi, (tag, attrs: string) => {
    const hrefMatch = attrs.match(/\bhref\s*=\s*(["'])([\s\S]*?)\1/i);
    if (!hrefMatch || !isExternalHref(hrefMatch[2])) return tag;

    const relMatch = attrs.match(/\brel\s*=\s*(["'])([\s\S]*?)\1/i);
    if (relMatch) {
      const nextRel = ensureNoopener(relMatch[2]);
      return tag.replace(relMatch[0], `rel=${relMatch[1]}${nextRel}${relMatch[1]}`);
    }

    return `<a${attrs} rel="noopener">`;
  });

  return withNoopener.replace(
    /(<[^>]*data-slot=("|')p3\.subtitle\2[^>]*>)[\s\S]*?(<\/[^>]+>)/i,
    `$1${PUBLISH_INTRO_TEXT}$3`,
  );
};
