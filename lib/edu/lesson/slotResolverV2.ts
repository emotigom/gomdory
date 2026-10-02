import { fingerprintHtml, getTemplateSlotMap } from "@/lib/edu/lesson/templateFingerprint";

export type SlotType = "image" | "text";

export type SlotCandidate = {
  id: string;
  type: SlotType;
  selector: string;
  tagName: string;
};

export type SlotResolveSource = "slotmap" | "heuristic" | "injected" | "heuristic_none";

export type SlotResolutionV2 = {
  html: string;
  fingerprint: string;
  source: SlotResolveSource;
  candidates: SlotCandidate[];
  selected: SlotCandidate | null;
};

const AUTO_SLOT_CLASS = "edu-auto-slot";
const AUTO_SLOT_ID = "edu_auto_1";

const TEXT_PRIORITY: Record<string, number> = {
  h1: 100,
  h2: 90,
  h3: 80,
  p: 70,
  li: 60,
  span: 40,
  div: 30,
};

const PHOTO_SLOT_KEYWORD_REGEX = /(사진|이미지|image|photo|pic|자리|그림)/i;

const tryParse = (html: string) => {
  if (typeof DOMParser === "undefined") return null;
  try {
    return new DOMParser().parseFromString(html, "text/html");
  } catch {
    return null;
  }
};

const isLikelyIcon = (img: HTMLImageElement) => {
  const width = Number(img.getAttribute("width") ?? "0");
  const height = Number(img.getAttribute("height") ?? "0");
  if ((width > 0 && width <= 48) || (height > 0 && height <= 48)) return true;
  const cls = `${img.className} ${img.getAttribute("aria-label") ?? ""}`.toLowerCase();
  return /icon|logo|badge|emoji/.test(cls);
};

function first<T>(values: Array<T | null | undefined>): T | null {
  return values.find(Boolean) ?? null;
}

const toSelector = (element: Element | null): string | null => {
  if (!element) return null;
  if (element.id) return `#${CSS.escape(element.id)}`;
  if (element.classList.length > 0) {
    const stableClass = Array.from(element.classList).find((value) => /^[-_a-zA-Z0-9]+$/.test(value));
    if (stableClass) {
      const base = `${element.tagName.toLowerCase()}.${CSS.escape(stableClass)}`;
      const siblingMatches = element.parentElement?.querySelectorAll(base).length ?? 0;
      if (siblingMatches <= 1) return base;
    }
  }
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current.tagName.toLowerCase() !== "html") {
    const tag = current.tagName.toLowerCase();
    const parentElement: Element | null = current.parentElement;
    if (!parentElement) {
      parts.unshift(tag);
      break;
    }
    const currentTagName = current.tagName;
    const siblings = Array.from(parentElement.children).filter((child) => child.tagName === currentTagName);
    const index = siblings.indexOf(current) + 1;
    parts.unshift(`${tag}:nth-of-type(${Math.max(1, index)})`);
    if (tag === "main") break;
    current = parentElement;
  }
  return parts.join(" > ");
};

const uniqBySelector = (items: SlotCandidate[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.selector)) return false;
    seen.add(item.selector);
    return true;
  });
};

const resolveInjectedCandidate = (doc: Document): SlotCandidate | null => {
  const injected = doc.querySelector(`section.${AUTO_SLOT_CLASS}[data-slot-id='${AUTO_SLOT_ID}'], section.${AUTO_SLOT_CLASS}[data-slot-id^='edu_auto_']`);
  if (!injected) return null;
  const injectedSlotId = injected.getAttribute("data-slot-id") ?? AUTO_SLOT_ID;
  const imageNode = injected.querySelector("img");
  const selector = imageNode ? `section.${AUTO_SLOT_CLASS}[data-slot-id='${injectedSlotId}'] img` : `section.${AUTO_SLOT_CLASS}[data-slot-id='${injectedSlotId}']`;
  return {
    id: `injected.image.${injectedSlotId}`,
    type: "image",
    selector,
    tagName: imageNode?.tagName.toLowerCase() ?? injected.tagName.toLowerCase(),
  };
};

