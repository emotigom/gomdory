import type { CoursewarePageBlock, CoursewarePageBlockType, CoursewarePageDraft } from "./aiCoursewarePageTypes";

const URL_PROTOCOL_ALLOWLIST = new Set(["http:", "https:", "mailto:"]);

export const normalizeText = (value: unknown) => String(value ?? "").replace(/<\s*script/gi, "").trim();

export const normalizeUrl = (value: unknown) => {
  const source = String(value ?? "").trim();
  if (!source) return "";
  try {
    const parsed = new URL(source, "https://local.invalid");
    return URL_PROTOCOL_ALLOWLIST.has(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};

export const isKnownBlockType = (value: unknown): value is CoursewarePageBlockType =>
  ["hero", "text", "button-link", "image-placeholder", "card-grid", "faq", "checklist", "data-insight", "recommendation-table", "quiz-choice", "reflection", "source-list"].includes(String(value));

type LooseRecord = Record<string, unknown>;

const isLooseRecord = (value: unknown): value is LooseRecord => Boolean(value) && typeof value === "object";

export const sanitizeBlock = (block: unknown, order: number): CoursewarePageBlock | null => {
  if (!isLooseRecord(block)) return null;
  const source = block;
  if (!isKnownBlockType(source.type)) return null;
  const base = { id: normalizeText(source.id) || `block-${order + 1}`, type: source.type, titleKo: normalizeText(source.titleKo), order };
  if (source.type === "hero") return { ...base, type: "hero", headlineKo: normalizeText(source.headlineKo), subcopyKo: normalizeText(source.subcopyKo), primaryButtonLabelKo: normalizeText(source.primaryButtonLabelKo), primaryButtonUrl: normalizeUrl(source.primaryButtonUrl) };
  if (source.type === "text") return { ...base, type: "text", headingKo: normalizeText(source.headingKo), bodyKo: normalizeText(source.bodyKo) };
  if (source.type === "button-link") return { ...base, type: "button-link", labelKo: normalizeText(source.labelKo), helperTextKo: normalizeText(source.helperTextKo), url: normalizeUrl(source.url) };
  return { ...base, ...(source as Omit<CoursewarePageBlock, "order" | "id" | "titleKo">), order } as CoursewarePageBlock;
};

export const sanitizeDraft = (draft: unknown): CoursewarePageDraft | null => {
  if (!isLooseRecord(draft)) return null;
  const source: { blocks?: unknown[] } & LooseRecord = draft;
  if (!Array.isArray(source.blocks)) return null;
  const blocks = source.blocks.map((block, index: number) => sanitizeBlock(block, index)).filter(Boolean) as CoursewarePageBlock[];
  return {
    pageId: normalizeText(source.pageId) || `page-${Date.now()}`,
    lessonNumber: Number(source.lessonNumber) || 0,
    titleKo: normalizeText(source.titleKo) || "웹페이지 초안",
    descriptionKo: normalizeText(source.descriptionKo),
    templateId: normalizeText(source.templateId),
    blocks,
    updatedAt: new Date().toISOString(),
    source: "local-page-draft",
    version: 1,
  };
};
