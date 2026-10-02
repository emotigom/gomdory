import { normalizeUrl } from "@/lib/edu/url";

const OPEN_LABEL = "열기";
const FEATURED_PLACEHOLDER = "대표 작품 링크 자리";
const CARD_PLACEHOLDER = "작품 링크 붙이기";
const DESC_PLACEHOLDER = "작품 한 줄 소개를 넣어 보세요.";

export const normalizeLesson4Url = normalizeUrl;

export const readAttr = (source: string, attrName: string): string => {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match?.[2]?.trim() ?? "";
};

export const stripTags = (source: string): string => source.replace(/<[^>]+>/g, "").trim();

export type ParsedHtmlDocument = { raw: string; doc: Document | null };

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

export const isUntouchedPlaceholderCard = ({
  dataUrl,
  buttonText,
  descText,
}: {
  dataUrl: string;
  buttonText: string;
  descText: string;
}): boolean => {
  const normalizedText = normalizeLesson4Url(buttonText);
  return !dataUrl && !normalizedText.ok && buttonText === CARD_PLACEHOLDER && descText === DESC_PLACEHOLDER;
};

const replaceFeaturedButton = (html: string): string => {
  const featuredRegex = /<button\b[^>]*class=("|')[^"']*\bfeatured-link\b[^"']*\1[^>]*>([\s\S]*?)<\/button>/i;

  const match = html.match(featuredRegex);
  if (!match) return html;

  const buttonTag = match[0];
  const sourceUrl = readAttr(buttonTag, "data-url") || stripTags(match[2]) || FEATURED_PLACEHOLDER;
  const normalized = normalizeLesson4Url(sourceUrl);
  const hrefAttrs = normalized.ok && normalized.url ? ` href="${normalized.url}" target="_blank" rel="noopener noreferrer"` : "";
  const anchor = `<a class="featured-link" aria-label="대표 작품 링크 자리"${hrefAttrs}>${OPEN_LABEL}</a>`;
  return html.replace(buttonTag, anchor);
};

const transformGalleryCard = (cardHtml: string): string => {
  const buttonMatch = cardHtml.match(
    /<button\b[^>]*class=("|')[^"']*\blink-placeholder\b[^"']*\1[^>]*>([\s\S]*?)<\/button>/i,
  );
  const descMatch = cardHtml.match(/<p>([\s\S]*?)<\/p>/i);

  if (!buttonMatch || !descMatch) return cardHtml;

  const buttonTag = buttonMatch[0];
  const dataUrl = readAttr(buttonTag, "data-url");
  const buttonText = stripTags(buttonMatch[2]);
  const descText = stripTags(descMatch[1]);

  if (
    isUntouchedPlaceholderCard({
      dataUrl,
      buttonText,
      descText,
    })
  ) {
    return "";
  }

  const normalized = normalizeLesson4Url(dataUrl || buttonText);
  if (normalized.ok && normalized.url) {
    const anchor = `<a class="link-placeholder" aria-label="작품 링크 붙이기" href="${normalized.url}" target="_blank" rel="noopener noreferrer">${OPEN_LABEL}</a>`;
    return cardHtml.replace(buttonTag, anchor);
  }

  return cardHtml.replace(buttonTag, "");
};

export const transformLesson4ForPublish = (html: string): string => {
  if (!html) return html;

  const featuredHandled = replaceFeaturedButton(html);
  const galleryHandled = featuredHandled.replace(
    /<article\b[^>]*class=("|')[^"']*\bgallery-card\b[^"']*\1[^>]*>[\s\S]*?<\/article>/gi,
    (card) => transformGalleryCard(card),
  );
  return galleryHandled.replace(/\s*<script\b[^>]*src=("|')script\.js\1[^>]*><\/script>\s*/gi, "");
};

export type Lesson4PublishWarningCode = "featured-link-invalid" | "all-gallery-cards-placeholder";

export const collectLesson4PublishWarnings = (html: string): Lesson4PublishWarningCode[] => {
  if (!html) return [];

  const warnings: Lesson4PublishWarningCode[] = [];
  const featuredMatch = html.match(
    /<button\b[^>]*class=("|')[^"']*\bfeatured-link\b[^"']*\1[^>]*>([\s\S]*?)<\/button>/i,
  );

  if (featuredMatch) {
    const featuredTag = featuredMatch[0];
    const featuredSource = readAttr(featuredTag, "data-url") || stripTags(featuredMatch[2]) || FEATURED_PLACEHOLDER;
    const featuredNormalized = normalizeLesson4Url(featuredSource);
    if (!featuredNormalized.ok || !featuredNormalized.url) {
      warnings.push("featured-link-invalid");
    }
  }

  const cards = html.match(/<article\b[^>]*class=("|')[^"']*\bgallery-card\b[^"']*\1[^>]*>[\s\S]*?<\/article>/gi) ?? [];
  if (cards.length > 0) {
    const allPlaceholder = cards.every((cardHtml) => {
      const buttonMatch = cardHtml.match(
        /<button\b[^>]*class=("|')[^"']*\blink-placeholder\b[^"']*\1[^>]*>([\s\S]*?)<\/button>/i,
      );
      const descMatch = cardHtml.match(/<p>([\s\S]*?)<\/p>/i);
      if (!buttonMatch || !descMatch) {
        return false;
      }

      return isUntouchedPlaceholderCard({
        dataUrl: readAttr(buttonMatch[0], "data-url"),
        buttonText: stripTags(buttonMatch[2]),
        descText: stripTags(descMatch[1]),
      });
    });

    if (allPlaceholder) {
      warnings.push("all-gallery-cards-placeholder");
    }
  }

  return warnings;
};
