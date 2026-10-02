import type { SlotResolutionV2 } from "@/lib/edu/lesson/slotResolverV2";

export type SlotMap = {
  image_primary: string;
  image_any: string[];
  heading_primary: string;
  text_any: string[];
  section_any: string[];
};

export type SlotMapSummary = {
  imagePrimary: string;
  imageAnyCount: number;
  imageAnySamples: string[];
  headingPrimary: string;
  textAnyCount: number;
  textAnySamples: string[];
  sectionAnyCount: number;
  sectionAnySamples: string[];
};

const unique = (values: string[]) => Array.from(new Set(values.filter((v) => v.trim().length > 0)));

const toSelector = (element: Element): string => {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current.tagName.toLowerCase() !== "html") {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const siblings = Array.from(parent.children).filter((child: Element) => child.tagName === current?.tagName);
    const index = siblings.indexOf(current) + 1;
    parts.unshift(`${tag}:nth-of-type(${Math.max(1, index)})`);
    if (tag === "main") break;
    current = parent;
  }
  return parts.join(" > ");
};

const queryAllSelectors = (html: string, query: string): string[] => {
  if (typeof DOMParser === "undefined") return [];
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return Array.from(doc.querySelectorAll(query)).map((node) => toSelector(node));
  } catch {
    return [];
  }
};

export const buildSlotMap = (params: {
  resolved: SlotResolutionV2;
  selectedSelector?: string | null;
  html: string;
}): SlotMap => {
  const { resolved, selectedSelector, html } = params;
  const imageCandidates = resolved.candidates.filter((candidate) => candidate.type === "image").map((candidate) => candidate.selector);
  const textCandidates = resolved.candidates.filter((candidate) => candidate.type === "text").map((candidate) => candidate.selector);

  const imageAny = unique([
    ...(selectedSelector ? [selectedSelector] : []),
    ...imageCandidates,
    ...queryAllSelectors(html, "main img, img"),
    "section.edu-auto-slot img",
  ]);

  const headingAny = queryAllSelectors(html, "main h1, main h2, h1, h2");
  const sectionAny = unique([...queryAllSelectors(html, "main section, section, main article, article, main div, div"), "main", "body"]);
  const textAny = unique([...textCandidates, ...queryAllSelectors(html, "main p, p, main li, li"), "main"]);

  return {
    image_primary: imageAny[0] ?? "section.edu-auto-slot img",
    image_any: imageAny,
    heading_primary: headingAny[0] ?? "h1",
    text_any: textAny,
    section_any: sectionAny,
  };
};

export const summarizeSlotMap = (slotMap: SlotMap): SlotMapSummary => ({
  imagePrimary: slotMap.image_primary,
  imageAnyCount: slotMap.image_any.length,
  imageAnySamples: slotMap.image_any.slice(0, 2),
  headingPrimary: slotMap.heading_primary,
  textAnyCount: slotMap.text_any.length,
  textAnySamples: slotMap.text_any.slice(0, 2),
  sectionAnyCount: slotMap.section_any.length,
  sectionAnySamples: slotMap.section_any.slice(0, 2),
});
