export type SiteContentBlockTone = "info" | "warn" | "success";
export type SiteContentMediaKind = "image" | "file";

export type SiteContentBlock =
  | { type: "heading"; text: string; level: 2 | 3 | 4 }
  | { type: "paragraph"; text: string }
  | { type: "markdown"; text: string }
  | { type: "callout"; tone: SiteContentBlockTone; text: string }
  | { type: "links"; items: Array<{ label: string; href: string }> }
  | { type: "media"; fileId: string; kind: SiteContentMediaKind };

export type SiteContentBlocksValidationResult =
  | { ok: true; blocks: SiteContentBlock[] }
  | { ok: false; message: string };

export const SITE_CONTENT_BLOCK_LIMITS = {
  maxBlocks: 30,
  maxTextLength: 8_000,
  maxHeadingLength: 140,
  maxParagraphLength: 2_000,
  maxCalloutLength: 500,
  maxMarkdownLength: 8_000,
  maxLinksPerBlock: 12,
  maxLinkLabelLength: 80,
  maxHrefLength: 512,
  maxFileIdLength: 128,
} as const;

const ALLOWED_TONES = new Set<SiteContentBlockTone>(["info", "warn", "success"]);
const ALLOWED_MEDIA_KINDS = new Set<SiteContentMediaKind>(["image", "file"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  if (!next || next.length > maxLength) return null;
  return next;
}

function hasUnsafeMarkdown(text: string): boolean {
  return /<\s*\/?\s*[a-z!][^>]*>/i.test(text) || /<\s*iframe\b/i.test(text);
}

export function isAllowedSiteContentHref(value: string): boolean {
  if (value.startsWith("/")) return true;
  if (!value.startsWith("https://")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function validateSiteContentBlocks(
  input: unknown,
  options?: { resolveMediaFile?: (fileId: string, kind: SiteContentMediaKind) => Promise<boolean> },
): Promise<SiteContentBlocksValidationResult> {
  if (input === null || input === undefined) return { ok: true, blocks: [] };
  if (!Array.isArray(input)) return { ok: false, message: "블록은 배열이어야 합니다." };
  if (input.length > SITE_CONTENT_BLOCK_LIMITS.maxBlocks) {
    return { ok: false, message: `블록은 최대 ${SITE_CONTENT_BLOCK_LIMITS.maxBlocks}개까지 허용됩니다.` };
  }

  const blocks: SiteContentBlock[] = [];
  for (const [index, raw] of input.entries()) {
    if (!isRecord(raw) || typeof raw.type !== "string") {
      return { ok: false, message: `블록 ${index + 1}: type이 필요합니다.` };
    }

    switch (raw.type) {
      case "heading": {
        const text = cleanText(raw.text, SITE_CONTENT_BLOCK_LIMITS.maxHeadingLength);
        const level = raw.level;
        if (!text || (level !== 2 && level !== 3 && level !== 4)) {
          return { ok: false, message: `블록 ${index + 1}: heading 형식이 올바르지 않습니다.` };
        }
        blocks.push({ type: "heading", text, level });
        break;
      }
      case "paragraph": {
        const text = cleanText(raw.text, SITE_CONTENT_BLOCK_LIMITS.maxParagraphLength);
        if (!text) return { ok: false, message: `블록 ${index + 1}: paragraph text를 확인하세요.` };
        blocks.push({ type: "paragraph", text });
        break;
      }
      case "markdown": {
        const text = cleanText(raw.text, SITE_CONTENT_BLOCK_LIMITS.maxMarkdownLength);
        if (!text || hasUnsafeMarkdown(text)) {
          return { ok: false, message: `블록 ${index + 1}: markdown에 허용되지 않은 HTML이 있습니다.` };
        }
        blocks.push({ type: "markdown", text });
        break;
      }
      case "callout": {
        const text = cleanText(raw.text, SITE_CONTENT_BLOCK_LIMITS.maxCalloutLength);
        const tone = raw.tone;
        if (!text || typeof tone !== "string" || !ALLOWED_TONES.has(tone as SiteContentBlockTone)) {
          return { ok: false, message: `블록 ${index + 1}: callout 형식이 올바르지 않습니다.` };
        }
        blocks.push({ type: "callout", tone: tone as SiteContentBlockTone, text });
        break;
      }
      case "links": {
        if (!Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > SITE_CONTENT_BLOCK_LIMITS.maxLinksPerBlock) {
          return { ok: false, message: `블록 ${index + 1}: links 아이템 수를 확인하세요.` };
        }
        const items: Array<{ label: string; href: string }> = [];
        for (const item of raw.items) {
          if (!isRecord(item)) return { ok: false, message: `블록 ${index + 1}: links 형식이 올바르지 않습니다.` };
          const label = cleanText(item.label, SITE_CONTENT_BLOCK_LIMITS.maxLinkLabelLength);
          const href = cleanText(item.href, SITE_CONTENT_BLOCK_LIMITS.maxHrefLength);
          if (!label || !href || !isAllowedSiteContentHref(href)) {
            return { ok: false, message: `블록 ${index + 1}: 링크(label/href) 규칙을 확인하세요.` };
          }
          items.push({ label, href });
        }
        blocks.push({ type: "links", items });
        break;
      }
      case "media": {
        const fileId = cleanText(raw.fileId, SITE_CONTENT_BLOCK_LIMITS.maxFileIdLength);
        const kind = raw.kind;
        if (!fileId || typeof kind !== "string" || !ALLOWED_MEDIA_KINDS.has(kind as SiteContentMediaKind)) {
          return { ok: false, message: `블록 ${index + 1}: media 형식이 올바르지 않습니다.` };
        }
        if (options?.resolveMediaFile) {
          const ok = await options.resolveMediaFile(fileId, kind as SiteContentMediaKind);
          if (!ok) return { ok: false, message: `블록 ${index + 1}: media 파일을 찾을 수 없습니다.` };
        }
        blocks.push({ type: "media", fileId, kind: kind as SiteContentMediaKind });
        break;
      }
      default:
        return { ok: false, message: `블록 ${index + 1}: 지원하지 않는 type(${raw.type})입니다.` };
    }
  }

  return { ok: true, blocks };
}

export async function parseSiteContentBlocksJson(
  jsonText: string,
  options?: { resolveMediaFile?: (fileId: string, kind: SiteContentMediaKind) => Promise<boolean> },
): Promise<SiteContentBlocksValidationResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, message: "JSON 파싱에 실패했습니다." };
  }
  return validateSiteContentBlocks(parsed, options);
}