const resolvePhotoAreaCandidate = (doc: Document): SlotCandidate | null => {
  const containers = Array.from(doc.querySelectorAll("main section, section, main article, article, main div, div"));
  const match = containers.find((node) => {
    const text = (node.textContent ?? "").trim();
    if (text.length === 0 || text.length > 300) return false;
    if (!PHOTO_SLOT_KEYWORD_REGEX.test(text)) return false;
    const attrText = `${node.getAttribute("data-slot") ?? ""} ${node.getAttribute("data-slot-id") ?? ""} ${node.getAttribute("class") ?? ""}`;
    return PHOTO_SLOT_KEYWORD_REGEX.test(text) || PHOTO_SLOT_KEYWORD_REGEX.test(attrText);
  });
  if (!match) return null;

  const existingSel = match.getAttribute("data-edu-auto-sel");
  const slotToken = existingSel && existingSel.trim().length > 0 ? existingSel.trim() : "photo_slot_1";
  match.setAttribute("data-edu-auto-sel", slotToken);
  return {
    id: `heuristic.image.${slotToken}`,
    type: "image",
    selector: `[data-edu-auto-sel='${slotToken}']`,
    tagName: match.tagName.toLowerCase(),
  };
};

const resolveWithDom = (html: string): SlotResolutionV2 => {
  const doc = tryParse(html);
  const fingerprint = fingerprintHtml(html);
  if (!doc) {
    const injectedMatch = html.match(/<section[^>]*class=["'][^"']*edu-auto-slot[^"']*["'][^>]*data-slot-id=["'](edu_auto_[^"']+)["'][^>]*>/i);
    if (injectedMatch?.[1]) {
      const injectedSlotId = injectedMatch[1];
      const candidate: SlotCandidate = {
        id: `injected.image.${injectedSlotId}`,
        type: "image",
        selector: `section.${AUTO_SLOT_CLASS}[data-slot-id='${injectedSlotId}'] img`,
        tagName: "img",
      };
      return { html, fingerprint, source: "injected", candidates: [candidate], selected: candidate };
    }
    const slotIdMatch = html.match(/data-slot-id=["']([^"']+)["']/i) ?? html.match(/data-slot=["']([^"']+)["']/i);
    if (slotIdMatch?.[1]) {
      const candidate: SlotCandidate = { id: slotIdMatch[1], type: "image", selector: "img", tagName: "img" };
      return { html, fingerprint, source: "heuristic", candidates: [candidate], selected: candidate };
    }
    if (/(?:data-slot|data-slot-id|data-edu-slot)=["'][^"']*(?:image|photo|decorate)[^"']*["']/i.test(html) || /<img\b/i.test(html)) {
      const candidate: SlotCandidate = { id: "heuristic.image.1", type: "image", selector: "img", tagName: "img" };
      return { html, fingerprint, source: "heuristic", candidates: [candidate], selected: candidate };
    }
    return { html, fingerprint, source: "heuristic_none", candidates: [], selected: null };
  }

  const injectedCandidate = resolveInjectedCandidate(doc);
  if (injectedCandidate) {
    return {
      html,
      fingerprint,
      source: "injected",
      candidates: [injectedCandidate],
      selected: injectedCandidate,
    };
  }

  const map = getTemplateSlotMap(fingerprint);
  if (map) {
    const mappedCandidates = [
      ...map.imageSelectors.map((selector, index) => {
        const node = doc.querySelector(selector);
        if (!node) return null;
        return {
          id: `slotmap.image.${index + 1}`,
          type: "image" as const,
          selector: toSelector(node) ?? selector,
          tagName: node.tagName.toLowerCase(),
        };
      }),
      ...map.textSelectors.map((selector, index) => {
        const node = doc.querySelector(selector);
        if (!node) return null;
        return {
          id: `slotmap.text.${index + 1}`,
          type: "text" as const,
          selector: toSelector(node) ?? selector,
          tagName: node.tagName.toLowerCase(),
        };
      }),
    ].filter((v): v is NonNullable<typeof v> => Boolean(v));
    const mapped = uniqBySelector(mappedCandidates);
    if (mapped.length > 0) {
      const selected = mapped.find((candidate) => candidate.type === "image") ?? mapped[0] ?? null;
      return { html, fingerprint, source: "slotmap", candidates: mapped, selected };
    }
  }

  const main = doc.querySelector("main");
  const meaningful = (img: HTMLImageElement) => {
    if (isLikelyIcon(img)) return false;
    const width = Number(img.getAttribute("width") ?? "0");
    const height = Number(img.getAttribute("height") ?? "0");
    if (width > 0 && height > 0) return width * height >= 2_304;
    return true;
  };

  const mainImages = main ? Array.from(main.querySelectorAll("img")) : [];
  const allImages = Array.from(doc.querySelectorAll("img"));
  const imageNode = first([
    ...mainImages.filter(meaningful),
    ...allImages.filter(meaningful),
    main?.querySelector("picture img"),
    doc.querySelector("picture img"),
    doc.querySelector("figure img"),
  ]);

  const mainTextCandidates = main ? Array.from(main.querySelectorAll("h1, h2")) : [];
  const paragraphCandidates = [
    ...(main ? Array.from(main.querySelectorAll("p")) : []),
    ...Array.from(doc.querySelectorAll("p")),
  ].filter((p) => (p.textContent ?? "").trim().length > 20);

  const rankedTextNode = first(
    Array.from(doc.querySelectorAll("h1, h2, h3, p, li, span, div"))
      .map((node) => {
        const text = (node.textContent ?? "").trim();
        if (text.length < 6) return null;
        const tag = node.tagName.toLowerCase();
        const priority = TEXT_PRIORITY[tag] ?? 0;
        return { node, score: priority + Math.min(30, Math.floor(text.length / 12)) };
      })
      .filter((entry): entry is { node: Element; score: number } => Boolean(entry))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.node),
  );

  const textNode = first([...mainTextCandidates, ...paragraphCandidates, rankedTextNode]);

  const heuristicCandidates: SlotCandidate[] = [];
  if (imageNode) {
    const selector = toSelector(imageNode);
    heuristicCandidates.push({
      id: "heuristic.image.1",
      type: "image",
      selector: selector ?? "img",
      tagName: imageNode.tagName.toLowerCase(),
    });
  }

  const photoAreaCandidate = resolvePhotoAreaCandidate(doc);
  if (photoAreaCandidate) {
    heuristicCandidates.push(photoAreaCandidate);
  }

  if (textNode) {
    const selector = toSelector(textNode) ?? textNode.tagName.toLowerCase();
    heuristicCandidates.push({
      id: "heuristic.text.1",
      type: "text",
      selector,
      tagName: textNode.tagName.toLowerCase(),
    });
  }

  const deduped = uniqBySelector(heuristicCandidates);
  if (deduped.length > 0) {
    const nextHtml = doc.documentElement.outerHTML;
    return {
      html: nextHtml,
      fingerprint,
      source: "heuristic",
      candidates: deduped,
      selected: deduped.find((item) => item.type === "image") ?? deduped[0] ?? null,
    };
  }

  return {
    html,
    fingerprint,
    source: "heuristic_none",
    candidates: [],
    selected: null,
  };
};

export const resolveSlotsFromHtmlV2 = (html: string): SlotResolutionV2 => {
  if (!html.trim()) {
    return {
      html,
      fingerprint: fingerprintHtml(html),
      source: "heuristic_none",
      candidates: [],
      selected: null,
    };
  }
  return resolveWithDom(html);
};
