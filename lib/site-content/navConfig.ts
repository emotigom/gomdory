export type NavConfigLink = {
  label: string;
  href: string;
};

export type SiteNavConfig = {
  landingFooterLinks: NavConfigLink[];
  dashboardHelpLinks: NavConfigLink[];
};

const MAX_LINKS_PER_SECTION = 10;
const MAX_LABEL_LENGTH = 80;

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

function parseLinks(input: unknown): NavConfigLink[] | null {
  if (!Array.isArray(input) || input.length > MAX_LINKS_PER_SECTION) return null;
  const links: NavConfigLink[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") return null;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const href = typeof row.href === "string" ? row.href.trim() : "";
    if (!label || label.length > MAX_LABEL_LENGTH) return null;
    if (!isSafeHref(href)) return null;
    links.push({ label, href });
  }
  return links;
}

export function parseNavConfig(body: string): SiteNavConfig | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const allowedKeys = new Set(["landingFooterLinks", "dashboardHelpLinks"]);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) return null;
  }

  const landingFooterLinks = parseLinks(record.landingFooterLinks);
  const dashboardHelpLinks = parseLinks(record.dashboardHelpLinks);
  if (!landingFooterLinks || !dashboardHelpLinks) return null;

  return {
    landingFooterLinks,
    dashboardHelpLinks,
  };
}

