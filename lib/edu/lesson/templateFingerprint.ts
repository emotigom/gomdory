export type SlotMap = {
  imageSelectors: string[];
  textSelectors: string[];
};

const normalizeHtml = (html: string) => html.replace(/\s+/g, " ").trim();

const fnv1a = (input: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const tokenizeStructure = (html: string) => {
  const normalized = normalizeHtml(html)
    .replace(/\s(?:data-[\w-]+|aria-[\w-]+|style|title|alt|src|href)=("[^"]*"|'[^']*')/gi, "")
    .replace(/\s(id|class)=("[^"]*"|'[^']*')/gi, "")
    .replace(/>[^<]+</g, "><");

  const tags = Array.from(normalized.matchAll(/<\/?([a-z0-9-]+)/gi)).map((m) =>
    (m[0]?.startsWith("</") ? "/" : "") + (m[1] ?? "").toLowerCase(),
  );
  const keyHints = ["hero", "gallery", "featured", "card-grid", "timeline", "agenda", "profile", "highlight"]
    .filter((token) => normalized.toLowerCase().includes(token))
    .join("|");
  return `${tags.join(",")}::${keyHints}`;
};

export const fingerprintHtml = (html: string): string => {
  const structure = tokenizeStructure(html);
  return `${fnv1a(structure)}:${structure.slice(0, 120)}`;
};

const SLOTMAP_RULES: Array<{ includes: string[]; map: SlotMap }> = [
  {
    includes: ["card-grid", "highlight", "profile"],
    map: {
      imageSelectors: ["main .highlight", "main .hero", "main"],
      textSelectors: ["main .highlight h2", "main h1", "main .lead"],
    },
  },
  {
    includes: ["timeline", "hero", "main"],
    map: {
      imageSelectors: ["main .hero", "main .timeline", "main"],
      textSelectors: ["main .hero h1", "main .hero p", "main h2"],
    },
  },
  {
    includes: ["gallery", "featured", "hero"],
    map: {
      imageSelectors: ["main .featured", "main .gallery-card", "main"],
      textSelectors: ["main .featured h2", "main h1", "main .lead"],
    },
  },
];

export const getTemplateSlotMap = (fingerprint: string): SlotMap | null => {
  const lower = fingerprint.toLowerCase();
  const matched = SLOTMAP_RULES.find((rule) => rule.includes.every((token) => lower.includes(token)));
  return matched?.map ?? null;
};
