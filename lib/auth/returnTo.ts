import {
  SHORT_PREFERRED_HOST,
  TEACHER_CANONICAL_HOST,
  mustUseCanonical,
  prefersShortHost,
} from "@/lib/http/siteConfig";
import { isTrustedTeacherPreviewHost } from "@/lib/http/hosts";
import { routes } from "@/lib/standards/routes";

export type NormalizedReturnTo = {
  path: string;
  redirectHost: string;
};

const FALLBACK_PATH = routes.page.dashboard.root();
const RELATIVE_URL_PREFIX_REGEX = /^(\/\/|[a-z][a-z0-9+.-]*:)/i;

function sanitizeHost(host: string | null | undefined): string {
  const cleaned = (host ?? "").split(":")[0].trim().toLowerCase();
  return cleaned || TEACHER_CANONICAL_HOST.toLowerCase();
}

function hasUnsafeContent(value: string): boolean {
  if (RELATIVE_URL_PREFIX_REGEX.test(value)) {
    return true;
  }

  if (/\s/.test(value)) {
    return true;
  }

  try {
    const decoded = decodeURI(value).toLowerCase();
    if (decoded.includes("javascript:")) {
      return true;
    }
  } catch {
    // If decodeURI fails, treat as unsafe to avoid inconsistencies
    return true;
  }

  return false;
}

function normalizePath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed || !trimmed.startsWith("/")) {
    return null;
  }

  if (hasUnsafeContent(trimmed)) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, "https://placeholder.invalid");
    const normalized = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  } catch {
    return null;
  }
}

export function normalizeReturnTo(
  host: string | null | undefined,
  returnTo?: string | null,
): NormalizedReturnTo {
  const defaultHost = sanitizeHost(host);
  const isTrustedPreview = isTrustedTeacherPreviewHost(defaultHost);
  const fallbackResult: NormalizedReturnTo = {
    path: FALLBACK_PATH,
    redirectHost: isTrustedPreview ? defaultHost : TEACHER_CANONICAL_HOST.toLowerCase(),
  };

  const normalizedPath = normalizePath(returnTo);
  if (!normalizedPath) {
    return fallbackResult;
  }

  const redirectHost = mustUseCanonical(normalizedPath)
    ? isTrustedPreview
      ? defaultHost
      : TEACHER_CANONICAL_HOST.toLowerCase()
    : prefersShortHost(normalizedPath)
      ? SHORT_PREFERRED_HOST.toLowerCase()
      : defaultHost;

  return { path: normalizedPath, redirectHost };
}
