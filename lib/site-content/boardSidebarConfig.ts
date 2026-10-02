export const BOARD_SIDEBAR_TAB_IDS = ["general", "lesson", "design", "ops", "advanced"] as const;
export type BoardSidebarTabId = (typeof BOARD_SIDEBAR_TAB_IDS)[number];

export const BOARD_SIDEBAR_ACTION_IDS = ["eduLessonLink", "eduPracticeTemplate"] as const;
export type BoardSidebarActionId = (typeof BOARD_SIDEBAR_ACTION_IDS)[number];

export type BoardSidebarActionItem = {
  type: "action";
  id: BoardSidebarActionId;
  label: string;
};

export type BoardSidebarLinkItem = {
  type: "link";
  label: string;
  href: string;
};

export type BoardSidebarItem = BoardSidebarActionItem | BoardSidebarLinkItem;

export type BoardSidebarTab = {
  id: BoardSidebarTabId;
  label: string;
  items: BoardSidebarItem[];
  contentBlocks: BoardSidebarContentBlock[];
};

export type BoardSidebarConfig = {
  tabs: BoardSidebarTab[];
};

const MAX_TABS = 5;
const MAX_ITEMS_PER_TAB = 10;
const MAX_LABEL_LENGTH = 80;
const MAX_CONTENT_BLOCKS_PER_TAB = 2;
const MAX_CONTENT_BLOCK_TITLE_LENGTH = 40;
const MAX_CONTENT_BLOCK_BODY_LENGTH = 600;
const MAX_CONTENT_BLOCK_LINKS = 3;

export type BoardSidebarContentBlockLink = {
  label: string;
  href: string;
};

export type BoardSidebarContentBlock = {
  id: string;
  title: string;
  body: string;
  links: BoardSidebarContentBlockLink[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isSafeHref(raw: string): boolean {
  const href = raw.trim();
  if (!href) return false;
  if (href.startsWith("/")) {
    return !href.startsWith("//");
  }
  if (!href.startsWith("https://")) {
    return false;
  }
  try {
    const parsed = new URL(href);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_LABEL_LENGTH) return null;
  return trimmed;
}

function parseContentBlockTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_CONTENT_BLOCK_TITLE_LENGTH) return null;
  return trimmed;
}

function parseContentBlockBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_CONTENT_BLOCK_BODY_LENGTH) return null;
  return trimmed;
}

function parseContentBlockLink(value: unknown): BoardSidebarContentBlockLink | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["label", "href"])) return null;
  const label = parseLabel(value.label);
  if (!label) return null;
  if (typeof value.href !== "string" || !isSafeHref(value.href)) return null;
  return {
    label,
    href: value.href.trim(),
  };
}

function parseContentBlock(value: unknown): BoardSidebarContentBlock | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["id", "title", "body", "links"])) return null;
  if (typeof value.id !== "string") return null;
  const id = value.id.trim();
  if (!id || id.length > MAX_LABEL_LENGTH) return null;

  const title = parseContentBlockTitle(value.title);
  if (!title) return null;

  const body = parseContentBlockBody(value.body);
  if (!body) return null;

  let links: BoardSidebarContentBlockLink[] = [];
  if (value.links !== undefined) {
    if (!Array.isArray(value.links) || value.links.length > MAX_CONTENT_BLOCK_LINKS) return null;
    const parsedLinks: BoardSidebarContentBlockLink[] = [];
    for (const rawLink of value.links) {
      const link = parseContentBlockLink(rawLink);
      if (!link) return null;
      parsedLinks.push(link);
    }
    links = parsedLinks;
  }

  return {
    id,
    title,
    body,
    links,
  };
}

function parseItem(value: unknown): BoardSidebarItem | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["type", "id", "label", "href"])) return null;
  const type = value.type;
  const label = parseLabel(value.label);
  if (!label) return null;

  if (type === "action") {
    if (typeof value.id !== "string") return null;
    if (!(BOARD_SIDEBAR_ACTION_IDS as readonly string[]).includes(value.id)) return null;
    if (value.href !== undefined) return null;
    return { type: "action", id: value.id as BoardSidebarActionId, label };
  }

  if (type === "link") {
    if (value.id !== undefined) return null;
    if (typeof value.href !== "string" || !isSafeHref(value.href)) return null;
    return { type: "link", label, href: value.href.trim() };
  }

  return null;
}

function parseTab(value: unknown): BoardSidebarTab | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["id", "label", "items", "contentBlocks"])) return null;
  if (typeof value.id !== "string") return null;
  if (!(BOARD_SIDEBAR_TAB_IDS as readonly string[]).includes(value.id)) return null;

  const label = parseLabel(value.label);
  if (!label) return null;
  if (!Array.isArray(value.items) || value.items.length > MAX_ITEMS_PER_TAB) return null;

  const items: BoardSidebarItem[] = [];
  for (const rawItem of value.items) {
    const parsedItem = parseItem(rawItem);
    if (!parsedItem) return null;
    items.push(parsedItem);
  }

  let contentBlocks: BoardSidebarContentBlock[] = [];
  if (value.contentBlocks !== undefined) {
    if (!Array.isArray(value.contentBlocks) || value.contentBlocks.length > MAX_CONTENT_BLOCKS_PER_TAB) return null;
    const seenBlockIds = new Set<string>();
    const parsedBlocks: BoardSidebarContentBlock[] = [];
    for (const rawBlock of value.contentBlocks) {
      const block = parseContentBlock(rawBlock);
      if (!block) return null;
      if (seenBlockIds.has(block.id)) return null;
      seenBlockIds.add(block.id);
      parsedBlocks.push(block);
    }
    contentBlocks = parsedBlocks;
  }

  return {
    id: value.id as BoardSidebarTabId,
    label,
    items,
    contentBlocks,
  };
}

export function parseBoardSidebarConfig(body: string): BoardSidebarConfig | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !hasOnlyKeys(parsed, ["tabs"])) return null;
  if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0 || parsed.tabs.length > MAX_TABS) return null;

  const tabs: BoardSidebarTab[] = [];
  const seen = new Set<BoardSidebarTabId>();
  for (const rawTab of parsed.tabs) {
    const tab = parseTab(rawTab);
    if (!tab || seen.has(tab.id)) return null;
    seen.add(tab.id);
    tabs.push(tab);
  }

  return { tabs };
}
